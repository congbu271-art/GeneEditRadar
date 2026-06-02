import assert from "node:assert/strict";
import test from "node:test";

import { subscriptions } from "../lib/mock-data";
import { dedupePapers, matchPaperToSubscription, normalizeTitle, type CollectedPaper } from "../lib/literature";

function makePaper(overrides: Partial<CollectedPaper> = {}): CollectedPaper {
  const title = overrides.title ?? "Programmable liver prime editing enables durable PCSK9 knockdown";

  return {
    id: overrides.id ?? "paper-1",
    title,
    normalizedTitle: overrides.normalizedTitle ?? normalizeTitle(title),
    abstract: overrides.abstract ?? "Prime editing in primates improves durable liver delivery.",
    doi: overrides.doi,
    pmid: overrides.pmid,
    journal: overrides.journal ?? "Nature Biotechnology",
    authors: overrides.authors ?? ["Dr. Ava Li", "Mateo Silva"],
    publishedAt: overrides.publishedAt ?? "2026-05-16",
    url: overrides.url ?? "https://example.org/paper-1",
    organisms: overrides.organisms ?? ["Primate"],
    editorTypes: overrides.editorTypes ?? ["Prime editing"],
    keywords: overrides.keywords ?? ["PCSK9", "liver", "LNP"],
    sourceIds: overrides.sourceIds ?? {},
    sources: overrides.sources ?? ["pubmed"],
    primarySource: overrides.primarySource ?? "pubmed",
    signalScore: overrides.signalScore ?? 93,
    appPaperId: overrides.appPaperId,
  };
}

test("dedupePapers merges records across DOI, PMID, and normalized title", () => {
  const pubmedPaper = makePaper({
    id: "pubmed-1",
    doi: "10.1000/example",
    pmid: "12345",
    sourceIds: { pubmed: "12345" },
    sources: ["pubmed"],
    primarySource: "pubmed",
  });

  const europePmcPaper = makePaper({
    id: "europe-1",
    doi: "10.1000/example",
    abstract: "Prime editing in primates improves durable liver delivery with better detail.",
    sourceIds: { "europe-pmc": "PMC12345" },
    sources: ["europe-pmc"],
    primarySource: "europe-pmc",
  });

  const crossrefPaper = makePaper({
    id: "crossref-1",
    title: "Programmable liver prime editing enables durable PCSK9 knockdown",
    normalizedTitle: normalizeTitle("Programmable liver prime editing enables durable PCSK9 knockdown"),
    sourceIds: { crossref: "10.1000/example" },
    sources: ["crossref"],
    primarySource: "crossref",
  });

  const deduped = dedupePapers([pubmedPaper, europePmcPaper, crossrefPaper]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].sources.sort(), ["crossref", "europe-pmc", "pubmed"]);
  assert.equal(deduped[0].doi, "10.1000/example");
  assert.equal(deduped[0].pmid, "12345");
  assert.match(deduped[0].abstract, /better detail/i);
});

test("matchPaperToSubscription scores high when multiple filters align", () => {
  const paper = makePaper({
    doi: "10.1000/example",
    pmid: "12345",
    sourceIds: { mock: "paper-1" },
    sources: ["mock"],
    primarySource: "mock",
  });

  const match = matchPaperToSubscription(paper, subscriptions[0]);

  assert.equal(match.isMatch, true);
  assert.ok(match.matchScore >= 80);
  assert.ok(match.matchedKeywords.includes("PCSK9"));
  assert.ok(match.matchedJournals.includes("Nature Biotechnology"));
  assert.ok(match.matchedOrganisms.includes("Primate"));
  assert.ok(match.matchedEditorTypes.includes("Prime editing"));
});

test("matchPaperToSubscription rejects papers below threshold or with weak overlap", () => {
  const weakPaper = makePaper({
    title: "High-throughput CRISPR screening in murine tumors",
    normalizedTitle: normalizeTitle("High-throughput CRISPR screening in murine tumors"),
    abstract: "A screening paper focused on murine oncology models.",
    journal: "The CRISPR Journal",
    authors: ["Someone Else"],
    organisms: ["Mouse"],
    editorTypes: ["CRISPR screening"],
    keywords: ["screening", "oncology"],
    signalScore: 58,
  });

  const match = matchPaperToSubscription(weakPaper, subscriptions[0]);

  assert.equal(match.isMatch, false);
  assert.ok(match.matchScore < 55 || weakPaper.signalScore < match.threshold);
});
