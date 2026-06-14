import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeResearchInput, normalizeAnalyzeRequest } from "@/lib/analyze";
import { createErrorResponse, handleApiError } from "@/lib/api-response";

const analyzeRequestSchema = z.object({
  mode: z.enum(["keyword", "paper"]),
  query: z.string().trim().min(1, "query is required").max(2000, "query is too long"),
});

const MAX_BODY_SIZE = 1024 * 4; // 4 KB

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return createErrorResponse("请求体过大。", 413, "PAYLOAD_TOO_LARGE");
    }

    const body = await request.json();

    if (JSON.stringify(body).length > MAX_BODY_SIZE) {
      return createErrorResponse("请求体过大。", 413, "PAYLOAD_TOO_LARGE");
    }

    const payload = normalizeAnalyzeRequest(analyzeRequestSchema.parse(body));
    const result = await analyzeResearchInput(payload);

    return NextResponse.json({
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        "请求格式不正确。",
        400,
        "VALIDATION_ERROR",
        error.flatten(),
      );
    }

    return handleApiError(error);
  }
}
