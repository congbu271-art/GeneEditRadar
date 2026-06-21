import "server-only";

import { isLlmEnabled, llmJson } from "@/lib/llm";
import {
  LLM_REFINABLE_FIELDS,
  NOT_REPORTED,
  buildExtractionSourceFromRadarPaper,
  extractGeneEditingDetailsRuleBased,
  geneEditingExtractionSchema,
  normalizeLlmFieldValue,
  resolveBasePaper,
  type ExtractionSourcePaper,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";

export async function maybeRefineWithLlm(sourcePaper: ExtractionSourcePaper, baseExtraction: GeneEditingExtraction) {
  if (!isLlmEnabled()) {
    return baseExtraction;
  }

  const basePaper = resolveBasePaper(sourcePaper);
  const userPayload = JSON.stringify(
    {
      paper: {
        title: sourcePaper.title,
        abstract: sourcePaper.abstract,
        fullText: sourcePaper.fullText ? sourcePaper.fullText.slice(0, 15000) + "..." : undefined,
        journal: sourcePaper.journal,
        authors: sourcePaper.authors,
        organisms: sourcePaper.organisms,
        editorTypes: sourcePaper.editorTypes,
        publishedAt: sourcePaper.publishedAt,
        appPaper: basePaper
          ? {
              modality: basePaper.modality,
              diseaseArea: basePaper.diseaseArea,
              stage: basePaper.stage,
              geneSymbols: basePaper.geneSymbols,
            }
          : undefined,
      },
      ruleBasedExtraction: baseExtraction,
    },
    null,
    2,
  );

  const parsed = await llmJson({
    system:
      "You extract structured gene-editing paper facts from the provided paper metadata and full text. Never use outside knowledge. If a field is absent or uncertain, return exactly 'not reported'. Be conservative. Respond with a single JSON object matching the requested fields.",
    user: `Extract the gene-editing fields as JSON from the following paper data (including full text if provided):\n${userPayload}`,
    schema: geneEditingExtractionSchema,
    maxTokens: 1000,
    timeoutMs: 15_000,
  });

  if (!parsed) {
    return baseExtraction;
  }

  const merged: GeneEditingExtraction = { ...baseExtraction };

  for (const field of LLM_REFINABLE_FIELDS) {
    const normalizedValue = normalizeLlmFieldValue(parsed[field]);

    if (baseExtraction[field] === NOT_REPORTED && normalizedValue !== NOT_REPORTED) {
      merged[field] = normalizedValue;
    }
  }

  if (LLM_REFINABLE_FIELDS.some((field) => baseExtraction[field] !== merged[field])) {
    merged.extractionMethod = "rule-based+llm";
  }

  return geneEditingExtractionSchema.parse(merged);
}

export async function extractGeneEditingDetails(sourcePaper: ExtractionSourcePaper) {
  const baseExtraction = extractGeneEditingDetailsRuleBased(sourcePaper);

  try {
    return await maybeRefineWithLlm(sourcePaper, baseExtraction);
  } catch {
    return baseExtraction;
  }
}

export { buildExtractionSourceFromRadarPaper, extractGeneEditingDetailsRuleBased };
