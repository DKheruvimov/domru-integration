export interface Finances {
	/** Текущий баланс */
	balance: number;

	/** Тип блокировки */
	blockType: string | null;

	/** Сумма к оплате */
	amountSum: number;

	/** Целевая дата оплаты */
	targetDate: string | null;

	/** Ссылка на оплату */
	paymentLink: string | null;

	/** Заблокирован ли аккаунт */
	blocked: boolean;
}
