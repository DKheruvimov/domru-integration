import path from "path";

// Bypass Russian Trusted CA / invalid / expired self-signed certificates for video streaming subdomains
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export const DATA_DIR = path.join(process.cwd(), "data");
export const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

// Global cache for refreshed tokens to prevent repeated login overhead in subresources / segments
export const tokenCache = new Map<string, { token: string; expiresAt: number }>();
