/** Коды ошибок API */
export enum ErrorCode {
	/** Требуется авторизация */
	AUTH_REQUIRED = "AUTH_REQUIRED",

	/** Неавторизованный доступ */
	UNAUTHORIZED = "UNAUTHORIZED",

	/** Устройство недоступно */
	DEVICE_UNAVAILABLE = "DEVICE_UNAVAILABLE",

	/** Ошибка временного кода */
	TEMPORAL_CODE = "TEMPORAL_CODE",

	/** Таймаут запроса */
	TIMEOUT = "TIMEOUT",

	/** Ошибка сети */
	NETWORK = "NETWORK",

	/** Ошибка API */
	API = "API",
}

/** Опции для ошибки DomruError */
interface DomruErrorOptions {
	/** Причина ошибки */
	cause?: Error;

	/** HTTP-код статуса */
	statusCode?: number | undefined;

	/** Код ошибки API */
	apiCode?: number | undefined;
}

/** Базовый класс ошибки Domru */
export class DomruError extends Error {
	override readonly name = this.constructor.name;

	/** Код ошибки */
	readonly code: ErrorCode;

	/** HTTP-код статуса */
	readonly statusCode?: number | undefined;

	/** Код ошибки API */
	readonly apiCode?: number | undefined;

	constructor(message: string, code: ErrorCode = ErrorCode.API, options?: DomruErrorOptions) {
		super(message, { cause: options?.cause });
		this.code = code;
		this.statusCode = options?.statusCode;
		this.apiCode = options?.apiCode;
	}
}

/** Ошибка: требуется авторизация */
export class AuthRequiredError extends DomruError {
	constructor(
		message = "Укажите логин/пароль или refreshToken/operatorId",
		options?: DomruErrorOptions,
	) {
		super(message, ErrorCode.AUTH_REQUIRED, options);
	}
}

/** Ошибка: неавторизованный доступ */
export class UnauthorizedError extends DomruError {
	constructor(
		message = "Неавторизованный доступ — токен истёк или недействителен",
		options?: DomruErrorOptions,
	) {
		super(message, ErrorCode.UNAUTHORIZED, { ...options, statusCode: 401 });
	}
}

/** Ошибка: устройство недоступно */
export class DeviceUnavailableError extends DomruError {
	constructor(message = "Устройство недоступно", options?: DomruErrorOptions) {
		super(message, ErrorCode.DEVICE_UNAVAILABLE, {
			...options,
			statusCode: options?.statusCode ?? 531,
		});
	}
}

/** Ошибка: не удалось получить временный код */
export class TemporalCodeError extends DomruError {
	constructor(message = "Не удалось получить временный код", options?: DomruErrorOptions) {
		super(message, ErrorCode.TEMPORAL_CODE, {
			...options,
			statusCode: options?.statusCode ?? 500,
		});
	}
}

/** Ошибка: таймаут запроса */
export class RequestTimeoutError extends DomruError {
	constructor(message = "Таймаут запроса", options?: DomruErrorOptions) {
		super(message, ErrorCode.TIMEOUT, options);
	}
}

/** Ошибка: сбой подключения */
export class NetworkError extends DomruError {
	constructor(message = "Сбой подключения", options?: DomruErrorOptions) {
		super(message, ErrorCode.NETWORK, options);
	}
}

/** Ошибка: ошибка API-ответа */
export class ApiError extends DomruError {
	constructor(message: string, options?: DomruErrorOptions) {
		super(message, ErrorCode.API, options);
	}
}
