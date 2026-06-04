import assert from "node:assert/strict";
import test from "node:test";

import { buildFieldOverviewWithLlm, buildPaperInsightsWithLlm } from "../lib/analyze-llm";
import type { AnalyzePaper } from "../lib/analyze-types";

function withKey(t: test.TestContext) {
  const original = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "sk-test";
  t.after(() => {
    if (original === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = original;
    }
  });
}

function stubChat(t: test.TestContext, content: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  t.after(() => {
    globalThis.fetch = original;
  });
}

const samplePaper: AnalyzePaper = {
  id: "p1",
  title: "Prime editing in rice",
  abstract: "We applied prime editing in rice and observed efficient edits.",
  journal: "Plant Cell",
  authors: ["A"],
  doi: "未报道",
  pmid: "未报道",
  publishedAt: "2026-01-01",
  source: "PubMed",
  signalScore: 70,
  reliabilityLabel: "元数据",
};

test("buildFieldOverviewWithLlm returns null when LLM disabled", async (t) => {
  const original = process.env.LLM_API_KEY;
  const originalOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  t.after(() => {
    if (original !== undefined) process.env.LLM_API_KEY = original;
    if (originalOpenAi !== undefined) process.env.OPENAI_API_KEY = originalOpenAi;
  });

  const result = await buildFieldOverviewWithLlm([samplePaper], [], {
    tools: [],
    organisms: [],
    deliveries: [],
    applications: [],
  });
  assert.equal(result, null);
});

test("buildFieldOverviewWithLlm composes a multi-line Chinese overview string", async (t) => {
  withKey(t);
  stubChat(t, {
    currentStatus: "该方向正在快速扩展",
    mainTools: ["先导编辑"],
    mainOrganisms: ["水稻"],
    deliveries: ["农杆菌"],
    applications: ["品质改良"],
    openProblems: ["脱靶评估不足"],
  });

  const result = await buildFieldOverviewWithLlm([samplePaper], [], {
    tools: ["先导编辑（1 篇）"],
    organisms: ["水稻（1 篇）"],
    deliveries: [],
    applications: [],
  });

  assert.ok(result);
  assert.match(result as string, /当前研究状态：该方向正在快速扩展/);
  assert.match(result as string, /潜在研究空白：脱靶评估不足/);
});

test("buildPaperInsightsWithLlm validates path enum and returns structured insights", async (t) => {
  withKey(t);
  stubChat(t, {
    strategySummary: {
      overallStrategy: "策略",
      whyPublishable: "可发表",
      coreInnovation: "创新",
      evidenceChain: ["证据1"],
      limitations: ["局限1"],
    },
    transferPaths: [{ path: "monocot_to_dicot", rationale: "迁移到双子叶", priority: "高" }],
    ideas: [
      {
        path: "monocot_to_dicot",
        title: "迁移到番茄",
        innovationLogic: "逻辑",
        feasibilityRationale: "可行",
        minimumExperimentPackage: ["实验1"],
        riskWarnings: ["风险1"],
      },
    ],
  });

  const result = await buildPaperInsightsWithLlm({
    seed: { title: "t", abstract: "a", journal: "j", organisms: ["rice"], editorTypes: ["Prime editing"] },
    extraction: {},
    relatedPapers: [],
  });

  assert.ok(result);
  assert.equal(result?.transferPaths[0].path, "monocot_to_dicot");
  assert.equal(result?.ideas[0].title, "迁移到番茄");
});

test("buildPaperInsightsWithLlm returns null when LLM emits an invalid path enum", async (t) => {
  withKey(t);
  stubChat(t, {
    strategySummary: { overallStrategy: "s", whyPublishable: "w", coreInnovation: "c", evidenceChain: [], limitations: [] },
    transferPaths: [{ path: "totally_made_up_path", rationale: "x", priority: "高" }],
    ideas: [{ path: "totally_made_up_path", title: "t", innovationLogic: "l", feasibilityRationale: "f", minimumExperimentPackage: [], riskWarnings: [] }],
  });

  const result = await buildPaperInsightsWithLlm({
    seed: { title: "t", abstract: "a", journal: "j", organisms: [], editorTypes: [] },
    extraction: {},
    relatedPapers: [],
  });

  assert.equal(result, null);
});
