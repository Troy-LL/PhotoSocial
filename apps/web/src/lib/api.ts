import type { ApiResponse } from "@photosocial/shared";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
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
  }) => request<{
    sessionId: string;
    partyCode: string;
    wsToken: string;
    expiresAt: string;
    participantId: string;
  }>("/sessions", { method: "POST", body: JSON.stringify(body) }),

  joinSession: (body: {
    partyCode: string;
    displayName: string;
    deviceId: string;
  }) =>
    request<{
      sessionId: string;
      participantId: string;
      wsToken: string;
      sessionMeta: unknown;
    }>("/sessions/join", { method: "POST", body: JSON.stringify(body) }),

  getSessionState: (sessionId: string, token: string) =>
    request<import("@photosocial/shared").SessionState>(
      `/sessions/${sessionId}`,
      { headers: authHeaders(token) }
    ),

  assignSlot: (
    sessionId: string,
    token: string,
    body: { participantId: string; slotIndex: number }
  ) =>
    request(`/sessions/${sessionId}/assign-slot`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  setTheme: (
    sessionId: string,
    token: string,
    body: { theme: string; customHue?: number }
  ) =>
    request(`/sessions/${sessionId}/theme`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  lockSession: (sessionId: string, token: string) =>
    request<{ finalCollageUrl: string }>(`/sessions/${sessionId}/lock`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  uploadPhoto: async (sessionId: string, token: string, blob: Blob) => {
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/photos`, {
      method: "POST",
      headers: authHeaders(token),
      body: form,
    });
    return res.json() as Promise<
      ApiResponse<{ photoUrl: string; thumbnailUrl: string }>
    >;
  },

  placeSticker: (
    sessionId: string,
    token: string,
    body: Record<string, unknown>
  ) =>
    request(`/sessions/${sessionId}/stickers`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateSticker: (
    sessionId: string,
    token: string,
    stickerId: string,
    body: Record<string, unknown>
  ) =>
    request(`/sessions/${sessionId}/stickers/${stickerId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  deleteSticker: (sessionId: string, token: string, stickerId: string) =>
    request(`/sessions/${sessionId}/stickers/${stickerId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  sendEmail: (
    sessionId: string,
    token: string,
    body: {
      email: string;
      scope: "full-collage" | "my-tile";
      consentCloudSave: boolean;
    }
  ) =>
    request(`/sessions/${sessionId}/email`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
};

export function photoUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return path;
}
