/** Типы событий, генерируемых клиентом */
export type DomruEventType =
	| "token:refreshed"
	| "token:expired"
	| "error"
	| "rate_limit"
	| "camera:stream_changed";

/** Карта данных для каждого типа события */
export interface DomruEventMap {
	"token:refreshed": { operatorId: number };
	"token:expired": { reason: string };
	error: { error: Error; context: string };
	rate_limit: { retryAfter: number };
	"camera:stream_changed": { cameraId: string; streamUrl: string };
}

/** Обработчик события */
export type EventHandler<T extends DomruEventType> = (data: DomruEventMap[T]) => void;

/** Интерфейс генератора событий */
export interface EventEmitter {
	/** Подписаться на событие */
	on<T extends DomruEventType>(event: T, handler: EventHandler<T>): void;
	/** Отписаться от события */
	off<T extends DomruEventType>(event: T, handler: EventHandler<T>): void;
	/** Сгенерировать событие */
	emit<T extends DomruEventType>(event: T, data: DomruEventMap[T]): void;
}

/** Реализация генератора событий */
export class SimpleEventEmitter implements EventEmitter {
	private listeners = new Map<DomruEventType, Set<EventHandler<DomruEventType>>>();

	on<T extends DomruEventType>(event: T, handler: EventHandler<T>): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler as EventHandler<DomruEventType>);
	}

	off<T extends DomruEventType>(event: T, handler: EventHandler<T>): void {
		this.listeners.get(event)?.delete(handler as EventHandler<DomruEventType>);
	}

	emit<T extends DomruEventType>(event: T, data: DomruEventMap[T]): void {
		this.listeners.get(event)?.forEach((handler) => handler(data));
	}
}
