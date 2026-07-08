export interface Address {
	/** Почтовый индекс */
	index: string | null;

	/** Регион */
	region: string | null;

	/** Район */
	district: string | null;

	/** Город */
	city: string | null;

	/** Населённый пункт */
	locality: string | null;

	/** Улица */
	street: string | null;

	/** Дом */
	house: string | null;

	/** Строение */
	building: string | null;

	/** Квартира */
	apartment: string | null;

	/** Видимый адрес */
	visibleAddress: string | null;

	/** Название группы */
	groupName: string | null;
}
