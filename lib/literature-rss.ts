import { XMLParser } from "fast-xml-parser";

import { normalizeDoi, type CollectedPaper, type LiteratureSourceStatus } from "@/lib/literature";
import { getConfiguredRssFeeds, type LiteratureRssFeed } from "@/lib/rss-feeds";
import { inferEditorTypes, inferOrganisms, normalizeTitle, normalizeWhitespace, stripMarkup, uniqueStrings } from "@/lib/shared-utils";

type RssSourceStatus = LiteratureSourceStatus & {
  feedUrl: string;
  label: string;
};

export type RssCollectionResult = {
  papers: CollectedPaper[];
  sourceStatuses: RssSourceStatus[];
};

const API_TIMEOUT_MS = 12_000;
const MAX_ITEMS_PER_FEED = 30;

const geneEditingTerms = [
  "crispr",
  "cas9",
  "cas12",
  "cas13",
  "base editor",
  "base editing",
  "adenine base editor",
  "cytosine base editor",
  "prime editor",
  "prime editing",
  "pegRNA",
  "sgRNA",
  "guide RNA",
  "genome editing",
  "gene editing",
  "epigenome editing",
  "rna editing",
  "tnpb",
  "talen",
  "zfn",
];

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return textValue(candidate["#text"] ?? candidate.__cdata ?? candidate.text ?? candidate.href ?? "");
  }

  return "";
}

function readLink(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = readLink(item);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return textValue(candidate.href ?? candidate.about ?? candidate.resource ?? candidate["#text"]).trim() || undefined;
  }

  return undefined;
}

function coerceIsoDate(...values: unknown[]) {
  for (const value of values) {
    const raw = textValue(value).trim();
    if (!raw) {
      continue;
    }

    const timestamp = Date.parse(raw);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  return undefined;
}

function extractDoi(...values: string[]) {
  const text = values.join(" ");
  const match = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return normalizeDoi(match?.[0]);
}

function buildKeywords(title: string, abstract: string, journal: string, editorTypes: string[], organisms: string[]) {
  const geneLikeTokens = `${title} ${abstract}`.match(/\b[A-Z0-9-]{3,8}\b/g) ?? [];

  return uniqueStrings([...editorTypes, ...organisms, journal, ...geneLikeTokens].map(stripMarkup));
}

function isGeneEditingRecord(title: string, abstract: string) {
  const text = normalizeTitle(`${title} ${abstract}`);
  return geneEditingTerms.some((term) => text.includes(normalizeTitle(term)));
}

function calculateRssSignalScore(input: {
  title: string;
  abstract: string;
  doi?: string;
  authors: string[];
  organisms: string[];
  editorTypes: string[];
  publishedAt?: string;
}) {
  let score = 36;

  if (input.abstract) {
    score += 14;
  }

  if (input.doi) {
    score += 12;
  }

  score += Math.min(10, input.authors.length * 2);
  score += Math.min(12, input.organisms.length * 4);
  score += Math.min(14, input.editorTypes.length * 5);

  if (input.publishedAt) {
    score += 10;
  }

  return Math.min(100, score);
}

function parseAuthors(item: Record<string, unknown>) {
  const rawAuthors = [
    ...toArray(item.creator),
    ...toArray(item.author),
    ...toArray(item["dc:creator"]),
  ];

  return uniqueStrings(
    rawAuthors
      .map((author) => {
        if (author && typeof author === "object") {
          const candidate = author as Record<string, unknown>;
          return textValue(candidate.name ?? candidate["#text"]);
        }

        return textValue(author);
      })
      .map(stripMarkup)
      .filter(Boolean),
  );
}

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const parsed = payload as Record<string, unknown>;
  const rssItems = toArray((parsed.rss as Record<string, unknown> | undefined)?.channel)
    .flatMap((channel) => toArray((channel as Record<string, unknown>).item));
  const rdfItems = toArray((parsed.RDF as Record<string, unknown> | undefined)?.item);
  const atomItems = toArray((parsed.feed as Record<string, unknown> | undefined)?.entry);
  const channelItems = toArray((parsed.channel as Record<string, unknown> | undefined)?.item);

  return [...rssItems, ...rdfItems, ...atomItems, ...channelItems].filter(
    (item): item is Record<string, unknown> => Boolean(item && typeof item === "object"),
  );
}

function normalizeRssItem(item: Record<string, unknown>, feed: LiteratureRssFeed): CollectedPaper | null {
  const title = stripMarkup(textValue(item.title));
  const abstract = stripMarkup(
    textValue(item.description ?? item.summary ?? item.encoded ?? item.content ?? item["content:encoded"]),
  );
  const url = readLink(item.link) ?? textValue(item.id).trim() ?? undefined;

  if (!title || !isGeneEditingRecord(title, abstract)) {
    return null;
  }

  const doi = extractDoi(title, abstract, url ?? "");
  const authors = parseAuthors(item);
  const publishedAt = coerceIsoDate(item.pubDate, item.published, item.updated, item.date, item["dc:date"]);
  const journal = feed.label.replace(/\s+AOP$/i, "");
  const editorTypes = inferEditorTypes(title, abstract);
  const organisms = inferOrganisms(title, abstract);
  const sourceRecordId = doi ?? url ?? `${feed.url}:${normalizeTitle(title)}`;
  const keywords = buildKeywords(title, abstract, journal, editorTypes, organisms);

  return {
    id: `rss-${normalizeTitle(sourceRecordId).slice(0, 48)}`,
    title,
    normalizedTitle: normalizeTitle(title),
    abstract,
    doi,
    journal,
    authors,
    publishedAt,
    url,
    organisms,
    editorTypes,
    keywords,
    sourceIds: { rss: sourceRecordId },
    sources: ["rss"],
    primarySource: "rss",
    signalScore: calculateRssSignalScore({ title, abstract, doi, authors, organisms, editorTypes, publishedAt }),
  };
}

async function fetchRssFeed(feed: LiteratureRssFeed): Promise<{ papers: CollectedPaper[]; status: RssSourceStatus }> {
  try {
    const response = await fetch(feed.url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "GeneEditRadar/0.1 literature monitoring demo",
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`${feed.label} returned ${response.status}`);
    }

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      removeNSPrefix: true,
    });
    const parsed = parser.parse(xml);
    const papers = extractItems(parsed)
      .map((item) => normalizeRssItem(item, feed))
      .filter((paper): paper is CollectedPaper => Boolean(paper))
      .slice(0, MAX_ITEMS_PER_FEED);

    return {
      papers,
      status: {
        source: "rss",
        ok: true,
        count: papers.length,
        feedUrl: feed.url,
        label: feed.label,
      },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source: "rss",
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown RSS feed error",
        feedUrl: feed.url,
        label: feed.label,
      },
    };
  }
}

export async function collectRssLiterature(feeds = getConfiguredRssFeeds()): Promise<RssCollectionResult> {
  const results = await Promise.all(feeds.map(fetchRssFeed));

  return {
    papers: results.flatMap((result) => result.papers),
    sourceStatuses: results.map((result) => result.status),
  };
}
