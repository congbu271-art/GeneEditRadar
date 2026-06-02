import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeResearchInput, normalizeAnalyzeRequest } from "@/lib/analyze";

const analyzeRequestSchema = z.object({
  mode: z.enum(["keyword", "paper"]),
  query: z.string().trim().min(1, "query is required"),
});

export async function POST(request: Request) {
  try {
    const payload = normalizeAnalyzeRequest(analyzeRequestSchema.parse(await request.json()));
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
      {
        error: error instanceof Error ? error.message : "分析请求失败。",
      },
      { status: 500 },
    );
  }
}
