/** Хеш SHA-1 → base64 (кодировка ISO-8859-1, использует Web Crypto) */
export async function sha1Base64(input: string): Promise<string> {
	const bytes = new Uint8Array([...input].map((c) => c.charCodeAt(0) & 0xff));
	const hash = await crypto.subtle.digest("SHA-1", bytes);
	return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/** Хеш MD5 → hex. Чистый JavaScript, так как Web Crypto не поддерживает MD5 */
export function md5Hex(input: string): string {
	return md5(new TextEncoder().encode(input));
}

/** Реализация MD5 по RFC 1321 */
function md5(input: Uint8Array): string {
	const S = [
		7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5,
		9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10,
		15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
	];
	const K = Array.from(
		{ length: 64 },
		(_, i) => Math.floor(2 ** 32 * Math.abs(Math.sin(i + 1))) >>> 0,
	);

	const origLen = input.length;
	const padLen = (origLen + 9 + 63) & ~63;
	const buf = new Uint8Array(padLen);
	buf.set(input);
	buf[origLen] = 0x80;
	const view = new DataView(buf.buffer);
	view.setUint32(padLen - 8, (origLen * 8) >>> 0, true);
	view.setUint32(padLen - 4, Math.floor((origLen * 8) / 2 ** 32) >>> 0, true);

	let a0 = 0x67452301 >>> 0;
	let b0 = 0xefcdab89 >>> 0;
	let c0 = 0x98badcfe >>> 0;
	let d0 = 0x10325476 >>> 0;

	for (let offset = 0; offset < padLen; offset += 64) {
		const M = Array.from({ length: 16 }, (_, i) => view.getUint32(offset + i * 4, true));
		let A = a0,
			B = b0,
			C = c0,
			D = d0;

		for (let i = 0; i < 64; i++) {
			let F: number, g: number;
			if (i < 16) {
				F = (B & C) | (~B & D);
				g = i;
			} else if (i < 32) {
				F = (D & B) | (~D & C);
				g = (5 * i + 1) % 16;
			} else if (i < 48) {
				F = B ^ C ^ D;
				g = (3 * i + 5) % 16;
			} else {
				F = C ^ (B | ~D);
				g = (7 * i) % 16;
			}

			F = (F + A + K[i]! + M[g]!) >>> 0;
			A = D;
			D = C;
			C = B;
			B = (B + ((F << S[i]!) | (F >>> (32 - S[i]!)))) >>> 0;
		}

		a0 = (a0 + A) >>> 0;
		b0 = (b0 + B) >>> 0;
		c0 = (c0 + C) >>> 0;
		d0 = (d0 + D) >>> 0;
	}

	const hex = (n: number): string =>
		Array.from({ length: 4 }, (_, i) =>
			((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0"),
		).join("");

	return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}
