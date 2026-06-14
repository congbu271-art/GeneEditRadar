import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { POST } from "../app/api/analyze/route";
import { getDefaultResultTab, getResultSectionSequence } from "../components/analysis-workbench";
import {
  analyzeResearchInput,
  buildPaperModeIdeas,
  classifyTechnologyTransferPath,
  detectQueryType,
  searchLocalPapers,
} from "../lib/analyze";
import type { AnalyzeResponse } from "../lib/analyze-types";

function stubExternalFetchFailure(t: test.TestContext) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.startsWith("https://")) {
      throw new Error("network unavailable");
    }

    return originalFetch(input as RequestInfo, init);
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test("detectQueryType recognizes DOI inputs", () => {
  assert.deepEqual(detectQueryType("10.9999/ger.2026.004"), {
    kind: "doi",
    normalizedQuery: "10.9999/ger.2026.004",
  });
});

test("detectQueryType recognizes PMID inputs", () => {
  assert.deepEqual(detectQueryType("PMID:41000004"), {
    kind: "pmid",
    normalizedQuery: "41000004",
  });
});

test("detectQueryType recognizes title inputs", () => {
  assert.deepEqual(detectQueryType("Subretinal base editing of RPE65 corrects inherited blindness"), {
    kind: "title",
    normalizedQuery: "Subretinal base editing of RPE65 corrects inherited blindness",
  });
});

test("searchLocalPapers returns keyword matches from local mock papers", () => {
  const results = searchLocalPapers("prime editing rice");

  assert.ok(results.length > 0);
  assert.ok(results.some((paper) => /prime editing/i.test(paper.title)));
});

test("analysis falls back to mock papers when no direct matches are found", async (t) => {
  stubExternalFetchFailure(t);

  const payload = await analyzeResearchInput({
    mode: "keyword",
    query: "completely unmatched synthetic biology phrase",
  });

  assert.equal(payload.usedFallback, true);
  assert.ok(payload.papers.length > 0);
  assert.ok(payload.warnings.some((warning) => warning.includes("本地模拟文献")));
});

test("api returns the required analysis output shape", async (t) => {
  stubExternalFetchFailure(t);

  const response = await POST(
    new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "keyword", query: "prime editing" }),
    }),
  );

  assert.equal(response.status, 200);

  const json = (await response.json()) as { data: AnalyzeResponse };
  const payload = json.data;

  assert.equal(payload.mode, "keyword");
  assert.equal(payload.query, "prime editing");
  assert.ok(Array.isArray(payload.papers));
  assert.ok(Array.isArray(payload.structuredFeatures));
  assert.equal(typeof payload.fieldOverview, "string");
  assert.ok(Array.isArray(payload.ideas));
  assert.ok(payload.evaluation);
  assert.ok(Array.isArray(payload.journalSuggestions));
  assert.ok(Array.isArray(payload.warnings));
});

test("missing information is normalized to 未报道", async (t) => {
  stubExternalFetchFailure(t);

  const payload = await analyzeResearchInput({
    mode: "paper",
    query: "PMID:41000004",
  });

  assert.ok(payload.structuredFeatures.length > 0);
  assert.ok(payload.structuredFeatures.some((feature) => feature.editingEfficiency === "未报道"));
});

test("classifyTechnologyTransferPath prioritizes animal or mammalian PE adaptation into plants", () => {
  const paths = classifyTechnologyTransferPath(
    {
      title: "Engineered prime editor architecture boosts editing in mammalian cells",
      abstract: "The study optimized a prime editor in human cells with stronger scaffold engineering and improved architecture.",
      organisms: ["Human"],
      editorTypes: ["Prime editing"],
      geneSymbols: ["PCSK9"],
      modality: "Prime editing",
      diseaseArea: "Gene editing",
      stage: "Preclinical",
    },
    {
      editingTool: "prime editor",
      editorVariant: "engineered PE variant",
      editingType: "Prime editing",
      organism: "Human",
      deliveryMethod: "not reported",
      targetGene: "PCSK9",
      targetTrait: "not reported",
      mainInnovation: "optimized prime editor architecture",
      limitations: "not reported",
      paperType: "platform study",
      offTargetAnalysis: "not reported",
      phenotypeValidation: "not reported",
    },
  );

  assert.equal(paths[0]?.path, "mammalian_cell_to_plant");
  assert.equal(paths[0]?.priority, "高");
  assert.ok(paths.some((path) => path.path === "animal_to_plant"));
});

