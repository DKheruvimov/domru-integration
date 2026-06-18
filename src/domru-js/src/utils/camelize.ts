/** Рекурсивно преобразует snake_case ключи объекта в camelCase */
export function camelizeKeys(obj: unknown): unknown {
	if (Array.isArray(obj)) return obj.map(camelizeKeys);
	if (obj !== null && typeof obj === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
			result[camel] = camelizeKeys(value);
		}
		return result;
	}
	return obj;
}
