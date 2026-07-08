import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { Camera } from "../interfaces/camera.js";

/** Получить список всех камер Forpost */
export async function getCameras(ctx: ClientContext): Promise<Camera[]> {
	const res = await requestJson<{ data: Camera[] }>(ctx, `${BASE_URL}rest/v1/forpost/cameras`);
	return res.data;
}
