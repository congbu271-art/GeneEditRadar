import {
  LiteratureSourceName,
  NotificationChannel,
  SubscriptionCadence,
  type GeneTarget,
  type Journal,
  type LiteraturePaper,
  type LiteratureSourceRecord,
  type Prisma,
  type Subscription,
  type Topic,
} from "@prisma/client";

import {
  collectExternalLiterature,
  dedupePapers,
  matchPaperToSubscription,
  normalizeDoi,
  normalizePmid,
  normalizeTitle,
  type CollectedPaper,
  type LiteratureSource,
  type LiteratureSourceStatus,
  type PaperMatch,
} from "@/lib/literature";
import { collectRssLiterature } from "@/lib/literature-rss";
import type { RadarSubscription } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

type LiteratureJobSummary = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  collected: number;
  stored: number;
  matched: number;
  delivered: number;
  sourceStatuses?: LiteratureSourceStatus[];
};

type DbSubscription = Subscription & {
  journal: Journal | null;
  topic: Topic | null;
  geneTarget: GeneTarget | null;
};

type DbLiteraturePaper = LiteraturePaper & {
  sourceRecords: LiteratureSourceRecord[];
};

const SOURCE_NAME_MAP: Record<LiteratureSource, LiteratureSourceName> = {
  pubmed: LiteratureSourceName.PUBMED,
  "europe-pmc": LiteratureSourceName.EUROPE_PMC,
  crossref: LiteratureSourceName.CROSSREF,
  rss: LiteratureSourceName.RSS,
  mock: LiteratureSourceName.MOCK,
};

const REVERSE_SOURCE_NAME_MAP: Record<LiteratureSourceName, LiteratureSource> = {
  [LiteratureSourceName.PUBMED]: "pubmed",
  [LiteratureSourceName.EUROPE_PMC]: "europe-pmc",
  [LiteratureSourceName.CROSSREF]: "crossref",
  [LiteratureSourceName.RSS]: "rss",
  [LiteratureSourceName.BIORXIV]: "crossref",
  [LiteratureSourceName.MEDRXIV]: "crossref",
  [LiteratureSourceName.OPENALEX]: "crossref",
  [LiteratureSourceName.SEMANTIC_SCHOLAR]: "crossref",
  [LiteratureSourceName.UNPAYWALL]: "crossref",
  [LiteratureSourceName.MOCK]: "mock",
};

