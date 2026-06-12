import assert from "node:assert/strict";
import test from "node:test";

import {
  DISPLAY_NOT_REPORTED,
  uniqueStrings,
  normalizeWhitespace,
  decodeHtml,
  stripMarkup,
  normalizeTitle,
  normalizeKeyword,
  normalizePersonName,
  canonicalizeJournal,
  coerceIsoDate,
  parseCrossrefDate,
  parseAuthorList,
  inferOrganisms,
  inferEditorTypes,
  buildPaperKeywords,
  calculateSignalScore,
  createCollectedPaper,
  toExtractionSourcePaper,
} from "../lib/shared-utils";

test("uniqueStrings removes duplicates and empty strings", () => {
  assert.deepEqual(uniqueStrings(["a", "b", "a", ""]), ["a", "b"]);
  assert.deepEqual(uniqueStrings([]), []);
  assert.deepEqual(uniqueStrings(["", "", ""]), []);
});

test("normalizeWhitespace collapses whitespace and trims", () => {
  assert.equal(normalizeWhitespace("  hello   world  "), "hello world");
  assert.equal(normalizeWhitespace("nochange"), "nochange");
  assert.equal(normalizeWhitespace("  "), "");
});

test("decodeHtml decodes common HTML entities", () => {
  assert.equal(decodeHtml("a&amp;b"), "a&b");
  assert.equal(decodeHtml("&lt;div&gt;"), "<div>");
  assert.equal(decodeHtml("&quot;hello&quot;"), '"hello"');
  assert.equal(decodeHtml("&#39;test&#39;"), "'test'");
});

test("stripMarkup removes HTML tags and decodes entities", () => {
  assert.equal(stripMarkup("<p>hello</p>"), "hello");
  assert.equal(stripMarkup("a&amp;<b>b</b>"), "a& b"); // tag replaced with space
  assert.equal(stripMarkup("no tags here"), "no tags here");
});

test("normalizeTitle lowercases, strips diacritics, and removes special chars", () => {
  assert.equal(normalizeTitle("Hello World"), "hello world");
  assert.equal(normalizeTitle("CRISPR-Cas9"), "crispr cas9");
  assert.equal(normalizeTitle("Über"), "uber");
  assert.equal(normalizeTitle("<b>Title</b>"), "title");
});

test("normalizeKeyword delegates to normalizeTitle", () => {
  assert.equal(normalizeKeyword("Test Keyword"), normalizeTitle("Test Keyword"));
});

test("normalizePersonName removes academic titles", () => {
  assert.equal(normalizePersonName("Dr. John Smith"), "john smith");
  assert.equal(normalizePersonName("Prof. Jane Doe PhD"), "jane doe");
  assert.equal(normalizePersonName("Mary Jones MD"), "mary jones");
});

test("canonicalizeJournal normalizes journal names", () => {
  assert.equal(canonicalizeJournal("Nature"), "nature");
  assert.equal(canonicalizeJournal("  Science  "), "science");
});

test("coerceIsoDate parses valid dates", () => {
  assert.equal(coerceIsoDate("2024-01-15"), "2024-01-15");
  // Note: "January 1, 2024" may shift by timezone
  const jan1 = coerceIsoDate("January 1, 2024");
  assert.ok(jan1 === "2024-01-01" || jan1 === "2023-12-31");
  assert.equal(coerceIsoDate(undefined), undefined);
  assert.equal(coerceIsoDate("invalid"), undefined);
  assert.equal(coerceIsoDate(""), undefined);
});

test("parseCrossrefDate parses Crossref date format", () => {
  const result15 = parseCrossrefDate([[2024, 1, 15]]);
  assert.ok(result15?.startsWith("2024-01-15") || result15?.startsWith("2024-01-14")); // timezone dependent
  const resultMonth = parseCrossrefDate([[2024, 6]]);
  assert.ok(resultMonth?.startsWith("2024-06"));
  const resultYear = parseCrossrefDate([[2024]]);
  assert.ok(resultYear?.startsWith("2024"));
  assert.equal(parseCrossrefDate(undefined), undefined);
  assert.equal(parseCrossrefDate([]), undefined);
});

test("parseAuthorList extracts author names", () => {
  const authors = parseAuthorList([
    { name: "John Smith" },
    { given: "Jane", family: "Doe" },
    { authname: "Bob Johnson" },
  ]);
  assert.ok(authors.includes("John Smith"));
  assert.ok(authors.includes("Jane Doe"));
  assert.ok(authors.includes("Bob Johnson"));
});

test("parseAuthorList returns empty array for undefined input", () => {
  assert.deepEqual(parseAuthorList(undefined), []);
});

