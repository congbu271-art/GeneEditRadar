import "server-only";

import { z } from "zod";

/**
 * 统一 LLM 客户端（仅服务端使用）。
 *
 * 采用 OpenAI 兼容的 Chat Completions 接口，可通过环境变量切换供应商：
 * 默认指向 DeepSeek，也可改为 OpenAI、通义千问、智谱 GLM、Kimi 等。
 *
 * 设计原则：
 * - 未配置 API key 时 `isLlmEnabled()` 返回 false，整个分析链路回退到规则引擎。
 * - 任何网络/解析/校验失败都不会抛出到调用方，统一吞错返回 null，由上层回退。
 * - 绝不打印 key；变量不加 NEXT_PUBLIC_ 前缀，避免泄露到前端。
 */

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT_MS = 20_000;

function readApiKey(): string {
  // 新变量优先，向后兼容旧的 OPENAI_API_KEY。
  return (process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
}

function readBaseUrl(): string {
  const raw = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).trim();
  // 去掉结尾斜杠，统一拼接。
  return raw.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

function readModel(): string {
  return (process.env.LLM_MODEL ?? process.env.OPENAI_EXTRACTION_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/** 是否已配置可用的 LLM（存在非空 key）。无 key 时全链路走规则引擎。 */
export function isLlmEnabled(): boolean {
  return readApiKey().length > 0;
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export type LlmChatParams = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** 期望 JSON 输出时设为 true，请求 response_format=json_object。 */
  json?: boolean;
  signal?: AbortSignal;
};

class RetryableLlmError extends Error {}

/**
 * 发起一次 Chat Completions 调用，返回模型文本；任何失败返回 null。
 * 内部不重试（由 llmJson 负责重试编排）。
 */
export async function llmChat(params: LlmChatParams): Promise<string | null> {
  const apiKey = readApiKey();

  if (!apiKey) {
    return null;
  }

  const { system, user, maxTokens, temperature = 0.2, timeoutMs = DEFAULT_TIMEOUT_MS, json = false, signal } = params;

  const body: Record<string, unknown> = {
    model: readModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
  };

  if (typeof maxTokens === "number") {
    body.max_tokens = maxTokens;
  }

  if (json) {
    // json_object 各家通用（DeepSeek/通义/智谱/Kimi/OpenAI）；不用 OpenAI 专有 json_schema strict。
    body.response_format = { type: "json_object" };
  }

  const composedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${readBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: composedSignal,
    });
  } catch {
    // 网络错误 / 超时。
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: ChatCompletionResponse;

  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    return null;
  }

  const content = payload.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim().length > 0 ? content.trim() : null;
}

/**
 * 调用 LLM 生成文本向量 (Embedding)。任何失败返回 null。
 * 默认使用 OpenAI text-embedding-3-small。
 */
export async function llmEmbedding(text: string): Promise<number[] | null> {
  const apiKey = readApiKey();

  if (!apiKey || !text.trim()) {
    return null;
  }

  // Embedding 接口通常与 Chat 接口不同（如 DeepSeek 暂无 Embedding），允许独立配置。
  const baseUrl = (process.env.LLM_EMBEDDING_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  const model = (process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small").trim();

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return payload.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * 从模型输出中剥离可能的 ```json 围栏与首尾噪声，提取最外层 JSON 对象/数组文本。
 */
export function extractJsonBlock(raw: string): string {
  let text = raw.trim();

  // 去除 ```json ... ``` 或 ``` ... ``` 围栏。
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 截取第一个 { 或 [ 到对应的最后一个 } 或 ]。
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start =
    firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);

  if (start === -1) {
    return text;
  }

  const opensWithObject = text[start] === "{";
  const lastClose = opensWithObject ? text.lastIndexOf("}") : text.lastIndexOf("]");

  if (lastClose > start) {
    return text.slice(start, lastClose + 1);
  }

  return text.slice(start);
}

export type LlmJsonParams<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** 解析/校验失败时的重试次数（不含首次）。默认 1。 */
  retries?: number;
  signal?: AbortSignal;
};

/**
 * 调用 LLM 并解析为符合 schema 的结构化对象。任何失败（含解析/校验/网络/超时）返回 null。
 * 解析或校验失败会重试 `retries` 次。
 */
export async function llmJson<T>(params: LlmJsonParams<T>): Promise<T | null> {
  const { schema, retries = 1, ...rest } = params;

  if (!isLlmEnabled()) {
    return null;
  }

  const attempts = Math.max(0, retries) + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await llmChat({ ...rest, json: true });

      if (!raw) {
        // 网络/超时类失败：可重试。
        throw new RetryableLlmError("empty response");
      }

      const parsed = JSON.parse(extractJsonBlock(raw));
      const result = schema.safeParse(parsed);

      if (result.success) {
        return result.data;
      }

      // 校验失败：可重试。
      throw new RetryableLlmError("schema validation failed");
    } catch (error) {
      const isLast = attempt === attempts - 1;

      if (isLast || !(error instanceof RetryableLlmError || error instanceof SyntaxError)) {
        return null;
      }
      // 否则继续下一次尝试。
    }
  }

  return null;
}
