import type * as Party from "partykit/server";

/** CORS for browser clients (Vercel, local dev, custom domains). */

const LOCAL_ORIGIN = /^http:\/\/localhost(:\d+)?$/;
const VERCEL_ORIGIN = /^https:\/\/[\w.-]+\.vercel\.app$/i;

const BUILTIN_ORIGINS = new Set([
  "https://photosocially.vercel.app",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (BUILTIN_ORIGINS.has(origin)) return true;
  if (LOCAL_ORIGIN.test(origin) || VERCEL_ORIGIN.test(origin)) return true;
  const extra = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? [];
  return extra.includes(origin);
}

export function corsHeaders(request: Party.Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept"
  );
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function handleCorsPreflight(request: Party.Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(request: Party.Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);
  cors.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function withCorsHandler(
  request: Party.Request,
  handler: (request: Party.Request) => Promise<Response> | Response
): Promise<Response> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  try {
    const response = await handler(request);
    return withCors(request, response);
  } catch (error) {
    console.error("[cors] request handler error", error);
    return withCors(
      request,
      Response.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Request failed" },
        },
        { status: 500 }
      )
    );
  }
}
