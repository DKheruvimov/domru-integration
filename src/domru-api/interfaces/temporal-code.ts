export interface TemporalCode {
	/** Одноразовый код доступа */
	code: string;

	/** Дата обновления кода */
	updateDate: string;

	/** Идентификатор устройства контроля доступа */
	accessControlId: number;

	/** Тип кода */
	type: string;
}
