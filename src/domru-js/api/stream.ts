import type { ClientContext } from "../context.js";
import { BASE_URL } from "../constants.js";
import { requestJson } from "../http/client.js";
import type { VideoStreamInfo } from "../interfaces/video-stream-info.js";

/** Константы эндпоинтов видеопотока */
const STREAM_ENDPOINTS = [
	(id: string): string => `${BASE_URL}rest/v1/forpost/cameras/${id}/video`,
	(id: string): string => `${BASE_URL}rest/v2/forpost/cameras/${id}/video`,
] as const;

/** Магические байты JPEG */
const JPEG_MAGIC = [0xff, 0xd8] as const;

/** Определить тип видеопотока по URL */
function detectStreamType(url: string): VideoStreamInfo["type"] {
	if (url.includes(".m3u8")) return "hls";
	if (url.includes("mjpeg")) return "mjpeg";
	if (url.includes("rtsp")) return "rtsp";
	if (url.includes("flv")) return "flv";
	return "unknown";
}

/** Извлечь URL потока из данных ответа */
function extractStreamUrl(data: Record<string, string>): string | undefined {
	// Сначала попробуем найти любое значение, являющееся HLS потоком (содержит .m3u8 или hls)
	for (const key of Object.keys(data)) {
		const val = data[key];
		if (typeof val === "string" && (val.includes(".m3u8") || val.includes("hls"))) {
			return val;
		}
	}

	return (
		data.URL ??
		data.url ??
		data.streamUrl ??
		data.StreamUrl ??
		data.playbackUrl ??
		data.hls ??
		data.m3u8 ??
		data.link ??
		data.src
	);
}

/** Получить URL видеопотока для камеры */
export async function getStreamUrl(
	ctx: ClientContext,
	cameraId: string,
): Promise<VideoStreamInfo | null> {
	for (const buildUrl of STREAM_ENDPOINTS) {
		const url = buildUrl(cameraId);
		ctx.log.debug(`Пробуем эндпоинт: ${url}`);

		try {
			/**
			 * Используем requestJson вместо fetchRaw, так как эндпоинт
			 * возвращает JSON, а не бинарные данные.
			 * Параметр LightStream=0 — полный поток (из Go-репозитория domru).
			 */
			const json = await requestJson<{ data: Record<string, string> }>(ctx, url, "GET", {
				LightStream: "0",
			});

			ctx.log.debug(`Полный ответ: ${JSON.stringify(json, null, 2).substring(0, 1000)}`);

			const inner = json.data ?? {};
			const streamUrl = extractStreamUrl(inner);

			if (!streamUrl) {
				ctx.log.warn(
					`URL потока не найден. Доступные ключи: [${Object.keys(inner).join(", ")}]`,
				);
				continue;
			}

			return { url: streamUrl, type: detectStreamType(streamUrl) };
		} catch (err) {
			ctx.log.debug(`Эндпоинт ${url} не удался: ${String(err)}`);
		}
	}

	ctx.log.error(`Все эндпоинты не удались для камеры ${cameraId}`);
	return null;
}

/** Получить снимок с камеры домофона */
export async function getSnapshot(
	ctx: ClientContext,
	placeId: number,
	deviceId: number,
): Promise<Uint8Array | null> {
	const url = `${BASE_URL}rest/v1/places/${placeId}/accesscontrols/${deviceId}/videosnapshots`;

	try {
		const axios = await import("axios");
		const response = await axios.default.request({
			url,
			method: "GET",
			headers: {
				Authorization: `Bearer ${ctx.accessToken}`,
				Operator: String(ctx.operatorId ?? ""),
			},
			responseType: "arraybuffer",
			timeout: ctx.timeout,
			validateStatus: () => true,
		});

		if (response.status < 200 || response.status >= 300) {
			ctx.log.warn(`Снимок не удался: статус ${response.status}`);
			return null;
		}

		const buf = new Uint8Array(response.data as ArrayBuffer);

		if (buf[0] !== JPEG_MAGIC[0] || buf[1] !== JPEG_MAGIC[1]) {
			ctx.log.warn("Ответ снимка не является корректным JPEG");
			return null;
		}

		return buf;
	} catch (err) {
		ctx.log.warn(`Ошибка получения снимка: ${String(err)}`);
		return null;
	}
}
