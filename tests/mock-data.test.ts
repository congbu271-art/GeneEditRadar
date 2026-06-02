import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardMetrics, getPaperById, papers } from "../lib/mock-data";
import { enrichedSubscriptions } from "../lib/radar-data";

test("returns a paper by id", () => {
  const paper = getPaperById("paper-pcsk9-prime-lnp");

  assert.ok(paper);
  assert.match(paper.title, /PCSK9/);
});

test("computes dashboard metrics from the seed set", () => {
  const metrics = getDashboardMetrics();

  assert.ok(metrics.highSignalPapers > 0);
  assert.ok(metrics.averageCompositeScore >= 80);
  assert.equal(metrics.trackedJournals, 4);
});

test("matches subscriptions against relevant papers", () => {
  assert.equal(
    enrichedSubscriptions.every((subscription) => subscription.matchingPaperCount > 0),
    true,
  );
});

test("keeps the seeded paper list intact", () => {
  assert.equal(papers.length, 5);
});
