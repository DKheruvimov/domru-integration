export interface Camera {
	/** Уникальный идентификатор камеры */
	id: string;

	/** Название камеры */
	name: string;

	/** Идентификатор группы */
	groupId: string;

	/** Активна ли камера */
	isActive: boolean;
}
