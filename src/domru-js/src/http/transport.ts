import type { AxiosResponse } from "axios";

/** Опции для HTTP-запроса */
export interface RequestOptions {
	/** HTTP-метод */
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

	/** Заголовки запроса */
	headers?: Record<string, string>;

	/** Тело запроса */
	body?: unknown;

	/** Параметры URL */
	params?: Record<string, string>;

	/** Таймаут в миллисекундах */
	timeout?: number;
}

/** Абстрактный HTTP-транспорт */
export interface HttpTransport {
	/** Выполнить HTTP-запрос */
	request<T>(url: string, options: RequestOptions): Promise<T>;

	/** Выполнить HTTP-запрос и получить сырой ответ */
	requestRaw(url: string, options: RequestOptions): Promise<AxiosResponse>;
}
