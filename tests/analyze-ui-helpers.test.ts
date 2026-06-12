import assert from "node:assert/strict";
import test from "node:test";

import {
  NOT_REPORTED,
  getDefaultResultTab,
  getResultSectionSequence,
  truncateText,
  toStringOrNotReported,
  toStringArray,
  isPresent,
  splitBadgeValues,
  collectTopFeatureValues,
  normalizePaper,
  normalizeFeature,
  normalizeEvaluation,
  normalizeAnalyzeResponse,
  getMatchedReason,
  getTransferPathIdea,
} from "../lib/analyze-ui-helpers";
import type { AnalyzeResponse, GeneEditingFeature } from "../lib/analyze-types";

test("getDefaultResultTab returns ideas for paper mode and papers for keyword mode", () => {
  assert.equal(getDefaultResultTab("paper"), "ideas");
  assert.equal(getDefaultResultTab("keyword"), "papers");
});

test("getResultSectionSequence orders strategy-first for paper mode with strategy summary", () => {
  const sequence = getResultSectionSequence("paper", true);
  assert.equal(sequence[0], "文献策略解读");
  assert.equal(sequence[1], "最优衍生方向");
  assert.ok(sequence.includes("衍生选题"));
  assert.ok(sequence.includes("相关文献"));
});

test("getResultSectionSequence omits strategy sections when no summary", () => {
  const sequence = getResultSectionSequence("paper", false);
  assert.equal(sequence[0], "衍生选题");
  assert.ok(!sequence.includes("文献策略解读"));
});

test("getResultSectionSequence uses default order for keyword mode", () => {
  const sequence = getResultSectionSequence("keyword", false);
  assert.equal(sequence[0], "相关文献");
  assert.equal(sequence[1], "领域概览");
  assert.ok(sequence.includes("衍生选题"));
});

test("truncateText returns NOT_REPORTED for empty string", () => {
  assert.equal(truncateText(""), NOT_REPORTED);
  assert.equal(truncateText(NOT_REPORTED), NOT_REPORTED);
});

test("truncateText preserves short text", () => {
  assert.equal(truncateText("short text"), "short text");
});

test("truncateText truncates long text with ellipsis", () => {
  const longText = "a".repeat(300);
  const result = truncateText(longText, 100);
  assert.ok(result.length < 300);
  assert.ok(result.endsWith("..."));
});

test("toStringOrNotReported returns trimmed string for valid input", () => {
  assert.equal(toStringOrNotReported("hello"), "hello");
  assert.equal(toStringOrNotReported("  hello  "), "hello");
});

test("toStringOrNotReported returns NOT_REPORTED for non-string input", () => {
  assert.equal(toStringOrNotReported(null), NOT_REPORTED);
  assert.equal(toStringOrNotReported(undefined), NOT_REPORTED);
  assert.equal(toStringOrNotReported(123), NOT_REPORTED);
  assert.equal(toStringOrNotReported(""), NOT_REPORTED);
  assert.equal(toStringOrNotReported("  "), NOT_REPORTED);
});

test("toStringArray returns normalized string array", () => {
  assert.deepEqual(toStringArray(["a", "b"]), ["a", "b"]);
  assert.deepEqual(toStringArray(["  a  ", "b "]), ["a", "b"]);
});

test("toStringArray returns fallback for non-array input", () => {
  assert.deepEqual(toStringArray(null), [NOT_REPORTED]);
  assert.deepEqual(toStringArray("string"), [NOT_REPORTED]);
  assert.equal(JSON.stringify(toStringArray([])), JSON.stringify([NOT_REPORTED]));
  assert.equal(toStringArray([])[0], NOT_REPORTED);
});

test("isPresent filters null and undefined", () => {
  assert.ok(isPresent(0));
  assert.ok(isPresent(""));
  assert.ok(isPresent(false));
  assert.ok(!isPresent(null));
  assert.ok(!isPresent(undefined));
});

test("splitBadgeValues splits by semicolon, comma, and Chinese punctuation", () => {
  assert.deepEqual(splitBadgeValues("CRISPR;Cas9"), ["CRISPR", "Cas9"]);
  assert.deepEqual(splitBadgeValues("CRISPR,Cas9"), ["CRISPR", "Cas9"]);
  assert.deepEqual(splitBadgeValues("CRISPR，Cas9"), ["CRISPR", "Cas9"]);
  assert.deepEqual(splitBadgeValues("CRISPR；Cas9"), ["CRISPR", "Cas9"]);
  assert.deepEqual(splitBadgeValues("CRISPR、Cas9"), ["CRISPR", "Cas9"]);
});

test("splitBadgeValues excludes NOT_REPORTED values", () => {
  assert.deepEqual(splitBadgeValues(`CRISPR;${NOT_REPORTED}`), ["CRISPR"]);
  assert.deepEqual(splitBadgeValues(NOT_REPORTED), []);
});

test("collectTopFeatureValues returns top N values by frequency", () => {
  const features: GeneEditingFeature[] = [
    { editingTool: "CRISPR", organism: "rice" } as GeneEditingFeature,
    { editingTool: "CRISPR", organism: "wheat" } as GeneEditingFeature,
    { editingTool: "Cas9", organism: "rice" } as GeneEditingFeature,
  ];
  const topTools = collectTopFeatureValues(features, "editingTool", 2);
  assert.equal(topTools[0], "CRISPR");
  assert.equal(topTools.length, 2);
});

test("normalizePaper returns null for invalid input", () => {
  assert.equal(normalizePaper(null), null);
  assert.equal(normalizePaper(undefined), null);
  assert.equal(normalizePaper("string"), null);
});