const CADENCE_MAP: Record<SubscriptionCadence, RadarSubscription["cadence"]> = {
  [SubscriptionCadence.DAILY]: "Daily",
  [SubscriptionCadence.WEEKLY]: "Weekly",
  [SubscriptionCadence.BIWEEKLY]: "Biweekly",
};

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function splitTextList(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,，；、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function encodeTextList(values: string[]) {
  const unique = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  return unique.length > 0 ? unique.join("\n") : null;
}

function parseIsoDate(value?: string) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function toRadarSubscription(subscription: DbSubscription): RadarSubscription {
  return {
    id: subscription.id,
    label: subscription.label,
    cadence: CADENCE_MAP[subscription.cadence],
    signalThreshold: subscription.signalThreshold,
    notes: subscription.notes,
    isActive: subscription.isActive,
    journalSlug: subscription.journal?.slug,
    topicSlug: subscription.topic?.slug,
    geneSymbol: subscription.geneTarget?.symbol,
    keywords: splitTextList(subscription.keywordsText),
    authorNames: splitTextList(subscription.authorNamesText),
    journalNames: [
      ...splitTextList(subscription.journalNamesText),
      ...(subscription.journal?.name ? [subscription.journal.name] : []),
    ],
    organisms: splitTextList(subscription.organismsText),
    editorTypes: splitTextList(subscription.editorTypesText),
  };
}

function toCollectedPaper(paper: DbLiteraturePaper): CollectedPaper {
  const sources = paper.sourceRecords.length > 0
    ? paper.sourceRecords.map((record) => REVERSE_SOURCE_NAME_MAP[record.source])
    : ["mock" as LiteratureSource];
  const primarySource = sources[0] ?? "mock";

  return {
    id: paper.id,
    title: paper.title,
    normalizedTitle: paper.normalizedTitle,
    abstract: paper.abstract,
    doi: paper.doi ?? undefined,
    pmid: paper.pmid ?? undefined,
    journal: paper.journal,
    authors: splitTextList(paper.authorsText),
    publishedAt: paper.publishedAt?.toISOString().slice(0, 10),
    url: paper.sourceUrl ?? undefined,
    organisms: splitTextList(paper.organismsText),
    editorTypes: splitTextList(paper.editorTypesText),
    keywords: splitTextList(paper.keywordsText),
    sourceIds: Object.fromEntries(
      paper.sourceRecords.map((record) => [REVERSE_SOURCE_NAME_MAP[record.source], record.sourceRecordId]),
    ) as Partial<Record<LiteratureSource, string>>,
    sources,
    primarySource,
    signalScore: paper.signalScore,
  };
}

async function upsertSourceState(status: LiteratureSourceStatus & { feedUrl?: string; label?: string }) {
  const source = SOURCE_NAME_MAP[status.source];
  const existing = await prisma.literatureSourceState.findFirst({
    where: {
      source,
      feedUrl: status.feedUrl ?? null,
    },
  });
  const data = {
    label: status.label ?? status.source,
    lastFetchedAt: new Date(),
    lastSuccessAt: status.ok ? new Date() : undefined,
    lastError: status.ok ? null : (status.error ?? "Unknown source error"),
  };

  if (existing) {
    await prisma.literatureSourceState.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.literatureSourceState.create({
    data: {
      source,
      feedUrl: status.feedUrl ?? null,
      ...data,
    },
  });
}

async function findExistingPaper(paper: CollectedPaper) {
  const normalizedDoi = normalizeDoi(paper.doi);
  const normalizedPmid = normalizePmid(paper.pmid);
  const normalizedTitle = normalizeTitle(paper.title);
  const clauses: Prisma.LiteraturePaperWhereInput[] = [];

  if (normalizedDoi) {
    clauses.push({ doi: normalizedDoi });
  }

  if (normalizedPmid) {
    clauses.push({ pmid: normalizedPmid });
  }

  if (normalizedTitle.length >= 20) {
    clauses.push({ normalizedTitle });
  }

  if (clauses.length === 0) {
    return null;
  }

  return prisma.literaturePaper.findFirst({
    where: { OR: clauses },
  });
}

async function storeCollectedPaper(paper: CollectedPaper) {
  const normalizedDoi = normalizeDoi(paper.doi);
  const normalizedPmid = normalizePmid(paper.pmid);
  const normalizedTitle = normalizeTitle(paper.title);
  const existing = await findExistingPaper(paper);
  const publishedAt = parseIsoDate(paper.publishedAt);
  const data = {
    title: paper.title,
    normalizedTitle,
    abstract: paper.abstract,
    doi: normalizedDoi,
    pmid: normalizedPmid,
    journal: paper.journal,
    authorsText: encodeTextList(paper.authors),
    publishedAt,
    sourceUrl: paper.url ?? null,
    organismsText: encodeTextList(paper.organisms),
    editorTypesText: encodeTextList(paper.editorTypes),
    keywordsText: encodeTextList(paper.keywords),
    signalScore: paper.signalScore,
    lastSeenAt: new Date(),
  };

  const stored = existing
    ? await prisma.literaturePaper.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.literaturePaper.create({
        data: {
          ...data,
          firstSeenAt: new Date(),
        },
      });

  for (const source of paper.sources.filter((item) => item !== "mock")) {
    const sourceRecordId = paper.sourceIds[source] ?? `${source}:${paper.id}`;

    await prisma.literatureSourceRecord.upsert({
      where: {
        source_sourceRecordId: {
          source: SOURCE_NAME_MAP[source],
          sourceRecordId,
        },
      },
      create: {
        source: SOURCE_NAME_MAP[source],
        sourceRecordId,
        sourceUrl: paper.url ?? null,
        rawPublishedAt: publishedAt,
        paperId: stored.id,
      },
      update: {
        fetchedAt: new Date(),
        sourceUrl: paper.url ?? null,
        rawPublishedAt: publishedAt,
        paperId: stored.id,
      },
    });
  }

  return stored;
}

async function recordMatch(subscriptionId: string, paperId: string, match: PaperMatch) {
  await prisma.subscriptionMatch.upsert({
    where: {
      subscriptionId_paperId: {
        subscriptionId,
        paperId,
      },
    },
    create: {
      subscriptionId,
      paperId,
      matchScore: match.matchScore,
      threshold: match.threshold,
      reasonsText: encodeTextList(match.reasons),
      matchedKeywordsText: encodeTextList(match.matchedKeywords),
      matchedAuthorsText: encodeTextList(match.matchedAuthors),
      matchedJournalsText: encodeTextList(match.matchedJournals),
      matchedOrganismsText: encodeTextList(match.matchedOrganisms),
      matchedEditorTypesText: encodeTextList(match.matchedEditorTypes),
    },
    update: {
      matchScore: match.matchScore,
      threshold: match.threshold,
      reasonsText: encodeTextList(match.reasons),
      matchedKeywordsText: encodeTextList(match.matchedKeywords),
      matchedAuthorsText: encodeTextList(match.matchedAuthors),
      matchedJournalsText: encodeTextList(match.matchedJournals),
      matchedOrganismsText: encodeTextList(match.matchedOrganisms),
      matchedEditorTypesText: encodeTextList(match.matchedEditorTypes),
    },
  });
}

export async function runLiteratureCollectionJob(): Promise<LiteratureJobSummary> {
  if (!isDatabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: "DATABASE_URL is not configured; Netlify demo mode keeps using mock/fallback data.",
      collected: 0,
      stored: 0,
      matched: 0,
      delivered: 0,
    };
  }

  const collection = await collectExternalLiterature();

  await Promise.all(collection.sourceStatuses.map(upsertSourceState));

  let stored = 0;

  for (const paper of collection.papers) {
    await storeCollectedPaper(paper);
    stored += 1;
  }

  return {
    ok: true,
    collected: collection.papers.length,
    stored,
    matched: 0,
    delivered: 0,
    sourceStatuses: collection.sourceStatuses,
  };
}

export async function runRssCollectionJob(): Promise<LiteratureJobSummary> {
  if (!isDatabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: "DATABASE_URL is not configured; RSS collection is disabled in demo mode.",
      collected: 0,
      stored: 0,
      matched: 0,
      delivered: 0,
    };
  }

  const collection = await collectRssLiterature();
  const papers = dedupePapers(collection.papers);

  await Promise.all(collection.sourceStatuses.map(upsertSourceState));

  let stored = 0;

  for (const paper of papers) {
    await storeCollectedPaper(paper);
    stored += 1;
  }

  return {
    ok: true,
    collected: collection.papers.length,
    stored,
    matched: 0,
    delivered: 0,
    sourceStatuses: collection.sourceStatuses,
  };
}

