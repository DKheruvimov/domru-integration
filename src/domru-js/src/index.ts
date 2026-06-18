/** Клиент Dom.ru */
export { DomruClient } from "./client.js";

/** Типы и интерфейсы */
export type { DomruClientOptions, DomruLogger } from "./types.js";
export type { ClientContext } from "./context.js";

/** События */
export type {
	DomruEventType,
	DomruEventMap,
	EventEmitter,
	EventHandler,
} from "./events/event-emitter.js";
export { SimpleEventEmitter } from "./events/event-emitter.js";

/** Отдельные интерфейсы */
export type { Operator } from "./interfaces/operator.js";
export type { Address } from "./interfaces/address.js";
export type { Location } from "./interfaces/location.js";
export type { Place } from "./interfaces/place.js";
export type { Subscriber } from "./interfaces/subscriber.js";
export type { GuardCallOut } from "./interfaces/guard-call-out.js";
export type { Payment } from "./interfaces/payment.js";
export type { SubscriberPlace } from "./interfaces/subscriber-place.js";
export type { Device } from "./interfaces/device.js";
export type { Camera } from "./interfaces/camera.js";
export type { EventSource } from "./interfaces/event-source.js";
export type { EventValue } from "./interfaces/event-value.js";
export type { DomruEvent } from "./interfaces/domru-event.js";
export type { OpenResult } from "./interfaces/open-result.js";
export type { TemporalCode } from "./interfaces/temporal-code.js";
export type { StreamType } from "./interfaces/stream-type.js";
export type { VideoStreamInfo } from "./interfaces/video-stream-info.js";
export type { Finances } from "./interfaces/finances.js";
export type { TokenData } from "./interfaces/token-data.js";
export type { RefreshData } from "./interfaces/refresh-data.js";

/** Ошибки */
export {
	DomruError,
	AuthRequiredError,
	UnauthorizedError,
	DeviceUnavailableError,
	TemporalCodeError,
	RequestTimeoutError,
	NetworkError,
	ApiError,
	ErrorCode,
} from "./errors.js";

/** HTTP-транспорт */
export type { HttpTransport, RequestOptions } from "./http/transport.js";
export { AxiosTransport } from "./http/axios-transport.js";
export { RequestCache } from "./http/cache.js";
