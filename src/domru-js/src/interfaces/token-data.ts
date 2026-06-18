export interface TokenData {
	/** Идентификатор оператора */
	operatorId: number;

	/** Имя оператора */
	operatorName: string;

	/** Тип токена */
	tokenType: string | null;

	/** Токен доступа */
	accessToken: string;

	/** Время истечения токена доступа */
	expiresIn: number | null;

	/** Токен обновления */
	refreshToken: string;

	/** Время истечения токена обновления */
	refreshExpiresIn: number | null;
}
