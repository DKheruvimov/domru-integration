import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { Finances } from "../interfaces/finances.js";

/** Получить финансовые данные аккаунта */
export async function getFinances(ctx: ClientContext): Promise<Finances> {
	return requestJson<Finances>(ctx, `${BASE_URL}rest/v1/subscribers/profiles/finances`);
}
