import path from "path";

// Global TLS bypass removed for security, now handled per-request
export const DATA_DIR = path.join(process.cwd(), "data");
export const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

// Global cache for refreshed tokens to prevent repeated login overhead in subresources / segments
export const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export const PORT = Number(process.env.PORT) || 3000;
export const HOST = process.env.HOST || "localhost";
