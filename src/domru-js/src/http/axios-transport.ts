import axios, { type AxiosResponse } from "axios";
import type { HttpTransport, RequestOptions } from "./transport.js";
import type { DomruLogger } from "../types.js";

/** Реализация HTTP-транспорта на базе Axios */
export class AxiosTransport implements HttpTransport {
	private client: ReturnType<typeof axios.create>;
	private timeout: number;

	constructor(
		private logger: DomruLogger,
		timeout: number,
	) {
		this.timeout = timeout;
		this.client = axios.create({
			timeout,
			maxRedirects: 5,
			validateStatus: () => true,
		});
	}

	async request<T>(url: string, options: RequestOptions): Promise<T> {
		const config: Record<string, unknown> = {
			url,
			method: options.method,
			timeout: options.timeout ?? this.timeout,
			validateStatus: () => true,
		};
		if (options.headers) config.headers = options.headers;
		if (options.params) config.params = options.params;
		if (options.body !== undefined) config.data = JSON.stringify(options.body);

		const response = await this.client.request(config);

		this.logger.debug(`[http] ${options.method} ${url} → ${response.status}`);

		return response.data as T;
	}

	async requestRaw(url: string, options: RequestOptions): Promise<AxiosResponse> {
		const config: Record<string, unknown> = {
			url,
			method: options.method,
			timeout: options.timeout ?? this.timeout,
			responseType: "arraybuffer",
			validateStatus: () => true,
		};
		if (options.headers) config.headers = options.headers;
		if (options.params) config.params = options.params;
		if (options.body !== undefined) config.data = options.body;

		return this.client.request(config);
	}
}
