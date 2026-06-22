import { createContext, type ClientContext } from "./context.js";
import { authenticate } from "./http/client.js";
import { RequestCache } from "./http/cache.js";
import {
	SimpleEventEmitter,
	type DomruEventType,
	type DomruEventMap,
	type EventHandler,
} from "./events/event-emitter.js";
import { getOperators } from "./api/operators.js";
import { getSubscriberPlaces, getDevices, getSipCredentials } from "./api/places.js";
import { getCameras } from "./api/cameras.js";
import { getStreamUrl, getSnapshot } from "./api/stream.js";
import { openDoor } from "./api/intercom.js";
import { getEvents, getTemporalCodes } from "./api/events.js";
import { getFinances } from "./api/finances.js";
import type { Operator } from "./interfaces/operator.js";
import type { SubscriberPlace } from "./interfaces/subscriber-place.js";
import type { Device } from "./interfaces/device.js";
import type { Camera } from "./interfaces/camera.js";
import type { VideoStreamInfo } from "./interfaces/video-stream-info.js";
import type { DomruEvent } from "./interfaces/domru-event.js";
import type { TemporalCode } from "./interfaces/temporal-code.js";
import type { OpenResult } from "./interfaces/open-result.js";
import type { Finances } from "./interfaces/finances.js";
import type { RefreshData } from "./interfaces/refresh-data.js";
import type { DomruClientOptions } from "./types.js";

/** Время кеширования списков устройств (5 минут) */
const DEVICES_CACHE_TTL = 5 * 60 * 1000;

/** Клиент Dom.ru с кешированием и генератором событий */
export class DomruClient {
	private readonly ctx: ClientContext;
	private readonly cache = new RequestCache();
	private readonly emitter: SimpleEventEmitter;

	constructor(opts: DomruClientOptions) {
		this.ctx = createContext(opts);
		this.emitter = new SimpleEventEmitter();
	}

	/** Текущий токен доступа */
	get token(): string | null {
		return this.ctx.accessToken;
	}

	/** Данные для восстановления сессии */
	get refreshData(): RefreshData {
		return {
			refreshToken: this.ctx.refreshToken,
			operatorId: this.ctx.operatorId,
		};
	}

	/** Подписаться на событие */
	on<T extends DomruEventType>(event: T, handler: EventHandler<T>): void {
		this.emitter.on(event, handler);
	}

	/** Отписаться от события */
	off<T extends DomruEventType>(event: T, handler: EventHandler<T>): void {
		this.emitter.off(event, handler);
	}

	/** Сгенерировать событие */
	private emit<T extends DomruEventType>(event: T, data: DomruEventMap[T]): void {
		this.emitter.emit(event, data);
	}

	/** Аутентифицировать клиента */
	async authenticate(): Promise<void> {
		await authenticate(this.ctx);
		if (this.ctx.operatorId) {
			this.emit("token:refreshed", { operatorId: this.ctx.operatorId });
		}
	}

	/** Убедиться что клиент аутентифицирован */
	private async ensureAuth(): Promise<void> {
		if (!this.ctx.accessToken) {
			await this.authenticate();
		}
	}

	/** Получить список операторов */
	async getOperators(): Promise<Operator[]> {
		await this.ensureAuth();
		return getOperators(this.ctx);
	}

	/** Получить список объектов абонента */
	async getSubscriberPlaces(): Promise<SubscriberPlace[]> {
		await this.ensureAuth();
		return getSubscriberPlaces(this.ctx);
	}

	/** Получить устройства контроля доступа (кешируется на 5 минут) */
	async getDevices(placeId: number): Promise<Device[]> {
		await this.ensureAuth();

		const key = `devices:${placeId}`;
		const cached = this.cache.get<Device[]>(key);
		if (cached) return cached;

		const result = await getDevices(this.ctx, placeId);
		this.cache.set(key, result, DEVICES_CACHE_TTL);
		return result;
	}

	/** Получить список камер */
	async getCameras(): Promise<Camera[]> {
		await this.ensureAuth();
		return getCameras(this.ctx);
	}

	/** Получить URL видеопотока */
	async getStreamUrl(cameraId: string): Promise<VideoStreamInfo | null> {
		await this.ensureAuth();
		const result = await getStreamUrl(this.ctx, cameraId);
		if (result) {
			this.emit("camera:stream_changed", {
				cameraId,
				streamUrl: result.url,
			});
		}
		return result;
	}

	/** Получить снимок с камеры */
	async getSnapshot(placeId: number, deviceId: number): Promise<Uint8Array | null> {
		await this.ensureAuth();
		return getSnapshot(this.ctx, placeId, deviceId);
	}

	/** Открыть дверь */
	async openDoor(placeId: number, deviceId: number): Promise<OpenResult> {
		await this.ensureAuth();
		return openDoor(this.ctx, placeId, deviceId);
	}

	/** Получить историю событий */
	async getEvents(
		placeIds: number[],
		page?: number,
		sort?: "ASC" | "DESC",
	): Promise<DomruEvent[]> {
		await this.ensureAuth();
		return getEvents(this.ctx, placeIds, page, sort);
	}

	/** Получить временные коды */
	async getTemporalCodes(deviceIds: number[]): Promise<TemporalCode[]> {
		await this.ensureAuth();
		return getTemporalCodes(this.ctx, deviceIds);
	}

	/** Получить SIP-учетные данные */
	async getSipCredentials(placeId: number, deviceId: number, installationId: string) {
		await this.ensureAuth();
		return getSipCredentials(this.ctx, placeId, deviceId, installationId);
	}

	/** Получить финансовые данные */
	async getFinances(): Promise<Finances> {
		await this.ensureAuth();
		return getFinances(this.ctx);
	}

	/** Очистить кеш */
	clearCache(): void {
		this.cache.clear();
	}

	/** Очистить кеш для конкретного объекта */
	invalidateCache(placeId: number): void {
		this.cache.invalidate(String(placeId));
	}
}
