import assert from "node:assert/strict";
import test from "node:test";

import { papers } from "../lib/mock-data";
import {
  RESEARCH_IDEA_TYPES,
  classifyGeneEditingIdea,
  evaluateGeneEditingIdea,
  generateIdeasForPaper,
  generateResearchIdeas,
} from "../lib/research-ideas";

test("generateIdeasForPaper returns 3-5 allowed idea types for every seed paper", () => {
  const allIdeas = generateResearchIdeas();
  const countsByPaper = new Map<string, number>();

  for (const paper of papers) {
    const ideas = generateIdeasForPaper(paper);

    assert.ok(ideas.length >= 3 && ideas.length <= 5);
    assert.equal(new Set(ideas.map((idea) => idea.ideaType)).size, ideas.length);

    for (const idea of ideas) {
      assert.ok(RESEARCH_IDEA_TYPES.includes(idea.ideaType));
      assert.equal(idea.paperId, paper.id);
      assert.ok(idea.minimumExperimentalPackage.length >= 3);
      assert.ok(idea.additionalExperiments.length >= 3);
      countsByPaper.set(paper.id, (countsByPaper.get(paper.id) ?? 0) + 1);
    }
  }

  assert.equal(allIdeas.length, [...countsByPaper.values()].reduce((sum, count) => sum + count, 0));
});

test("classifyGeneEditingIdea recognizes delivery optimization language", () => {
  const classification = classifyGeneEditingIdea({
    title: "Optimize LNP repeat dosing for liver prime editing",
    summary: "Tune biodistribution and tropism so the same editor can redose without losing efficacy.",
  });

  assert.equal(classification, "delivery optimization");
});

test("evaluateGeneEditingIdea scores a differentiated delivery idea as promising", () => {
  const evaluation = evaluateGeneEditingIdea({
    title: "Optimize LNP repeat dosing for liver prime editing",
    summary:
      "Retune liver biodistribution, repeat dosing tolerance, and phenotype durability for the PCSK9 prime editing workflow in humanized liver models.",
    sourcePaperId: "paper-pcsk9-prime-lnp",
  });

  assert.equal(evaluation.primaryIdeaType, "delivery optimization");
  assert.ok(evaluation.novelty >= 60);
  assert.ok(evaluation.feasibility >= 65);
  assert.ok(evaluation.publicationPotential >= 70);
  assert.ok(evaluation.minimumExperimentalPackage.length >= 3);
  assert.match(evaluation.articleType, /delivery optimization/i);
});

test("evaluateGeneEditingIdea flags overly incremental follow-on ideas", () => {
  const evaluation = evaluateGeneEditingIdea({
    title: "Minor optimization of the same PCSK9 prime editing model",
    summary:
      "Replicate the same primate model with the same editor and same delivery, aiming for a slight benchmark improvement without a new safety or transfer angle.",
    sourcePaperId: "paper-pcsk9-prime-lnp",
  });

  assert.equal(evaluation.isIncremental, true);
  assert.ok(evaluation.novelty < 55);
  assert.ok(evaluation.competitionRisk >= 55);
  assert.match(evaluation.warning ?? "", /incremental/i);
});
