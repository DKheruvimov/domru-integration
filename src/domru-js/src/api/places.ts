import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { SubscriberPlace } from "../interfaces/subscriber-place.js";
import type { Device } from "../interfaces/device.js";

/** Получить список всех объектов абонента */
export async function getSubscriberPlaces(ctx: ClientContext): Promise<SubscriberPlace[]> {
	const res = await requestJson<{ data: SubscriberPlace[] }>(
		ctx,
		`${BASE_URL}rest/v3/subscriber-places`,
	);
	return res.data;
}

/** Получить устройства контроля доступа для объекта */
export async function getDevices(ctx: ClientContext, placeId: number): Promise<Device[]> {
	const res = await requestJson<{ data: Device[] }>(
		ctx,
		`${BASE_URL}rest/v1/places/${placeId}/accesscontrols`,
	);
	return res.data;
}
