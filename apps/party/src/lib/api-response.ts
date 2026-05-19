import type { ApiError, ApiSuccess } from "@photosocial/shared";

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function err(code: string, message: string): ApiError {
  return { success: false, error: { code, message } };
}

export function jsonResponse(
  body: ApiSuccess<unknown> | ApiError,
  status = 200
): Response {
  return Response.json(body, { status });
}
