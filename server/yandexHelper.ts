import express from "express";
import { PORT } from "./config.js";

// Helper for Yandex Smart Home Request ID extraction
export const getRequestId = (req: express.Request): string => {
  return (req.headers["x-request-id"] || req.headers["X-Request-Id"] || "") as string;
};

// Helper to construct fully qualified stream URLs in production environment
export const getBaseUrl = (req: express.Request) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = (req.secure || req.headers["x-forwarded-proto"] === "https" || (!host.includes("localhost") && !host.includes("127.0.0.1"))) ? "https" : "http";
  return `${protocol}://${host}`;
};

export const getProxiedStreamUrl = (req: express.Request, targetUrl: string, client: any): string => {
  let filename = "index.m3u8";
  try {
    const parsed = new URL(targetUrl);
    const last = parsed.pathname.substring(parsed.pathname.lastIndexOf("/") + 1);
    if (last) {
      filename = last;
    }
  } catch {}

  let proxiedUrl = `${getBaseUrl(req)}/api/domru/stream-proxy/${filename}?url=${encodeURIComponent(targetUrl)}`;
  const token = client.token;
  const operatorId = client.refreshData.operatorId;
  const refreshToken = client.refreshData.refreshToken;

  if (token) proxiedUrl += `&token=${encodeURIComponent(token)}`;
  if (operatorId) proxiedUrl += `&operatorId=${encodeURIComponent(operatorId)}`;
  if (refreshToken) proxiedUrl += `&refreshToken=${encodeURIComponent(refreshToken)}`;
  return proxiedUrl;
};