test("normalizePaper normalizes valid paper object", () => {
  const paper = normalizePaper({
    id: "1",
    title: "Test Paper",
    abstract: "Abstract",
    journal: "Nature",
    authors: ["Author1"],
    doi: "10.1234/test",
    pmid: "12345",
    publishedAt: "2024-01-01",
    url: "https://example.com",
    source: "PubMed",
    signalScore: 8.5,
  });
  assert.ok(paper);
  assert.equal(paper!.id, "1");
  assert.equal(paper!.title, "Test Paper");
  assert.equal(paper!.reliabilityLabel, "元数据");
});

test("normalizePaper uses defaults for missing fields", () => {
  const paper = normalizePaper({});
  assert.ok(paper);
  assert.equal(paper!.id, NOT_REPORTED);
  assert.deepEqual(paper!.authors, [NOT_REPORTED]);
  assert.equal(paper!.signalScore, 0);
});

test("normalizeFeature returns null for invalid input", () => {
  assert.equal(normalizeFeature(null), null);
  assert.equal(normalizeFeature(undefined), null);
});

test("normalizeFeature normalizes valid feature object", () => {
  const feature = normalizeFeature({
    paperId: "1",
    editingTool: "CRISPR",
    organism: "rice",
  });
  assert.ok(feature);
  assert.equal(feature!.paperId, "1");
  assert.equal(feature!.editingTool, "CRISPR");
  assert.equal(feature!.reliabilityLabel, "规则解析");
});

test("normalizeEvaluation returns defaults for invalid input", () => {
  const evaluation = normalizeEvaluation(null);
  assert.equal(evaluation.targetIdeaName, NOT_REPORTED);
  assert.equal(evaluation.novelty, 0);
  assert.equal(evaluation.reliabilityLabel, "启发式评分");
});

test("normalizeEvaluation normalizes valid evaluation object", () => {
  const evaluation = normalizeEvaluation({
    targetIdeaName: "Test Idea",
    novelty: 8,
    feasibility: 7,
    publicationPotential: 9,
    competitionRisk: 3,
    articleType: "Research Article",
    journalTier: "Q1",
  });
  assert.equal(evaluation.targetIdeaName, "Test Idea");
  assert.equal(evaluation.novelty, 8);
  assert.equal(evaluation.competitionRisk, 3);
});

test("normalizeAnalyzeResponse normalizes complete response", () => {
  const response = normalizeAnalyzeResponse({
    mode: "keyword",
    query: "CRISPR rice",
    papers: [
      { id: "1", title: "Paper 1" },
      { id: "2", title: "Paper 2" },
    ],
    structuredFeatures: [
      { paperId: "1", editingTool: "CRISPR" },
    ],
    ideas: [
      { id: "1", name: "Idea 1", priority: "高" },
    ],
    evaluation: { novelty: 8 },
    fieldOverview: "Test overview",
  });
  assert.equal(response.mode, "keyword");
  assert.equal(response.query, "CRISPR rice");
  assert.equal(response.papers.length, 2);
  assert.equal(response.structuredFeatures.length, 1);
  assert.equal(response.ideas.length, 1);
  assert.equal(response.fieldOverview, "Test overview");
});

test("normalizeAnalyzeResponse filters features without matching paper ids", () => {
  const response = normalizeAnalyzeResponse({
    papers: [{ id: "1", title: "Paper 1" }],
    structuredFeatures: [
      { paperId: "1", editingTool: "CRISPR" },
      { paperId: "999", editingTool: "Cas9" },
    ],
  });
  assert.equal(response.structuredFeatures.length, 1);
});

test("normalizeAnalyzeResponse handles empty/invalid input", () => {
  const response = normalizeAnalyzeResponse(null);
  assert.equal(response.mode, "keyword");
  assert.equal(response.papers.length, 0);
  assert.equal(response.ideas.length, 0);
  assert.equal(response.fieldOverview, NOT_REPORTED);
});

test("getMatchedReason returns seed paper reason for paper mode index 0", () => {
  const reason = getMatchedReason(
    "paper",
    { id: "1", title: "Test" } as AnalyzeResponse["papers"][number],
    undefined,
    0,
    "doi",
  );
  assert.ok(reason.includes("DOI"));
  assert.ok(reason.includes("种子文献"));
});

test("getMatchedReason returns intersection reason for paper mode index > 0", () => {
  const feature = { editingTool: "CRISPR", organism: "rice" } as GeneEditingFeature;
  const reason = getMatchedReason(
    "paper",
    { id: "1", title: "Test" } as AnalyzeResponse["papers"][number],
    feature,
    1,
  );
  assert.ok(reason.includes("交集"));
});

test("getMatchedReason returns topic reason for keyword mode", () => {
  const feature = { editingTool: "CRISPR", organism: "rice" } as GeneEditingFeature;
  const reason = getMatchedReason(
    "keyword",
    { id: "1", title: "Test" } as AnalyzeResponse["papers"][number],
    feature,
    0,
  );
  assert.ok(reason.includes("编辑工具为CRISPR"));
});

test("getTransferPathIdea finds idea by transfer path label", () => {
  const result = {
    ideas: [
      { id: "1", transferPath: "path1", name: "Idea 1" },
      { id: "2", transferPath: "path2", name: "Idea 2" },
    ],
  } as unknown as AnalyzeResponse;
  const idea = getTransferPathIdea(result, "path2");
  assert.ok(idea);
  assert.equal(idea!.id, "2");
});

test("getTransferPathIdea returns undefined when not found", () => {
  const result = { ideas: [] } as unknown as AnalyzeResponse;
  const idea = getTransferPathIdea(result, "nonexistent");
  assert.equal(idea, undefined);
});
