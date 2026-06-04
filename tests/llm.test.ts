import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { extractJsonBlock, isLlmEnabled, llmChat, llmJson } from "../lib/llm";

function withEnv(t: test.TestContext, env: Record<string, string | undefined>) {
  const originals: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    originals[key] = process.env[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  t.after(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function stubFetch(t: test.TestContext, handler: typeof globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}

function chatResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("isLlmEnabled is false without any key and true with LLM_API_KEY", (t) => {
  withEnv(t, { LLM_API_KEY: undefined, OPENAI_API_KEY: undefined });
  assert.equal(isLlmEnabled(), false);

  process.env.LLM_API_KEY = "sk-test";
  assert.equal(isLlmEnabled(), true);
});

test("isLlmEnabled falls back to OPENAI_API_KEY for backward compatibility", (t) => {
  withEnv(t, { LLM_API_KEY: undefined, OPENAI_API_KEY: "sk-legacy" });
  assert.equal(isLlmEnabled(), true);
});

test("llmChat returns null and sends no request when no key is configured", async (t) => {
  withEnv(t, { LLM_API_KEY: undefined, OPENAI_API_KEY: undefined });
  let called = false;
  stubFetch(t, async () => {
    called = true;
    return chatResponse("{}");
  });

  const result = await llmChat({ system: "s", user: "u" });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("extractJsonBlock strips code fences and surrounding noise", () => {
  assert.equal(extractJsonBlock('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonBlock('Here is the result: {"a":1} done'), '{"a":1}');
  assert.equal(extractJsonBlock('```\n[1,2,3]\n```'), "[1,2,3]");
});

test("llmJson parses and validates a well-formed response", async (t) => {
  withEnv(t, { LLM_API_KEY: "sk-test", LLM_BASE_URL: undefined, LLM_MODEL: undefined });
  stubFetch(t, async () => chatResponse('```json\n{"answer":"ok"}\n```'));

  const result = await llmJson({
    system: "s",
    user: "u",
    schema: z.object({ answer: z.string() }),
  });

  assert.deepEqual(result, { answer: "ok" });
});

test("llmJson retries on malformed JSON then returns null", async (t) => {
  withEnv(t, { LLM_API_KEY: "sk-test" });
  let calls = 0;
  stubFetch(t, async () => {
    calls += 1;
    return chatResponse("not json at all");
  });

  const result = await llmJson({
    system: "s",
    user: "u",
    schema: z.object({ answer: z.string() }),
    retries: 1,
  });

  assert.equal(result, null);
  assert.equal(calls, 2); // first attempt + one retry
});

test("llmJson returns null when schema validation fails", async (t) => {
  withEnv(t, { LLM_API_KEY: "sk-test" });
  stubFetch(t, async () => chatResponse('{"answer":42}'));

  const result = await llmJson({
    system: "s",
    user: "u",
    schema: z.object({ answer: z.string() }),
    retries: 0,
  });

  assert.equal(result, null);
});

test("llmJson returns null on network failure", async (t) => {
  withEnv(t, { LLM_API_KEY: "sk-test" });
  stubFetch(t, async () => {
    throw new Error("network down");
  });

  const result = await llmJson({
    system: "s",
    user: "u",
    schema: z.object({ answer: z.string() }),
    retries: 0,
  });

  assert.equal(result, null);
});

test("llmChat returns null on non-2xx response", async (t) => {
  withEnv(t, { LLM_API_KEY: "sk-test" });
  stubFetch(t, async () => new Response("server error", { status: 500 }));

  const result = await llmChat({ system: "s", user: "u" });
  assert.equal(result, null);
});
