import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { DomruEvent } from "../interfaces/domru-event.js";
import type { TemporalCode } from "../interfaces/temporal-code.js";

/** Получить историю событий для объектов */
export async function getEvents(
	ctx: ClientContext,
	placeIds: number[],
	page = 0,
	sort: "ASC" | "DESC" = "DESC",
): Promise<DomruEvent[]> {
	const res = await requestJson<{ content: DomruEvent[] }>(
		ctx,
		`${BASE_URL}rest/v1/events/search`,
		"POST",
		{ page: String(page), sort: `occurredAt,${sort}` },
		{ placeIds },
	);
	return res.content;
}

/** Получить временные коды доступа */
export async function getTemporalCodes(
	ctx: ClientContext,
	deviceIds: number[],
): Promise<TemporalCode[]> {
	const res = await requestJson<TemporalCode[]>(ctx, `${BASE_URL}rest/v1/temporal-codes`, "GET", {
		accessControlIds: deviceIds.join(","),
	});
	return res;
}
