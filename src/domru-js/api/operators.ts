import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { Operator } from "../interfaces/operator.js";

/** Получить список операторов */
export async function getOperators(ctx: ClientContext): Promise<Operator[]> {
	const res = await requestJson<{ data: Operator[] }>(ctx, `${BASE_URL}public/v1/operators`);
	return res.data;
}
