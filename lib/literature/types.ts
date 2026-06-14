import {
  authors,
  journals,
  papers,
  subscriptions,
  topics,
  type RadarPaper,
  type RadarSubscription,
} from "@/lib/mock-data";
import {
  extractGeneEditingDetails,
  type ExtractionSourcePaper,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";
import {
  calculateSignalScore,
  canonicalizeJournal,
  coerceIsoDate,
  createCollectedPaper,
  fetchJson,
  inferEditorTypes,
  inferOrganisms,
  normalizeTitle,
  normalizeWhitespace,
  parseAuthorList,
  parseCrossrefDate,
  stripMarkup,
  toExtractionSourcePaper,
  uniqueStrings,
} from "@/lib/shared-utils";

export type LiteratureSource = "pubmed" | "europe-pmc" | "crossref" | "rss" | "biorxiv" | "medrxiv" | "openalex" | "mock";

export type CollectedPaper = {
  id: string;
  title: string;
  normalizedTitle: string;
  abstract: string;
  doi?: string;
  pmid?: string;
  journal: string;
  authors: string[];
  authorOrcids?: string[];
  publishedAt?: string;
  url?: string;
  organisms: string[];
  editorTypes: string[];
  keywords: string[];
  sourceIds: Partial<Record<LiteratureSource, string>>;
  sources: LiteratureSource[];
  primarySource: LiteratureSource;
  signalScore: number;
  appPaperId?: string;
  fullText?: string;
};

export type ExtractedCollectedPaper = CollectedPaper & {
  extraction: GeneEditingExtraction;
};

export type LiteratureSourceStatus = {
  source: Exclude<LiteratureSource, "mock">;
  ok: boolean;
  count: number;
  error?: string;
};

export type PaperMatch = {
  subscriptionId: string;
  subscriptionLabel: string;
  matchScore: number;
  threshold: number;
  isMatch: boolean;
  matchedKeywords: string[];
  matchedAuthors: string[];
  matchedJournals: string[];
  matchedOrganisms: string[];
  matchedEditorTypes: string[];
  reasons: string[];
};

export type MatchedCollectedPaper = ExtractedCollectedPaper & {
  matches: PaperMatch[];
  topMatchScore: number;
};

export type SubscriptionOverview = RadarSubscription & {
  matchingPaperCount: number;
  bestMatchScore: number;
  matchedPaperTitles: string[];
  filterSummary: string[];
};

export type LiteratureCollectionResult = {
  papers: CollectedPaper[];
  sourceStatuses: LiteratureSourceStatus[];
  usedFallback: boolean;
};

export type SubscriptionIntelligence = {
  papers: MatchedCollectedPaper[];
  sourceStatuses: LiteratureSourceStatus[];
  subscriptionOverviews: SubscriptionOverview[];
  usedFallback: boolean;
};

export type SourceResult = {
  papers: CollectedPaper[];
  status: LiteratureSourceStatus;
};

export type ResolvedSubscription = RadarSubscription & {
  allKeywords: string[];
  allAuthorNames: string[];
  allAuthorOrcids: string[];
  allJournalNames: string[];
  allOrganisms: string[];
  allEditorTypes: string[];
};

export const SOURCE_PRIORITY: Record<LiteratureSource, number> = {
  mock: 0,
  rss: 1,
  crossref: 1,
  biorxiv: 1.5,
  medrxiv: 1.5,
  pubmed: 2,
  "europe-pmc": 3,
  openalex: 2.5,
};

export const MATCH_WEIGHTS = {
  keywords: 35,
  authors: 20,
  journals: 15,
  organisms: 15,
  editorTypes: 15,
} as const;

export const API_TIMEOUT_MS = 6500;
export const DEFAULT_LIMIT_PER_SOURCE = 6;

export const normalizeDoi = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/^https?:\/\/doi\.org\//, "").replace(/^doi:/, "");
  return cleaned || undefined;
};

export const normalizePmid = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/^PMID:\s*/, "");
  return cleaned || undefined;
};

export function normalizeKeyword(value: string) {
  return normalizeWhitespace(stripMarkup(value)).toLowerCase();
}

export function normalizePersonName(value: string) {
  return normalizeWhitespace(stripMarkup(value)).toLowerCase().replace(/[,;]/g, "");
}

export function buildSourceUrl(source: LiteratureSource, paper: { doi?: string; pmid?: string; url?: string }, sourceId?: string) {
  if (paper.url) return paper.url;
  if (source === "pubmed" && paper.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  if ((source === "crossref" || source === "biorxiv" || source === "medrxiv" || source === "openalex") && paper.doi) return `https://doi.org/${paper.doi}`;
  if (sourceId) return sourceId;
  return undefined;
}
