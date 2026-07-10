import type { DomruClientOptions, DomruLogger } from "./types.js";

/** Контекст клиента Dom.ru */
export interface ClientContext {
	/** Логин для аутентификации */
	readonly login: string | undefined;

	/** Пароль для аутентификации */
	readonly password: string | undefined;

	/** Токен обновления */
	refreshToken: string | null;

	/** Идентификатор оператора */
	operatorId: number | null;

	/** Токен доступа */
	accessToken: string | null;

	/** Время истечения токена доступа */
	accessTokenExpiresAt: number | null;

	/** Таймаут запросов */
	readonly timeout: number;

	/** Логгер */
	readonly log: DomruLogger;

	/** Процесс обновления токена (мьютекс) */
	refreshInProgress: Promise<void> | null;
}

/** Пустой логгер по умолчанию */
const NOOP_LOGGER: DomruLogger = {
	info() {},
	warn() {},
	error() {},
	debug() {},
};

/** Таймаут по умолчанию (10 секунд) */
const DEFAULT_TIMEOUT = 10_000;

/** Создать контекст клиента */
export function createContext(opts: DomruClientOptions): ClientContext {
	return {
		login: opts.login,
		password: opts.password,
		refreshToken: opts.refreshToken ?? null,
		operatorId: opts.operatorId ?? null,
		accessToken: opts.accessToken ?? null,
		accessTokenExpiresAt: opts.accessToken ? Date.now() + 86400000 : null,
		timeout: opts.timeout ?? DEFAULT_TIMEOUT,
		log: opts.logger ?? NOOP_LOGGER,
		refreshInProgress: null,
	};
}

/** Проверить истечение токена */
export function isTokenExpired(ctx: ClientContext): boolean {
	if (!ctx.accessTokenExpiresAt) return false;
	return Date.now() >= ctx.accessTokenExpiresAt;
}
