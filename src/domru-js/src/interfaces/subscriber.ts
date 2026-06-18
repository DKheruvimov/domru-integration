export interface Subscriber {
	/** Уникальный идентификатор абонента */
	id: number;

	/** Имя абонента */
	name: string;

	/** Идентификатор аккаунта */
	accountId: string;

	/** Никнейм */
	nickName: string | null;
}
