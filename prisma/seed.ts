import { PrismaClient, EvaluationVerdict, IdeaStage, PaperStage, PaperStatus, SubscriptionCadence } from "@prisma/client";

import { authors, evaluations, geneTargets, ideas, journals, papers, subscriptions, topics } from "../lib/mock-data";

const prisma = new PrismaClient();

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPaperStage(stage: string): PaperStage {
  switch (stage) {
    case "Clinical":
      return PaperStage.CLINICAL;
    case "Platform":
      return PaperStage.PLATFORM;
    default:
      return PaperStage.PRECLINICAL;
  }
}

function toPaperStatus(status: string): PaperStatus {
  switch (status) {
    case "Watchlist":
      return PaperStatus.WATCHLIST;
    case "Foundational":
      return PaperStatus.FOUNDATIONAL;
    default:
      return PaperStatus.TRENDING;
  }
}

function toCadence(cadence: string): SubscriptionCadence {
  switch (cadence) {
    case "Daily":
      return SubscriptionCadence.DAILY;
    case "Biweekly":
      return SubscriptionCadence.BIWEEKLY;
    default:
      return SubscriptionCadence.WEEKLY;
  }
}

function toIdeaStage(stage: string): IdeaStage {
  switch (stage) {
    case "Validation":
      return IdeaStage.VALIDATION;
    case "Incubation":
      return IdeaStage.INCUBATION;
    default:
      return IdeaStage.DISCOVERY;
  }
}

function toVerdict(verdict: string): EvaluationVerdict {
  switch (verdict) {
    case "Watch":
      return EvaluationVerdict.WATCH;
    case "Pass":
      return EvaluationVerdict.PASS;
    default:
      return EvaluationVerdict.STRONG;
  }
}

async function main() {
  await prisma.deliveredNotification.deleteMany();
  await prisma.subscriptionMatch.deleteMany();
  await prisma.literatureSourceRecord.deleteMany();
  await prisma.literatureSourceState.deleteMany();
  await prisma.literaturePaper.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.journalTopic.deleteMany();
  await prisma.author.deleteMany();
  await prisma.geneTarget.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.journal.deleteMany();

  for (const topic of topics) {
    await prisma.topic.create({
      data: topic,
    });
  }

  for (const journal of journals) {
    await prisma.journal.create({
      data: {
        slug: journal.slug,
        name: journal.name,
        publisher: journal.publisher,
        summary: journal.summary,
        impactFactor: journal.impactFactor,
        reviewSpeedDays: journal.reviewSpeedDays,
        acceptanceRate: journal.acceptanceRate,
        openAccess: journal.openAccess,
        region: journal.region,
        coverageScore: journal.coverageScore,
        journalTopics: {
          create: journal.topicSlugs.map((topicSlug) => ({
            topic: {
              connect: {
                slug: topicSlug,
              },
            },
          })),
        },
      },
    });
  }

  for (const author of authors) {
    await prisma.author.create({
      data: author,
    });
  }

  for (const gene of geneTargets) {
    await prisma.geneTarget.create({
      data: gene,
    });
  }

  for (const paper of papers) {
    await prisma.paper.create({
      data: {
        id: paper.id,
        slug: paper.slug,
        title: paper.title,
        normalizedTitle: normalizeTitle(paper.title),
        abstract: paper.abstract,
        doi: paper.doi,
        pmid: paper.pmid,
        publishedAt: new Date(paper.publishedAt),
        modality: paper.modality,
        diseaseArea: paper.diseaseArea,
        stage: toPaperStage(paper.stage),
        status: toPaperStatus(paper.status),
        noveltyScore: paper.noveltyScore,
        momentumScore: paper.momentumScore,
        translationalScore: paper.translationalScore,
        evidenceScore: paper.evidenceScore,
        compositeScore: paper.compositeScore,
        citationCount: paper.citationCount,
        clinicalSignal: paper.clinicalSignal,
        keyTakeaway: paper.keyTakeaway,
        marketSignal: paper.marketSignal,
        externalSource: "mock",
        sourceUrl: null,
        organismsText: paper.organisms.join("|"),
        editorTypesText: paper.editorTypes.join("|"),
        journal: {
          connect: {
            slug: paper.journalSlug,
          },
        },
        authors: {
          connect: paper.authorIds.map((id) => ({ id })),
        },
        geneTargets: {
          connect: paper.geneSymbols.map((symbol) => ({ symbol })),
        },
        topics: {
          connect: paper.topicSlugs.map((slug) => ({ slug })),
        },
      },
    });
  }

  for (const subscription of subscriptions) {
    await prisma.subscription.create({
      data: {
        id: subscription.id,
        label: subscription.label,
        cadence: toCadence(subscription.cadence),
        signalThreshold: subscription.signalThreshold,
        notes: subscription.notes,
        isActive: subscription.isActive,
        keywordsText: subscription.keywords.join("|"),
        authorNamesText: subscription.authorNames.join("|"),
        journalNamesText: subscription.journalNames.join("|"),
        organismsText: subscription.organisms.join("|"),
        editorTypesText: subscription.editorTypes.join("|"),
        journal: subscription.journalSlug
          ? {
              connect: {
                slug: subscription.journalSlug,
              },
            }
          : undefined,
        topic: subscription.topicSlug
          ? {
              connect: {
                slug: subscription.topicSlug,
              },
            }
          : undefined,
        geneTarget: subscription.geneSymbol
          ? {
              connect: {
                symbol: subscription.geneSymbol,
              },
            }
          : undefined,
      },
    });
  }

  for (const idea of ideas) {
    await prisma.idea.create({
      data: {
        id: idea.id,
        slug: idea.slug,
        title: idea.title,
        thesis: idea.thesis,
        customer: idea.customer,
        wedge: idea.wedge,
        moat: idea.moat,
        risk: idea.risk,
        stage: toIdeaStage(idea.stage),
        score: idea.score,
        paper: idea.paperId
          ? {
              connect: {
                id: idea.paperId,
              },
            }
          : undefined,
        topic: idea.topicSlug
          ? {
              connect: {
                slug: idea.topicSlug,
              },
            }
          : undefined,
      },
    });
  }

  for (const evaluation of evaluations) {
    await prisma.evaluation.create({
      data: {
        id: evaluation.id,
        technicalFit: evaluation.technicalFit,
        marketFit: evaluation.marketFit,
        defensibility: evaluation.defensibility,
        executionSpeed: evaluation.executionSpeed,
        compositeScore: evaluation.compositeScore,
        verdict: toVerdict(evaluation.verdict),
        notes: evaluation.notes,
        idea: {
          connect: {
            slug: evaluation.ideaSlug,
          },
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
