import type { EventSource } from "./event-source.js";
import type { EventValue } from "./event-value.js";

export interface DomruEvent {
	/** Уникальный идентификатор события */
	id: string;

	/** Идентификатор места */
	placeId: number;

	/** Имя типа события */
	eventTypeName: string;

	/** Временная метка */
	timestamp: string;

	/** Сообщение */
	message: string;

	/** Источник события */
	source: EventSource;

	/** Значение события */
	value: EventValue;

	/** Статус события */
	eventStatusValue: string | null;

	/** Доступные действия */
	actions: ReadonlyArray<Record<string, unknown>>;
}
