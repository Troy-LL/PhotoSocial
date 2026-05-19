import type { ApiError, ApiResponse, ApiSuccess } from "@photosocial/shared";

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function err(code: string, message: string): ApiError {
  return { success: false, error: { code, message } };
}

export type { ApiResponse };
