import type { StreamType } from "./stream-type.js";

export interface VideoStreamInfo {
	/** URL для воспроиз потока */
	url: string;

	/** Тип видеопотока */
	type: StreamType;
}
