import type { AxiosResponse } from "axios";
import type { ClientContext } from "../context.js";
import { BASE_URL, DEFAULT_HEADERS, HASH2_PREFIX, HASH2_SECRET } from "../constants.js";
import {
	ApiError,
	AuthRequiredError,
	DeviceUnavailableError,
	DomruError,
	NetworkError,
	TemporalCodeError,
	UnauthorizedError,
} from "../errors.js";
import { camelizeKeys } from "../utils/camelize.js";
import { md5Hex, sha1Base64 } from "../utils/crypto.js";
import type { TokenData } from "../interfaces/token-data.js";
import axios from "axios";

/** Интерфейс опций запроса */
interface FetchOptions {
	method: string;
	headers: Record<string, string>;
	params: Record<string, string>;
	body?: unknown;
	timeout: number;
}

/** Выполнить JSON-запрос с автоматическим обновлением токена */
export async function requestJson<T = unknown>(
	ctx: ClientContext,
	url: string,
	method = "GET",
	params?: Record<string, string>,
	body?: unknown,
): Promise<T> {
	await ensureToken(ctx);

	try {
		const raw = await fetchJson(ctx, url, {
			method,
			headers: authHeaders(ctx),
			params: params ?? {},
			body,
			timeout: ctx.timeout,
		});
		return camelizeKeys(raw) as T;
	} catch (err) {
		if (err instanceof UnauthorizedError || err instanceof AuthRequiredError) {
			ctx.log.warn("Токен недействителен (401 или 403), выполняется автоматическое обновление...");
			await refreshOnUnauthorized(ctx);
			const raw = await fetchJson(ctx, url, {
				method,
				headers: authHeaders(ctx),
				params: params ?? {},
				body,
				timeout: ctx.timeout,
			});
			return camelizeKeys(raw) as T;
		}
		throw err;
	}
}

/** Выполнить бинарный запрос */
export async function fetchRaw(ctx: ClientContext, url: string): Promise<AxiosResponse | null> {
	await ensureToken(ctx);

	try {
		const response = await axios.request({
			url,
			method: "GET",
			headers: authHeaders(ctx),
			timeout: ctx.timeout,
			responseType: "arraybuffer",
			validateStatus: () => true,
		});

		return response.status >= 200 && response.status < 300 ? response : null;
	} catch {
		return null;
	}
}

/** Выполнить низкоуровневый HTTP-запрос */
async function fetchJson(
	ctx: ClientContext,
	url: string,
	options: FetchOptions,
): Promise<Record<string, unknown>> {
	const u = new URL(url);
	if (options.params) {
		for (const [k, v] of Object.entries(options.params)) {
			u.searchParams.set(k, v);
		}
	}

	try {
		const response = await axios.request({
			url: u.toString(),
			method: options.method,
			headers: options.headers,
			data: options.body ? JSON.stringify(options.body) : undefined,
			timeout: options.timeout,
			validateStatus: () => true,
		});

		if (response.status === 401) {
			throw new UnauthorizedError();
		}

		const json = response.data as Record<string, unknown>;

		if (response.status < 200 || response.status >= 300) {
			throw mapResponseError(response.status, json);
		}

		return json;
	} catch (err) {
		if (err instanceof DomruError) throw err;
		throw new NetworkError((err as Error).message, { cause: err as Error });
	}
}

/** Сформировать заголовки авторизации */
function authHeaders(ctx: ClientContext): Record<string, string> {
	return {
		Authorization: `Bearer ${ctx.accessToken}`,
		Operator: String(ctx.operatorId ?? ""),
		...DEFAULT_HEADERS,
	};
}

/** Сопоставить HTTP-код с типом ошибки */
function mapResponseError(status: number, json: Record<string, unknown>): DomruError {
	const msg = (json.errorMessage as string | undefined) ?? `HTTP ${status}`;
	const apiCode = json.errorCode as number | undefined;

	if (status === 403) {
		return new AuthRequiredError(msg, { statusCode: status, apiCode });
	}
	if (status === 531 && apiCode === 6007) {
		return new DeviceUnavailableError(msg, { statusCode: status, apiCode });
	}
	if (status === 500 && apiCode === 6005) {
		return new TemporalCodeError(msg, { statusCode: status, apiCode });
	}

	return new ApiError(msg, { statusCode: status, apiCode });
}

/** Убедиться что токен актуален */
async function ensureToken(ctx: ClientContext): Promise<void> {
	if (ctx.refreshInProgress) {
		await ctx.refreshInProgress;
		return;
	}
	if (!ctx.accessToken || isTokenExpired(ctx)) {
		await refreshAccessToken(ctx);
	}
}

/** Проверить истечение токена */
function isTokenExpired(ctx: ClientContext): boolean {
	if (!ctx.accessTokenExpiresAt) return false;
	return Date.now() >= ctx.accessTokenExpiresAt;
}

/** Обновить токен при 401 */
async function refreshOnUnauthorized(ctx: ClientContext): Promise<void> {
	if (!ctx.refreshInProgress) {
		ctx.refreshInProgress = refreshAccessToken(ctx).finally(() => {
			ctx.refreshInProgress = null;
		});
	}
	await ctx.refreshInProgress;
}

/** Обновить токен доступа */
export async function refreshAccessToken(ctx: ClientContext): Promise<void> {
	if (ctx.refreshToken && ctx.operatorId !== null && ctx.operatorId !== undefined) {
		const url = `${BASE_URL}auth/v2/session/refresh`.replace(/([^:]\/)\/+/g, "$1");
		const res = await fetchJson(ctx, url, {
			method: "GET",
			headers: {
				Bearer: ctx.refreshToken,
				Operator: String(ctx.operatorId),
				...DEFAULT_HEADERS,
			},
			params: {},
			timeout: ctx.timeout,
		});
		applyTokens(ctx, res);
		return;
	}

	if (ctx.login && ctx.password) {
		const url = `${BASE_URL}auth/v2/auth/${ctx.login}/password`.replace(/([^:]\/)\/+/g, "$1");
		const now = new Date();
		const timestamp = now.toISOString().replace(/\.\d{3}Z$/, ".000Z");
		const hash1 = await sha1Base64(ctx.password);
		const hash2 = computeHash2(ctx.login, ctx.password, now);
		const res = await fetchJson(ctx, url, {
			method: "POST",
			headers: DEFAULT_HEADERS,
			body: { login: ctx.login, timestamp, hash1, hash2 },
			params: {},
			timeout: ctx.timeout,
		});
		applyTokens(ctx, res);
		return;
	}

	throw new AuthRequiredError();
}

/** Аутентифицировать клиента */
export async function authenticate(ctx: ClientContext): Promise<void> {
	await refreshAccessToken(ctx);
}

/** Вычислить hash2 для аутентификации */
function computeHash2(login: string, password: string, now: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	const ts =
		`${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
		`${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
	return md5Hex(`${HASH2_PREFIX}${login}${password}${ts}${HASH2_SECRET}`);
}

/** Применить токены к контексту */
function applyTokens(ctx: ClientContext, raw: Record<string, unknown>): void {
	const t = camelizeKeys(raw) as TokenData;
	ctx.accessToken = t.accessToken;
	ctx.refreshToken = t.refreshToken;
	ctx.operatorId = t.operatorId;
	ctx.accessTokenExpiresAt =
		t.expiresIn !== null && t.expiresIn !== undefined ? Date.now() + t.expiresIn * 1000 : null;
	ctx.log.info(`Аутентификация успешна, оператор ${t.operatorId}`);
}
