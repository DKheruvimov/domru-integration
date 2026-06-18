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
	const url = `${BASE_URL}auth/v2/login/${phone}`;
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
 * Вспомогательная функция для генерации User-Agent
 */
function getSmsUserAgent(account: SmsAccount): string {
	const pId = !account.placeId ? "null" : String(account.placeId);
	return `Google sdkgphone64x8664 | Android 14 | erth | 8.26.0 (82600010) | | ${account.operatorId} | d5c78d0a-9cbe-4bea-b66a-b8296d947b62 | ${pId}`;
}

/**
 * Отправить SMS код подтверждения для выбранного аккаунта
 */
export async function requestSmsCode(phone: string, account: SmsAccount, timeout = 10000): Promise<boolean> {
	const url = `${BASE_URL}auth/v2/confirmation/${phone}`;
	const userAgent = getSmsUserAgent(account);

	const payload = {
		operatorId: account.operatorId,
		subscriberId: account.subscriberId,
		accountId: account.accountId,
		placeId: account.placeId,
		address: account.address,
		profileId: account.profileId,
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
	const url = `${BASE_URL}auth/v2/auth/${phone}/confirmation`;
	const userAgent = getSmsUserAgent(account);

	const payload = {
		confirm1: code,
		subscriberId: account.subscriberId,
		login: phone,
		operatorId: account.operatorId,
		accountId: account.accountId,
		profileId: account.profileId,
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
