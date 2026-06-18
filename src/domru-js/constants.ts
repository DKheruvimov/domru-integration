/** Базовый URL API */
export const BASE_URL = "https://myhome.proptech.ru/";

/** Заголовки по умолчанию */
export const DEFAULT_HEADERS: Record<string, string> = {
	"Content-Type": "application/json; charset=UTF-8",
	Host: "myhome.proptech.ru",
	"User-Agent":
		"Xiaomi MIX2S | Android 10 | erth | 8.26.0 (82600010) | | null | d5c78d0a-9cbe-4bea-b66a-b8296d947b62 | null",
};

/** Префикс для вычисления hash2 при аутентификации */
export const HASH2_PREFIX = "DigitalHomeNTKpassword";

/** Секрет для вычисления hash2 */
export const HASH2_SECRET = "789sdgHJs678wertv34712376";
