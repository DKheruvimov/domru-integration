import type { Place } from "./place.js";
import type { Subscriber } from "./subscriber.js";
import type { GuardCallOut } from "./guard-call-out.js";
import type { Payment } from "./payment.js";

export interface SubscriberPlace {
	/** Уникальный идентификатор места */
	id: number;

	/** Тип подписчика */
	subscriberType: string;

	/** Состояние подписчика */
	subscriberState: string;

	/** Информация об объекте */
	place: Place;

	/** Информация об абоненте */
	subscriber: Subscriber;

	/** Настройки вызова охраны */
	guardCallOut: GuardCallOut;

	/** Настройки оплаты */
	payment: Payment;

	/** Провайдер услуг */
	provider: string;

	/** Заблокировано ли место */
	blocked: boolean;
}
