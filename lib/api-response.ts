import { NextResponse } from "next/server";

export type ApiErrorResponse = {
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
};

export type ApiSuccessResponse<T> = {
  data: T;
  timestamp?: string;
};

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: statusCode });
}

export function createSuccessResponse<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    data,
    timestamp: new Date().toISOString(),
  });
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("API Error:", error);

  if (error instanceof ApiError) {
    return createErrorResponse(error.message, error.statusCode, error.code, error.details);
  }

  if (error instanceof Error) {
    return createErrorResponse(
      process.env.NODE_ENV === "production"
        ? "服务器内部错误，请稍后重试。"
        : error.message,
      500,
      "INTERNAL_ERROR",
    );
  }

  return createErrorResponse("服务器内部错误，请稍后重试。", 500, "UNKNOWN_ERROR");
}

export function validateRequestBody<T>(
  body: unknown,
  schema: { parse: (data: unknown) => T },
): T {
  try {
    return schema.parse(body);
  } catch (error) {
    throw new ApiError(
      "请求格式不正确。",
      400,
      "VALIDATION_ERROR",
      error instanceof Error ? { message: error.message } : undefined,
    );
  }
}
