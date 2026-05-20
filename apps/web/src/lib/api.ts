import type { ApiResponse } from "@photosocial/shared";
import { partykitHttpOrigin } from "./deploy-config.js";
import { encodePartySlotPhotos } from "./image-data-url.js";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`${partykitHttpOrigin()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 413) {
    return {
      success: false,
      error: {
        code: "PHOTO_TOO_LARGE",
        message:
          "Photo upload is too large for the party server. Try again closer to the camera.",
      },
    };
  }

  if (!res.ok) {
    try {
      return (await res.json()) as ApiResponse<T>;
    } catch {
      return {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: `Request failed (${res.status})`,
        },
      };
    }
  }

  return res.json() as Promise<ApiResponse<T>>;
}

export function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  createSession: (body: {
    hostDeviceId: string;
    hostName: string;
    layout: string;
    theme: string;
    customHue?: number;
  }) =>
    request<{
      sessionId: string;
      partyCode: string;
      wsToken: string;
      expiresAt: string;
      participantId: string;
    }>("/parties/registry/main", {
      method: "POST",
      body: JSON.stringify({ action: "create", ...body }),
    }),

  joinSession: (body: {
    partyCode: string;
    displayName: string;
    deviceId: string;
  }) =>
    request<{
      sessionId: string;
      participantId: string;
      wsToken: string;
      isHost: boolean;
      sessionMeta: unknown;
    }>("/parties/registry/main", {
      method: "POST",
      body: JSON.stringify({ action: "join", ...body }),
    }),

  getSessionState: (sessionId: string, token: string) =>
    request<import("@photosocial/shared").SessionState>(
      `/parties/main/${sessionId}`,
      { method: "GET", headers: authHeaders(token) }
    ),

  assignSlot: (
    sessionId: string,
    token: string,
    body: { participantId: string; slotIndex: number }
  ) =>
    request(`/parties/main/${sessionId}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "assign-slot", ...body }),
    }),

  setTheme: (
    sessionId: string,
    token: string,
    body: { theme: string; customHue?: number }
  ) =>
    request(`/parties/main/${sessionId}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "theme", ...body }),
    }),

  lockSession: (sessionId: string, token: string) =>
    request<{ finalCollageUrl: string }>(`/parties/main/${sessionId}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "lock" }),
    }),

  clearSlotPhoto: (
    sessionId: string,
    token: string,
    body: { slotIndex: number }
  ) =>
    request(`/parties/main/${sessionId}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ action: "clear-photo", ...body }),
    }),

  uploadPhoto: async (
    sessionId: string,
    token: string,
    blob: Blob,
    slotIndex: number
  ) => {
    const { photoDataUrl, thumbDataUrl } = await encodePartySlotPhotos(
      blob,
      slotIndex
    );

    const uploadPart = (body: Record<string, unknown>) =>
      request<{ photoUrl: string; thumbnailUrl: string }>(
        `/parties/main/${sessionId}`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ action: "photos", slotIndex, ...body }),
        }
      );

    const fullRes = await uploadPart({ photoDataUrl });
    if (!fullRes.success) return fullRes;

    return uploadPart({ thumbDataUrl });
  },
};

export function photoUrl(path: string): string {
  return path;
}
