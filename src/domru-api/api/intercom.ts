import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { OpenResult } from "../interfaces/open-result.js";

/** Открыть дверь домофона */
export async function openDoor(
	ctx: ClientContext,
	placeId: number,
	deviceId: number,
): Promise<OpenResult> {
	const res = await requestJson<{ data: OpenResult }>(
		ctx,
		`${BASE_URL}rest/v1/places/${placeId}/accesscontrols/${deviceId}/actions`,
		"POST",
		undefined,
		{ name: "accessControlOpen" },
	);
	return res.data;
}
