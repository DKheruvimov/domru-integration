export interface Device {
	/** Уникальный идентификатор устройства */
	id: number;

	/** Идентификатор оператора */
	operatorId: number;

	/** Название устройства */
	name: string;

	/** Идентификатор группы Forpost */
	forpostGroupId: string;

	/** Идентификатор аккаунта Forpost */
	forpostAccountId: string | null;

	/** Тип устройства */
	type: string;

	/** Разрешено ли открытие двери */
	allowOpen: boolean;

	/** Метод открытия */
	openMethod: string;

	/** Доступно ли видео */
	allowVideo: boolean;

	/** Разрешены ли звонки на мобильный */
	allowCallMobile: boolean;

	/** Доступен ли слайд-шоу режим */
	allowSlideshow: boolean;

	/** Доступно ли превью */
	previewAvailable: boolean;

	/** Доступна ли загрузка видео */
	videoDownloadAvailable: boolean;

	/** Часовой пояс */
	timeZone: number;

	/** Квота */
	quota: number;

	/** Внешний идентификатор камеры */
	externalCameraId: string;

	/** Внешний идентификатор устройства */
	externalDeviceId: string | null;
}
