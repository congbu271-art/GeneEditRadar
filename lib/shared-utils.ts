import { journals, papers } from "@/lib/mock-data";
import type { CollectedPaper, LiteratureSource } from "@/lib/literature";
import type { ExtractionSourcePaper } from "@/lib/paper-extraction";

// ─── String utilities ────────────────────────────────────────────────────────

export const DISPLAY_NOT_REPORTED = "未报道";

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripMarkup(value: string) {
  return normalizeWhitespace(decodeHtml(value).replace(/<[^>]+>/g, " "));
}

// ─── Normalization helpers ───────────────────────────────────────────────────

export function normalizeTitle(value: string) {
  return normalizeWhitespace(
    stripMarkup(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " "),
  );
}

export function normalizeKeyword(value: string) {
  return normalizeTitle(value);
}

export function normalizePersonName(value: string) {
  return normalizeTitle(value)
    .replace(/\b(dr|phd|md|prof|professor)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeJournal(value: string) {
  return normalizeTitle(value);
}

// ─── Date parsing ────────────────────────────────────────────────────────────

export function coerceIsoDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

export function parseCrossrefDate(parts?: number[][]) {
  const date = parts?.[0];

  if (!date?.length) {
    return undefined;
  }

  const [year, month = 1, day = 1] = date;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

// ─── Author parsing ──────────────────────────────────────────────────────────

export function parseAuthorList(rawAuthors: Array<{ name?: string; authname?: string; given?: string; family?: string }> | undefined) {
  if (!rawAuthors) {
    return [];
  }

  return uniqueStrings(
    rawAuthors
      .map((author) => author.name ?? author.authname ?? [author.given, author.family].filter(Boolean).join(" "))
      .filter(Boolean)
      .map(stripMarkup),
  );
}

// ─── Inference helpers ───────────────────────────────────────────────────────

export function inferOrganisms(...values: string[]) {
  const text = normalizeTitle(values.join(" "));
  const pairs: Array<[RegExp, string]> = [
    [/\b(human|patient|patients|clinical)\b/, "Human"],
    [/\b(primate|primates|macaque|macaques|nonhuman primate|non human primate)\b/, "Primate"],
    [/\b(mouse|mice|murine)\b/, "Mouse"],
    [/\b(rat|rats)\b/, "Rat"],
    [/\b(rodent|rodents)\b/, "Rodent"],
    [/\b(canine|dog|dogs)\b/, "Canine"],
    [/\b(large animal|large animal model)\b/, "Large animal"],
    [/\b(zebrafish)\b/, "Zebrafish"],
    [/\b(rice|oryza sativa)\b/, "Rice"],
    [/\b(maize|corn|zea mays)\b/, "Maize"],
    [/\b(wheat|triticum)\b/, "Wheat"],
    [/\b(arabidopsis)\b/, "Arabidopsis"],
  ];

  return uniqueStrings(
    pairs
      .filter(([pattern]) => pattern.test(text))
      .map(([, label]) => label),
  );
}

export function inferEditorTypes(...values: string[]) {
  const text = normalizeTitle(values.join(" "));
  const pairs: Array<[RegExp, string]> = [
    [/\bprime edit(ing|or)?\b/, "Prime editing"],
    [/\badenine base edit(ing|or)?\b/, "Adenine base editing"],
    [/\bcytosine base edit(ing|or)?\b/, "Cytosine base editing"],
    [/\bbase edit(ing|or)?\b/, "Base editing"],
    [/\bcrispr screen(ing)?\b/, "CRISPR screening"],
    [/\bmultiplex\b/, "Multiplex editing"],
    [/\bcas12\b/, "Cas12 editing"],
    [/\bcas9\b/, "Cas9 editing"],
    [/\bcrispr\b/, "CRISPR"],
  ];

  return uniqueStrings(
    pairs
      .filter(([pattern]) => pattern.test(text))
      .map(([, label]) => label),
  );
}

// ─── Paper construction ──────────────────────────────────────────────────────

export function buildPaperKeywords(input: {
  title: string;
  abstract: string;
  journal: string;
  authors: string[];
  organisms: string[];
  editorTypes: string[];
}) {
  const tokens = [
    ...input.editorTypes,
    ...input.organisms,
    input.journal,
    ...input.authors,
  ];

  const text = `${input.title} ${input.abstract}`;
  const geneLikeTokens = text.match(/\b[A-Z0-9-]{3,8}\b/g) ?? [];

  return uniqueStrings([...tokens, ...geneLikeTokens].map(stripMarkup));
}

export function calculateSignalScore(paper: Omit<CollectedPaper, "signalScore">) {
  if (paper.primarySource === "mock" && paper.appPaperId) {
    const fallbackPaper = papers.find((item) => item.id === paper.appPaperId);
    if (fallbackPaper) {
      return fallbackPaper.compositeScore;
    }
  }

  let score = 32;

  if (paper.abstract) {
    score += 14;
  }

  if (paper.doi) {
    score += 12;
  }

  if (paper.pmid) {
    score += 8;
  }

  score += Math.min(12, paper.authors.length * 3);
  score += Math.min(10, paper.organisms.length * 4);
  score += Math.min(12, paper.editorTypes.length * 4);

  if (paper.journal) {
    score += journals.some((journal) => canonicalizeJournal(journal.name) === canonicalizeJournal(paper.journal)) ? 10 : 4;
  }

  if (paper.sources.length > 1) {
    score += 10;
  }

  if (paper.publishedAt) {
    const ageInDays = Math.max(0, Math.round((Date.now() - new Date(paper.publishedAt).getTime()) / 86_400_000));

    if (ageInDays <= 180) {
      score += 12;
    } else if (ageInDays <= 365) {
      score += 7;
    } else {
      score += 2;
    }
  }

  return Math.min(100, Math.round(score));
}

export function createCollectedPaper(input: Omit<CollectedPaper, "id" | "normalizedTitle" | "keywords" | "signalScore">) {
  const normalizedTitle = normalizeTitle(input.title);
  const paper: Omit<CollectedPaper, "signalScore"> = {
    ...input,
    id: `${input.primarySource}-${input.sourceIds[input.primarySource] ?? normalizedTitle.slice(0, 24)}`,
    normalizedTitle,
    keywords: buildPaperKeywords(input),
  };

  return {
    ...paper,
    signalScore: calculateSignalScore(paper),
  };
}

// ─── Network helpers ─────────────────────────────────────────────────────────

export const API_TIMEOUT_MS = 6500;

export async function fetchJson<T>(url: URL, source: Exclude<LiteratureSource, "mock">) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "GeneEditRadar/0.1",
    },
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${source} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

// ─── Extraction conversion ───────────────────────────────────────────────────

export function toExtractionSourcePaper(paper: CollectedPaper): ExtractionSourcePaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    journal: paper.journal,
    authors: paper.authors,
    publishedAt: paper.publishedAt,
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
    appPaperId: paper.appPaperId,
  };
}