test("classifyTechnologyTransferPath prioritizes rice PE extension toward dicot and crop transfer", () => {
  const paths = classifyTechnologyTransferPath(
    {
      title: "Prime editing in rice enables targeted promoter rewiring",
      abstract: "A rice prime editing strategy improves plant editing outcomes in Oryza sativa.",
      organisms: ["Rice"],
      editorTypes: ["Prime editing"],
      geneSymbols: ["Wx"],
      modality: "Prime editing",
      diseaseArea: "Plant biotechnology",
      stage: "Preclinical",
    },
    {
      editingTool: "prime editor",
      editorVariant: "PEmax",
      editingType: "Prime editing",
      organism: "Rice",
      deliveryMethod: "Agrobacterium-mediated transformation",
      targetGene: "Wx",
      targetTrait: "grain quality",
      mainInnovation: "optimized rice PE architecture",
      limitations: "not reported",
      paperType: "platform study",
      offTargetAnalysis: "not reported",
      phenotypeValidation: "grain quality validation",
    },
  );

  assert.equal(paths[0]?.path, "monocot_to_dicot");
  assert.ok(paths.some((path) => path.path === "crop_to_crop" && path.priority === "高"));
});

test("trait application paper suggests orthologous trait transfer and multiplex follow-up", () => {
  const paths = classifyTechnologyTransferPath(
    {
      title: "Base editing in tomato improves fruit shelf life through trait-focused promoter rewiring",
      abstract: "A tomato trait application study with phenotype validation and crop-level readouts.",
      organisms: ["Tomato"],
      editorTypes: ["Base editing"],
      geneSymbols: ["RIN"],
      modality: "Base editing",
      diseaseArea: "Plant biotechnology",
      stage: "Preclinical",
    },
    {
      editingTool: "base editor",
      editorVariant: "CBE",
      editingType: "Base editing",
      organism: "Tomato",
      deliveryMethod: "stable transformation",
      targetGene: "RIN",
      targetTrait: "fruit shelf life",
      mainInnovation: "trait-focused promoter editing",
      limitations: "single target validation only",
      paperType: "trait application study",
      offTargetAnalysis: "not reported",
      phenotypeValidation: "fruit shelf life phenotype validated",
    },
  );

  assert.ok(paths.some((path) => path.path === "tool_to_trait"));
  assert.ok(paths.some((path) => path.path === "crop_to_crop"));
});

test("paper-mode ideas are ranked by realistic transfer priority", async (t) => {
  stubExternalFetchFailure(t);

  const payload = await analyzeResearchInput({
    mode: "paper",
    query: "Programmable liver prime editing with tropism-tuned LNPs achieves durable PCSK9 knockdown in primates",
  });

  assert.equal(payload.mode, "paper");
  assert.ok(payload.ideas.length > 0);
  assert.equal(payload.ideas[0]?.priority, "高");
  assert.ok(payload.ideas[0]?.transferPath.includes("植物体系"));
});

test("paperStrategySummary is returned with the required shape", async (t) => {
  stubExternalFetchFailure(t);

  const payload = await analyzeResearchInput({
    mode: "paper",
    query: "10.9999/ger.2026.004",
  });

  assert.ok(payload.paperStrategySummary);
  assert.equal(typeof payload.paperStrategySummary?.overallStrategy, "string");
  assert.equal(typeof payload.paperStrategySummary?.whyPublishable, "string");
  assert.equal(typeof payload.paperStrategySummary?.coreInnovation, "string");
  assert.ok(Array.isArray(payload.paperStrategySummary?.evidenceChain));
  assert.ok(Array.isArray(payload.paperStrategySummary?.limitations));
});

