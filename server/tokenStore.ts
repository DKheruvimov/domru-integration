import fs from "fs";
import crypto from "crypto";
import { DATA_DIR, TOKENS_FILE } from "./config.js";
import { SavedCredentials } from "./types.js";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSavedTokens(): Record<string, SavedCredentials> {
  ensureDataDir();
  if (!fs.existsSync(TOKENS_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(TOKENS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to load tokens file, resetting:", err);
    return {};
  }
}

export function saveTokens(tokens: Record<string, SavedCredentials>) {
  ensureDataDir();
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save tokens file:", err);
  }
}

export function registerCredentials(creds: SavedCredentials): string {
  const tokenKey = creds.login || creds.phone || "primary_account";
  const tokens = loadSavedTokens();
  const merged = {
    ...(tokens[tokenKey] || {}),
    ...creds
  };
  tokens[tokenKey] = merged;
  tokens["primary_account"] = merged;
  saveTokens(tokens);
  return tokenKey;
}

export function getCredentials(tokenKey: string): SavedCredentials | null {
  const tokens = loadSavedTokens();
  return tokens[tokenKey] || null;
}
