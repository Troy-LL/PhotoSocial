import type { WsEventType } from "@photosocial/shared";
import { config } from "../config.js";

function partykitBaseUrl(): string | null {
  const host = config.partykitHost.trim();
  if (!host) return null;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host.replace(/\/$/, "");
  }
  return `https://${host.replace(/\/$/, "")}`;
}

export async function broadcast<T>(
  sessionId: string,
  type: WsEventType,
  payload: T
): Promise<void> {
  const base = partykitBaseUrl();
  if (!base) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[party-broadcast]", sessionId, type);
    }
    return;
  }

  const url = `${base}/parties/main/${sessionId}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.partykitBroadcastSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      console.error("[party-broadcast] failed", sessionId, type, res.status);
    }
  } catch (e) {
    console.error("[party-broadcast] error", sessionId, type, e);
  }
}
