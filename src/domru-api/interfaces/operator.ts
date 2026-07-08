export interface Operator {
	/** Уникальный идентификатор оператора */
	id: number;

	/** Название оператора */
	name: string;

	/** ИНН оператора */
	inn: string | null;
}
