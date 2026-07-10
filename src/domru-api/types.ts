/** Опции создания клиента Dom.ru */
export interface DomruClientOptions {
	/** Логин аккаунта */
	login?: string;

	/** Пароль аккаунта */
	password?: string;

	/** Токен обновления (для восстановления сессии) */
	refreshToken?: string;

	/** Идентификатор оператора */
	operatorId?: number;

	/** Токен доступа (если сессия уже активна) */
	accessToken?: string;

	/** Таймаут запросов в миллисекундах */
	timeout?: number;

	/** Логгер */
	logger?: DomruLogger;
}

/** Интерфейс логгера */
export interface DomruLogger {
	/** Информационное сообщение */
	info(msg: string, ...args: unknown[]): void;

	/** Предупреждение */
	warn(msg: string, ...args: unknown[]): void;

	/** Сообщение об ошибке */
	error(msg: string, ...args: unknown[]): void;

	/** Отладочное сообщение */
	debug(msg: string, ...args: unknown[]): void;
}