export async function runSubscriptionMatchJob(options: { sinceHours?: number } = {}): Promise<LiteratureJobSummary> {
  if (!isDatabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: "DATABASE_URL is not configured; subscription matching is disabled in demo mode.",
      collected: 0,
      stored: 0,
      matched: 0,
      delivered: 0,
    };
  }

  const since = new Date(Date.now() - (options.sinceHours ?? 72) * 60 * 60 * 1000);
  const [dbSubscriptions, dbPapers] = await Promise.all([
    prisma.subscription.findMany({
      where: { isActive: true },
      include: {
        journal: true,
        topic: true,
        geneTarget: true,
      },
    }),
    prisma.literaturePaper.findMany({
      where: {
        lastSeenAt: {
          gte: since,
        },
      },
      include: {
        sourceRecords: true,
      },
      orderBy: [{ signalScore: "desc" }, { publishedAt: "desc" }],
      take: 500,
    }),
  ]);

  let matched = 0;

  for (const dbPaper of dbPapers) {
    const paper = toCollectedPaper(dbPaper);

    for (const dbSubscription of dbSubscriptions) {
      const match = matchPaperToSubscription(paper, toRadarSubscription(dbSubscription));

      if (!match.isMatch) {
        continue;
      }

      await recordMatch(dbSubscription.id, dbPaper.id, match);
      matched += 1;
    }
  }

  return {
    ok: true,
    collected: 0,
    stored: 0,
    matched,
    delivered: 0,
  };
}

export async function runDigestMarkJob(): Promise<LiteratureJobSummary> {
  if (!isDatabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: "DATABASE_URL is not configured; digest delivery is disabled in demo mode.",
      collected: 0,
      stored: 0,
      matched: 0,
      delivered: 0,
    };
  }

  const candidateMatches = await prisma.subscriptionMatch.findMany({
    take: 200,
    orderBy: { createdAt: "asc" },
  });
  const batchKey = `digest-${new Date().toISOString().slice(0, 10)}`;
  let delivered = 0;

  for (const match of candidateMatches) {
    const existing = await prisma.deliveredNotification.findUnique({
      where: {
        subscriptionId_paperId_channel: {
          subscriptionId: match.subscriptionId,
          paperId: match.paperId,
          channel: NotificationChannel.EMAIL,
        },
      },
    });

    if (existing) {
      continue;
    }

    await prisma.deliveredNotification.create({
      data: {
        subscriptionId: match.subscriptionId,
        paperId: match.paperId,
        channel: NotificationChannel.EMAIL,
        batchKey,
      },
    });
    delivered += 1;
  }

  return {
    ok: true,
    collected: 0,
    stored: 0,
    matched: 0,
    delivered,
  };
}
