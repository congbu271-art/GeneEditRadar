import assert from "node:assert/strict";
import test from "node:test";

import { papers } from "../lib/mock-data";
import {
  NOT_REPORTED,
  buildExtractionSourceFromRadarPaper,
  extractGeneEditingDetailsRuleBased,
} from "../lib/paper-extraction";
import { extractGeneEditingDetails } from "../lib/paper-extraction-llm";

test("rule-based extraction captures explicit gene-editing fields from seeded papers", () => {
  const paper = papers.find((item) => item.id === "paper-pcsk9-prime-lnp");
  assert.ok(paper);

  const extraction = extractGeneEditingDetailsRuleBased(buildExtractionSourceFromRadarPaper(paper));

  assert.equal(extraction.editingTool, "prime editor");
  assert.equal(extraction.editorVariant, "modular prime editor payload");
  assert.equal(extraction.editingType, "Prime editing");
  assert.equal(extraction.organism, "Primate");
  assert.equal(extraction.deliveryMethod, "LNP");
  assert.equal(extraction.targetGene, "PCSK9");
  assert.equal(extraction.targetTrait, "PCSK9 knockdown / LDL reduction");
  assert.match(extraction.editingEfficiency, /high-efficiency hepatic editing/i);
  assert.match(extraction.offTargetAnalysis, /off-target profile/i);
  assert.match(extraction.phenotypeValidation, /durable LDL reduction/i);
  assert.equal(extraction.paperType, "preclinical study");
  assert.equal(extraction.extractionMethod, "rule-based");
});

test("rule-based extraction uses not reported for absent fields", () => {
  const extraction = extractGeneEditingDetailsRuleBased({
    id: "sparse-paper",
    title: "Gene editing study in mammalian cells",
    abstract: "The study evaluates a programmable editor in mammalian cells.",
    journal: "Genome Methods",
    authors: ["Pat Doe"],
    organisms: [],
    editorTypes: ["CRISPR"],
  });

  assert.equal(extraction.deliveryMethod, NOT_REPORTED);
  assert.equal(extraction.targetGene, NOT_REPORTED);
  assert.equal(extraction.targetTrait, NOT_REPORTED);
  assert.equal(extraction.offTargetAnalysis, NOT_REPORTED);
  assert.equal(extraction.phenotypeValidation, NOT_REPORTED);
  assert.equal(extraction.limitations, NOT_REPORTED);
  assert.equal(extraction.followUpOpportunities, NOT_REPORTED);
});

test("llm refinement fills only missing fields when OPENAI_API_KEY exists", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_EXTRACTION_MODEL;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_EXTRACTION_MODEL = "gpt-4o-mini";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                editingTool: "wrong tool",
                editorVariant: "custom payload architecture",
                editingType: "Prime editing",
                organism: "Primate",
                deliveryMethod: "not reported",
                targetGene: "not reported",
                targetTrait: "cholesterol lowering",
                editingEfficiency: "not reported",
                offTargetAnalysis: "GUIDE-seq not reported",
                phenotypeValidation: "not reported",
                mainInnovation: "not reported",
                limitations: "not reported",
                paperType: "preclinical study",
                followUpOpportunities: "not reported",
                extractionMethod: "rule-based+llm",
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_EXTRACTION_MODEL;
    } else {
      process.env.OPENAI_EXTRACTION_MODEL = originalModel;
    }
  });

  const extraction = await extractGeneEditingDetails({
    id: "llm-paper",
    title: "Prime editing improves metabolic markers in primates",
    abstract: "Prime editing improved biomarkers in primates after in vivo administration.",
    journal: "Translational Editing",
    authors: ["A. Example"],
    organisms: ["Primate"],
    editorTypes: ["Prime editing"],
  });

  assert.equal(extraction.editingTool, "prime editor");
  assert.equal(extraction.editorVariant, "custom payload architecture");
  assert.equal(extraction.targetTrait, "cholesterol lowering");
  assert.equal(extraction.offTargetAnalysis, NOT_REPORTED);
  assert.equal(extraction.extractionMethod, "rule-based+llm");
});

test("invalid llm output falls back to rule-based extraction after zod validation", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                editingTool: 42,
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  const extraction = await extractGeneEditingDetails({
    id: "invalid-llm-paper",
    title: "Prime editing improves biomarkers in primates",
    abstract: "Prime editing improved biomarkers in primates after in vivo administration.",
    journal: "Translational Editing",
    authors: ["A. Example"],
    organisms: ["Primate"],
    editorTypes: ["Prime editing"],
  });

  assert.equal(extraction.editorVariant, NOT_REPORTED);
  assert.equal(extraction.targetTrait, NOT_REPORTED);
  assert.equal(extraction.extractionMethod, "rule-based");
});