test("paper-mode API response includes strategy summary and transfer paths", async (t) => {
  stubExternalFetchFailure(t);

  const response = await POST(
    new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "paper",
        query: "Subretinal base editing of RPE65 corrects inherited blindness with low inflammatory burden",
      }),
    }),
  );

  assert.equal(response.status, 200);

  const json = (await response.json()) as { data: AnalyzeResponse };
  const payload = json.data;

  assert.equal(payload.mode, "paper");
  assert.ok(payload.seedPaper);
  assert.ok(payload.paperStrategySummary);
  assert.ok(Array.isArray(payload.technologyTransferPaths));
  assert.ok((payload.technologyTransferPaths?.length ?? 0) > 0);
});

test("rice PE paper produces dicot or crop adaptation ideas", () => {
  const seedPaper = {
    id: "seed-rice-pe",
    slug: "seed-rice-pe",
    title: "Prime editing in rice enables targeted promoter rewiring",
    abstract: "A rice prime editing strategy improves plant editing outcomes in Oryza sativa and supports cross-crop deployment.",
    publishedAt: "2026-01-01",
    doi: "未报道",
    modality: "Prime editing",
    diseaseArea: "Plant biotechnology",
    stage: "Preclinical" as const,
    compositeScore: 84,
    journalSlug: "未报道",
    geneSymbols: ["Wx"],
    topicSlugs: ["base-editing"],
    organisms: ["Rice"],
    editorTypes: ["Prime editing"],
  };
  const extraction = {
    editingTool: "prime editor",
    editorVariant: "PEmax",
    editingType: "Prime editing",
    organism: "Rice",
    deliveryMethod: "Agrobacterium-mediated transformation",
    targetGene: "Wx",
    targetTrait: "grain quality",
    editingEfficiency: "未报道",
    offTargetAnalysis: "not reported",
    phenotypeValidation: "grain quality validation",
    mainInnovation: "optimized rice PE architecture",
    limitations: "not reported",
    paperType: "platform study",
    followUpOpportunities: "not reported",
    extractionMethod: "rule-based" as const,
  };
  const paths = classifyTechnologyTransferPath(seedPaper, extraction);
  const ideas = buildPaperModeIdeas(seedPaper, extraction, paths);

  assert.ok(ideas.some((idea) => /番茄|大豆|小麦|玉米/.test(idea.name)));
});

test("tomato trait-editing paper produces related crop transfer ideas", async (t) => {
  stubExternalFetchFailure(t);

  const payload = await analyzeResearchInput({
    mode: "paper",
    query: "Multiplex gene editing enables the multibiofortification of essential vitamins and other health-promoting phytonutrients in tomato",
  });

  assert.equal(payload.mode, "paper");
  assert.ok(payload.paperStrategySummary);
  assert.ok((payload.technologyTransferPaths?.length ?? 0) > 0);
  assert.ok(payload.ideas.some((idea) => /辣椒|马铃薯|茄子|多作物|通路级/.test(idea.name) || /辣椒|马铃薯|茄子|相关作物|通路级/.test(idea.innovationLogic)));
});

test("paper mode defaults to strategy-first and idea-first navigation", () => {
  assert.equal(getDefaultResultTab("paper"), "ideas");
  assert.deepEqual(getResultSectionSequence("paper", true).slice(0, 4), ["文献策略解读", "最优衍生方向", "衍生选题", "相关文献"]);
});

test("paper-mode lead sections are ordered before related papers in rendered sequence helper", () => {
  const html = renderToStaticMarkup(React.createElement("div", null, getResultSectionSequence("paper", true).join(" | ")));

  assert.ok(html.indexOf("文献策略解读") < html.indexOf("相关文献"));
});
