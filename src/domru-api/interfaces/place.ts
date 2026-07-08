import type { Address } from "./address.js";
import type { Location } from "./location.js";

export interface Place {
	/** Уникальный идентификатор объекта */
	id: number;

	/** Адрес объекта */
	address: Address;

	/** Географические координаты */
	location: Location;

	/** Идентификатор оператора */
	operatorId: number;

	/** Состояние автоматической постановки на охрану */
	autoArmingState: boolean;

	/** Радиус автоматической постановки на охрану */
	autoArmingRadius: number;
}