test("inferOrganisms detects organisms from text", () => {
  const organisms = inferOrganisms("prime editing in rice plants");
  assert.ok(organisms.includes("Rice"));
});

test("inferOrganisms detects multiple organisms", () => {
  const organisms = inferOrganisms("mouse and human cells");
  assert.ok(organisms.includes("Mouse"));
  assert.ok(organisms.includes("Human"));
});

test("inferOrganisms returns empty for no matches", () => {
  const organisms = inferOrganisms("no organism mentioned");
  assert.equal(organisms.length, 0);
});

test("inferEditorTypes detects editor types", () => {
  const types = inferEditorTypes("prime editing in wheat");
  assert.ok(types.includes("Prime editing"));
});

test("inferEditorTypes detects multiple editor types", () => {
  const types = inferEditorTypes("CRISPR base editing");
  assert.ok(types.includes("CRISPR"));
  assert.ok(types.includes("Base editing"));
});

test("inferEditorTypes detects Cas9", () => {
  const types = inferEditorTypes("Cas9 editing");
  assert.ok(types.includes("Cas9 editing"));
});

test("buildPaperKeywords extracts keywords from paper data", () => {
  const keywords = buildPaperKeywords({
    title: "CRISPR-Cas9 editing in rice",
    abstract: "This study uses CRISPR for editing",
    journal: "Nature",
    authors: ["Author1"],
    organisms: ["Rice"],
    editorTypes: ["CRISPR"],
  });
  assert.ok(keywords.includes("Nature"));
  assert.ok(keywords.includes("Rice"));
  assert.ok(keywords.includes("CRISPR"));
});

test("calculateSignalScore returns score based on paper attributes", () => {
  const score = calculateSignalScore({
    id: "test",
    title: "Test Paper",
    normalizedTitle: "test paper",
    abstract: "Abstract content",
    journal: "Nature",
    authors: ["Author1"],
    keywords: [],
    doi: "10.1234/test",
    pmid: "12345",
    publishedAt: new Date().toISOString(),
    organisms: ["Rice"],
    editorTypes: ["CRISPR"],
    sources: ["pubmed"],
    primarySource: "pubmed",
    sourceIds: { pubmed: "12345" },
  });
  assert.ok(score > 50);
  assert.ok(score <= 100);
});

test("calculateSignalScore returns minimum score for bare paper", () => {
  const score = calculateSignalScore({
    id: "test",
    title: "Test",
    normalizedTitle: "test",
    abstract: "",
    journal: "",
    authors: [],
    keywords: [],
    doi: undefined,
    pmid: undefined,
    organisms: [],
    editorTypes: [],
    sources: ["crossref"],
    primarySource: "crossref",
    sourceIds: {},
  });
  assert.ok(score >= 30);
  assert.ok(score <= 100);
});

test("createCollectedPaper creates paper with all required fields", () => {
  const paper = createCollectedPaper({
    title: "Test Paper",
    abstract: "Abstract",
    journal: "Nature",
    authors: ["Author1"],
    doi: "10.1234/test",
    pmid: "12345",
    publishedAt: "2024-01-01",
    organisms: ["Rice"],
    editorTypes: ["CRISPR"],
    sources: ["pubmed"],
    primarySource: "pubmed",
    sourceIds: { pubmed: "12345" },
  });
  assert.ok(paper.id);
  assert.equal(paper.title, "Test Paper");
  assert.equal(paper.normalizedTitle, normalizeTitle("Test Paper"));
  assert.ok(paper.keywords.length > 0);
  assert.ok(typeof paper.signalScore === "number");
});

test("toExtractionSourcePaper converts collected paper to extraction format", () => {
  const collected = createCollectedPaper({
    title: "Test",
    abstract: "Abstract",
    journal: "Nature",
    authors: ["Author1"],
    organisms: ["Rice"],
    editorTypes: ["CRISPR"],
    sources: ["pubmed"],
    primarySource: "pubmed",
    sourceIds: {},
  });
  const extraction = toExtractionSourcePaper(collected);
  assert.equal(extraction.id, collected.id);
  assert.equal(extraction.title, collected.title);
  assert.equal(extraction.abstract, collected.abstract);
  assert.equal(extraction.journal, collected.journal);
  assert.deepEqual(extraction.authors, collected.authors);
  assert.equal(extraction.publishedAt, collected.publishedAt);
  assert.deepEqual(extraction.organisms, collected.organisms);
  assert.deepEqual(extraction.editorTypes, collected.editorTypes);
  assert.equal(extraction.appPaperId, collected.appPaperId);
});
