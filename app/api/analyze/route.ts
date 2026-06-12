import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeResearchInput, normalizeAnalyzeRequest } from "@/lib/analyze";

const analyzeRequestSchema = z.object({
  mode: z.enum(["keyword", "paper"]),
  query: z.string().trim().min(1, "query is required").max(2000, "query is too long"),
});

const MAX_BODY_SIZE = 1024 * 4; // 4 KB

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "请求体过大。" }, { status: 413 });
    }

    const body = await request.json();

    if (JSON.stringify(body).length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "请求体过大。" }, { status: 413 });
    }

    const payload = normalizeAnalyzeRequest(analyzeRequestSchema.parse(body));
    const result = await analyzeResearchInput(payload);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "请求格式不正确。",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "分析请求失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
