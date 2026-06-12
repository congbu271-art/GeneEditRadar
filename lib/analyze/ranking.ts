import { NOT_REPORTED, type GeneEditingExtraction } from "@/lib/paper-extraction";
import { normalizeDoi, normalizePmid, type CollectedPaper } from "@/lib/literature";
import {
  canonicalizeJournal,
  normalizeTitle,
  normalizeWhitespace,
  uniqueStrings,
} from "@/lib/shared-utils";
import type { AnalyzeRequestInput, PaperQueryKind } from "@/lib/analyze-types";
import {
  DEFAULT_ANALYSIS_LIMIT,
  type AnalyzePaperQueryResult,
  type PaperQueryDetection,
  type RankedPaper,
} from "./helpers";
import { mockCollectedPapers } from "./search";

export function tokenizeQuery(query: string) {
  return uniqueStrings(normalizeTitle(query).split(" ").filter((token) => token.length >= 2));
}

export function scoreKeywordRelevance(paper: CollectedPaper, query: string) {
  const normalizedQuery = normalizeTitle(query);
  const tokens = tokenizeQuery(query);
  const title = paper.normalizedTitle;
  const abstract = normalizeTitle(paper.abstract);
  const journal = canonicalizeJournal(paper.journal);
  const combined = normalizeTitle(
    [paper.title, paper.abstract, paper.journal, ...paper.authors, ...paper.organisms, ...paper.editorTypes, ...paper.keywords].join(" "),
  );

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 52;
  }

  if (abstract.includes(normalizedQuery)) {
    score += 28;
  }

  if (journal.includes(normalizedQuery)) {
    score += 12;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 11;
    }

    if (abstract.includes(token)) {
      score += 6;
    }

    if (combined.includes(token)) {
      score += 3;
    }
  }

  if (paper.doi && normalizeDoi(query) === paper.doi) {
    score += 80;
  }

  if (paper.pmid && normalizePmid(query) === paper.pmid) {
    score += 80;
  }

  return score + Math.round(paper.signalScore * 0.35);
}

export function scoreTitleReferenceMatch(paper: CollectedPaper, query: string) {
  const normalizedQuery = normalizeTitle(query);
  const title = paper.normalizedTitle;
  const tokens = tokenizeQuery(query);

  if (title === normalizedQuery) {
    return 220;
  }

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 140;
  }

  const matchedTokens = tokens.filter((token) => title.includes(token)).length;
  if (tokens.length > 0) {
    score += Math.round((matchedTokens / tokens.length) * 80);
  }

  return score + Math.round(paper.signalScore * 0.25);
}

export function rankKeywordPapers(collected: CollectedPaper[], query: string, limit = DEFAULT_ANALYSIS_LIMIT) {
  return collected
    .map((paper) => ({ ...paper, relevanceScore: scoreKeywordRelevance(paper, query) }))
    .filter((paper) => paper.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore || right.signalScore - left.signalScore)
    .slice(0, limit);
}

export function rankReferencePapers(collected: CollectedPaper[], detection: PaperQueryDetection, limit = DEFAULT_ANALYSIS_LIMIT) {
  const ranked = collected
    .map((paper) => {
      let relevanceScore = 0;

      if (detection.kind === "doi") {
        relevanceScore = normalizeDoi(paper.doi) === detection.normalizedQuery ? 240 : 0;
      } else if (detection.kind === "pmid") {
        relevanceScore = normalizePmid(paper.pmid) === detection.normalizedQuery ? 240 : 0;
      } else {
        relevanceScore = scoreTitleReferenceMatch(paper, detection.normalizedQuery);
      }

      return { ...paper, relevanceScore };
    })
    .filter((paper) => paper.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore || right.signalScore - left.signalScore);

  return ranked.slice(0, limit);
}

export function withZeroRelevance(paper: CollectedPaper): RankedPaper {
  return {
    ...paper,
    relevanceScore: 0,
  };
}

export function getDefaultLocalPapers(limit = DEFAULT_ANALYSIS_LIMIT) {
  return [...mockCollectedPapers]
    .sort((left, right) => right.signalScore - left.signalScore)
    .slice(0, limit)
    .map(withZeroRelevance);
}

export function searchLocalPapers(query: string, localPapers: CollectedPaper[] = mockCollectedPapers, limit = DEFAULT_ANALYSIS_LIMIT) {
  return rankKeywordPapers(localPapers, query, limit);
}

export function searchMockByKeyword(query: string, limit = DEFAULT_ANALYSIS_LIMIT) {
  return searchLocalPapers(query, mockCollectedPapers, limit);
}

export function searchMockByReference(detection: PaperQueryDetection, limit = DEFAULT_ANALYSIS_LIMIT) {
  return rankReferencePapers(mockCollectedPapers, detection, limit);
}

export function isExactReferenceMatch(paper: CollectedPaper, detection: PaperQueryDetection) {
  if (detection.kind === "doi") {
    return normalizeDoi(paper.doi) === detection.normalizedQuery;
  }

  if (detection.kind === "pmid") {
    return normalizePmid(paper.pmid) === detection.normalizedQuery;
  }

  return normalizeTitle(paper.title) === normalizeTitle(detection.normalizedQuery);
}

export function buildRelatedKeywordFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  return uniqueStrings([
    extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : "",
    extraction.editingType !== NOT_REPORTED ? extraction.editingType : "",
    extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : "",
    paper.title.split(" ").slice(0, 8).join(" "),
  ])
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

export function detectQueryType(query: string): PaperQueryDetection {
  const trimmed = query.trim();
  const normalizedDoi = normalizeDoi(trimmed);
  const normalizedPmid = normalizePmid(trimmed);

  if (normalizedDoi && /\b10\.\d{4,9}\//i.test(trimmed)) {
    return { kind: "doi", normalizedQuery: normalizedDoi };
  }

  if (normalizedPmid && (/^\s*(pmid\s*:)?\s*\d+\s*$/i.test(trimmed) || trimmed.length <= 12)) {
    return { kind: "pmid", normalizedQuery: normalizedPmid };
  }

  return { kind: "title", normalizedQuery: normalizeWhitespace(trimmed) };
}

export const detectPaperReferenceQuery = detectQueryType;

export function normalizeAnalyzeRequest(input: AnalyzeRequestInput): AnalyzeRequestInput {
  const query = normalizeWhitespace(input.query);

  if (!query) {
    throw new Error("查询内容不能为空。");
  }

  return {
    mode: input.mode,
    query,
  };
}
