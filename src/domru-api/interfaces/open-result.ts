export interface OpenResult {
	/** Успешно ли открыта дверь */
	status: boolean;

	/** Код ошибки */
	errorCode: number | null;

	/** Сообщение об ошибке */
	errorMessage: string | null;
}
