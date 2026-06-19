import axios from "axios";
import { BASE_URL, DEFAULT_HEADERS } from "../constants.js";
import { camelizeKeys } from "../utils/camelize.js";

export interface SmsAccount {
	operatorId: number;
	subscriberId: number;
	accountId: string;
	placeId: number;
	address: string;
	profileId: string;
}

export interface SmsConfirmResponse {
	operatorId: number;
	tokenType: string;
	accessToken: string;
	refreshToken: string;
}

/**
 * Получить список аккаунтов, привязанных к номеру телефона
 */
export async function getAccountsByPhone(phone: string, timeout = 10000): Promise<SmsAccount[]> {
	const url = `${BASE_URL}auth/v2/login/${phone}`.replace(/([^:]\/)\/+/g, "$1");
	const response = await axios.get(url, {
		headers: {
			...DEFAULT_HEADERS,
			Authorization: "",
		},
		timeout,
		validateStatus: () => true,
	});

	if (response.status !== 200 && response.status !== 300) {
		const errMsg = response.data?.message || response.data?.error || `Ошибка со списком аккаунтов (Статус ${response.status})`;
		throw new Error(errMsg);
	}

	return camelizeKeys(response.data) as SmsAccount[];
}

/**
 * Вспомогательная функция для генерации User-Agent с уникальным UUID устройства
 */
function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
}

function getSmsUserAgent(account: SmsAccount): string {
	const pId = !account.placeId ? "1" : String(account.placeId);
	const opId = account.operatorId || 0;
	const uuid = generateUUID();
	return `Google sdkgphone64x8664 | Android 14 | erth | 8.26.0 (82600010) | | ${opId} | ${uuid} | ${pId}`;
}

/**
 * Отправить SMS код подтверждения для выбранного аккаунта
 */
export async function requestSmsCode(phone: string, account: SmsAccount, timeout = 10000): Promise<boolean> {
	const url = `${BASE_URL}auth/v2/confirmation/${phone}`.replace(/([^:]\/)\/+/g, "$1");
	const userAgent = getSmsUserAgent(account);

	const payload = {
		operatorId: Number(account.operatorId || 0),
		subscriberId: Number(account.subscriberId || 0),
		accountId: String(account.accountId || ""),
		placeId: Number(account.placeId || 0),
		address: String(account.address || ""),
		profileId: String(account.profileId || ""),
	};

	console.log(`[DOMRU-SMS-REQ] Sending to ${url}`);
	console.log(`[DOMRU-SMS-REQ] Headers: UA="${userAgent}"`);
	console.log(`[DOMRU-SMS-REQ] Payload: ${JSON.stringify(payload)}`);

	const response = await axios.post(
		url,
		payload,
		{
			headers: {
				...DEFAULT_HEADERS,
				"Content-Type": "application/json",
				"User-Agent": userAgent,
				Authorization: "",
			},
			timeout,
			validateStatus: () => true,
		},
	);

	console.log(`[DOMRU-SMS-REQ] Response: Status ${response.status}`, response.data);

	if (response.status !== 200) {
		const errMsg = response.data?.errorMessage || response.data?.message || response.data?.error || `Не удалось отправить СМС-код (Статус ${response.status})`;
		throw new Error(errMsg);
	}

	return true;
}

/**
 * Подтвердить SMS код и получить токены авторизации
 */
export async function confirmSmsCode(
	phone: string,
	code: string,
	account: SmsAccount,
	timeout = 10000,
): Promise<SmsConfirmResponse> {
	const url = `${BASE_URL}auth/v2/auth/${phone}/confirmation`.replace(/([^:]\/)\/+/g, "$1");
	const userAgent = getSmsUserAgent(account);

	const payload = {
		confirm1: String(code || ""),
		subscriberId: Number(account.subscriberId || 0),
		login: String(phone || ""),
		operatorId: Number(account.operatorId || 0),
		accountId: String(account.accountId || ""),
		profileId: String(account.profileId || ""),
	};

	console.log(`[DOMRU-SMS-CONFIRM] Sending to ${url}`);
	console.log(`[DOMRU-SMS-CONFIRM] Headers: UA="${userAgent}"`);
	console.log(`[DOMRU-SMS-CONFIRM] Payload: ${JSON.stringify(payload)}`);

	const response = await axios.post(
		url,
		payload,
		{
			headers: {
				...DEFAULT_HEADERS,
				"Content-Type": "application/json",
				"User-Agent": userAgent,
				Authorization: "",
			},
			timeout,
			validateStatus: () => true,
		},
	);

	console.log(`[DOMRU-SMS-CONFIRM] Response: Status ${response.status}`, response.data);

	if (response.status !== 200) {
		const errMsg = response.data?.errorMessage || response.data?.message || response.data?.error || `Неверный код подтверждения (Статус ${response.status})`;
		throw new Error(errMsg);
	}

	return camelizeKeys(response.data) as SmsConfirmResponse;
}
