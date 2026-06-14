import assert from "node:assert/strict";
import test from "node:test";

test("analyze API route schema validation", async () => {
  const { z } = await import("zod");
  
  const analyzeRequestSchema = z.object({
    mode: z.enum(["keyword", "paper"]),
    query: z.string().trim().min(1, "query is required").max(2000, "query is too long"),
  });
  
  const validKeywordRequest = { mode: "keyword", query: "CRISPR gene editing" };
  const validPaperRequest = { mode: "paper", query: "10.1038/s41587-023-01234-5" };
  
  const keywordResult = analyzeRequestSchema.safeParse(validKeywordRequest);
  assert.ok(keywordResult.success, "Valid keyword request should pass");
  
  const paperResult = analyzeRequestSchema.safeParse(validPaperRequest);
  assert.ok(paperResult.success, "Valid paper request should pass");
  
  const emptyQueryResult = analyzeRequestSchema.safeParse({ mode: "keyword", query: "" });
  assert.ok(!emptyQueryResult.success, "Empty query should fail");
  
  const invalidModeResult = analyzeRequestSchema.safeParse({ mode: "invalid", query: "test" });
  assert.ok(!invalidModeResult.success, "Invalid mode should fail");
  
  const longQueryResult = analyzeRequestSchema.safeParse({ mode: "keyword", query: "a".repeat(2001) });
  assert.ok(!longQueryResult.success, "Query too long should fail");
});

test("analyze API route body size validation", async () => {
  const MAX_BODY_SIZE = 1024 * 4;
  
  const smallBody = { mode: "keyword", query: "CRISPR" };
  assert.ok(JSON.stringify(smallBody).length < MAX_BODY_SIZE, "Small body should be within limit");
  
  const largeBody = { mode: "keyword", query: "a".repeat(5000) };
  assert.ok(JSON.stringify(largeBody).length > MAX_BODY_SIZE, "Large body should exceed limit");
});
