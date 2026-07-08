/** Запись кеша с временем истечения */
interface CacheEntry<T> {
	/** Значение */
	value: T;

	/** Время истечения (timestamp) */
	expiresAt: number;
}

/** Кеш запросов с TTL */
export class RequestCache {
	private store = new Map<string, CacheEntry<unknown>>();

	/** Получить значение из кеша */
	get<T>(key: string): T | null {
		const entry = this.store.get(key);
		if (!entry || Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}
		return entry.value as T;
	}

	/** Сохранить значение в кеш */
	set<T>(key: string, value: T, ttlMs: number): void {
		this.store.set(key, {
			value,
			expiresAt: Date.now() + ttlMs,
		});
	}

	/** Очистить записи по паттерну */
	invalidate(pattern: string): void {
		for (const key of this.store.keys()) {
			if (key.includes(pattern)) {
				this.store.delete(key);
			}
		}
	}

	/** Очистить весь кеш */
	clear(): void {
		this.store.clear();
	}
}
