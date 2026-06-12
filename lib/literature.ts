import { cache } from "react";

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

export type LiteratureSource = "pubmed" | "europe-pmc" | "crossref" | "rss" | "biorxiv" | "medrxiv" | "mock";

export type CollectedPaper = {
  id: string;
  title: string;
  normalizedTitle: string;
  abstract: string;
  doi?: string;
  pmid?: string;
  journal: string;
  authors: string[];
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

type SourceResult = {
  papers: CollectedPaper[];
  status: LiteratureSourceStatus;
};

type ResolvedSubscription = RadarSubscription & {
  allKeywords: string[];
  allAuthorNames: string[];
  allJournalNames: string[];
  allOrganisms: string[];
  allEditorTypes: string[];
};

const SOURCE_PRIORITY: Record<LiteratureSource, number> = {
  mock: 0,
  rss: 1,
  crossref: 1,
  biorxiv: 1.5,
  medrxiv: 1.5,
  pubmed: 2,
  "europe-pmc": 3,
};

const MATCH_WEIGHTS = {
  keywords: 35,
  authors: 20,
  journals: 15,
  organisms: 15,
  editorTypes: 15,
} as const;

const API_TIMEOUT_MS = 6500;
const DEFAULT_LIMIT_PER_SOURCE = 6;

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripMarkup(value: string) {
  return normalizeWhitespace(decodeHtml(value).replace(/<[^>]+>/g, " "));
}

export function normalizeDoi(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/i, "");

  return normalized || undefined;
}

export function normalizePmid(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const digits = value.match(/\d+/g)?.join("");
  return digits || undefined;
}

export function normalizeTitle(value: string) {
  return normalizeWhitespace(
    stripMarkup(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " "),
  );
}

function normalizeKeyword(value: string) {
  return normalizeTitle(value);
}

function normalizePersonName(value: string) {
  return normalizeTitle(value)
    .replace(/\b(dr|phd|md|prof|professor)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeJournal(value: string) {
  return normalizeTitle(value);
}

function parseCrossrefDate(parts?: number[][]) {
  const date = parts?.[0];

  if (!date?.length) {
    return undefined;
  }

  const [year, month = 1, day = 1] = date;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function coerceIsoDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function inferOrganisms(...values: string[]) {
  const text = normalizeTitle(values.join(" "));
  const pairs: Array<[RegExp, string]> = [
    [/\b(human|patient|patients|clinical)\b/, "Human"],
    [/\b(primate|primates|macaque|macaques)\b/, "Primate"],
    [/\b(mouse|mice|murine)\b/, "Mouse"],
    [/\b(rat|rats)\b/, "Rat"],
    [/\b(rodent|rodents)\b/, "Rodent"],
    [/\b(canine|dog|dogs)\b/, "Canine"],
    [/\b(nonhuman primate|non human primate)\b/, "Primate"],
    [/\b(large animal|large animal model)\b/, "Large animal"],
    [/\b(zebrafish)\b/, "Zebrafish"],
  ];

  return uniqueStrings(
    pairs
      .filter(([pattern]) => pattern.test(text))
      .map(([, label]) => label),
  );
}

function inferEditorTypes(...values: string[]) {
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

function buildPaperKeywords(input: {
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

function buildSourceUrl(source: LiteratureSource, paper: { doi?: string; pmid?: string; url?: string }, sourceId?: string) {
  if (paper.url) {
    return paper.url;
  }

  if (paper.doi) {
    return `https://doi.org/${paper.doi}`;
  }

  if (source === "pubmed" && paper.pmid) {
    return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  }

  if (source === "europe-pmc" && sourceId) {
    return `https://europepmc.org/article/${sourceId}`;
  }

  return undefined;
}

function calculateSignalScore(paper: Omit<CollectedPaper, "signalScore">) {
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

function createCollectedPaper(input: Omit<CollectedPaper, "id" | "normalizedTitle" | "keywords" | "signalScore">) {
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

function parseAuthorList(rawAuthors: Array<{ name?: string; authname?: string; given?: string; family?: string }> | undefined) {
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

async function fetchJson<T>(url: URL, source: Exclude<LiteratureSource, "mock">) {
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

function buildSearchTerms() {
  const subscriptionTerms = subscriptions.flatMap((subscription) => [
    ...subscription.keywords,
    ...subscription.organisms,
    ...subscription.editorTypes,
    ...(subscription.geneSymbol ? [subscription.geneSymbol] : []),
    ...(subscription.topicSlug ? [topics.find((topic) => topic.slug === subscription.topicSlug)?.label ?? ""] : []),
  ]);

  return uniqueStrings([
    "gene editing",
    "CRISPR",
    "base editing",
    "prime editing",
    "cell therapy",
    ...subscriptionTerms,
  ]).slice(0, 12);
}

function buildBooleanQuery() {
  return `(${buildSearchTerms()
    .map((term) => (term.includes(" ") ? `"${term}"` : term))
    .join(" OR ")})`;
}

function buildCrossrefQuery() {
  return buildSearchTerms().join(" ");
}

async function searchPubMed(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const esearchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  esearchUrl.search = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(limit),
    sort: "pub_date",
    term: buildBooleanQuery(),
    tool: "GeneEditRadar",
  }).toString();

  type ESearchResponse = {
    esearchresult?: {
      idlist?: string[];
    };
  };

  type ESummaryDoc = {
    uid?: string;
    title?: string;
    fulljournalname?: string;
    pubdate?: string;
    authors?: Array<{ name?: string; authname?: string }>;
    articleids?: Array<{ idtype?: string; value?: string }>;
  };

  type ESummaryResponse = {
    result?: Record<string, ESummaryDoc> & {
      uids?: string[];
    };
  };

  try {
    const searchPayload = await fetchJson<ESearchResponse>(esearchUrl, "pubmed");
    const ids = searchPayload.esearchresult?.idlist ?? [];

    if (ids.length === 0) {
      return {
        papers: [],
        status: { source: "pubmed", ok: true, count: 0 },
      };
    }

    const esummaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    esummaryUrl.search = new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      id: ids.join(","),
      tool: "GeneEditRadar",
    }).toString();

    const summaryPayload = await fetchJson<ESummaryResponse>(esummaryUrl, "pubmed");
    const docs = (summaryPayload.result?.uids ?? [])
      .map((uid) => summaryPayload.result?.[uid])
      .filter(Boolean) as ESummaryDoc[];

    const normalized = docs
      .filter((doc) => doc.title)
      .map((doc) => {
        const doi = normalizeDoi(doc.articleids?.find((articleId) => articleId.idtype?.toLowerCase() === "doi")?.value);
        const pmid = normalizePmid(doc.uid);
        const title = stripMarkup(doc.title ?? "");
        const journal = stripMarkup(doc.fulljournalname ?? "");
        const authorsList = parseAuthorList(doc.authors);

        return createCollectedPaper({
          title,
          abstract: "",
          doi,
          pmid,
          journal,
          authors: authorsList,
          publishedAt: coerceIsoDate(doc.pubdate),
          url: buildSourceUrl("pubmed", { doi, pmid }, undefined),
          organisms: inferOrganisms(title, journal),
          editorTypes: inferEditorTypes(title),
          sourceIds: { pubmed: pmid },
          sources: ["pubmed"],
          primarySource: "pubmed",
        });
      });

    return {
      papers: normalized,
      status: { source: "pubmed", ok: true, count: normalized.length },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source: "pubmed",
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown PubMed error",
      },
    };
  }
}

async function searchEuropePmc(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.search = new URLSearchParams({
    query: buildBooleanQuery(),
    format: "json",
    pageSize: String(limit),
    resultType: "core",
    sort_date: "y",
  }).toString();

  type EuropePmcResult = {
    id?: string;
    source?: string;
    pmid?: string;
    doi?: string;
    title?: string;
    journalTitle?: string;
    firstPublicationDate?: string;
    authorString?: string;
    abstractText?: string;
    authorList?: {
      author?: Array<{ fullName?: string; firstName?: string; lastName?: string }>;
    };
  };

  type EuropePmcResponse = {
    resultList?: {
      result?: EuropePmcResult[];
    };
  };

  try {
    const payload = await fetchJson<EuropePmcResponse>(url, "europe-pmc");
    const results = payload.resultList?.result ?? [];

    const normalized = results
      .filter((result) => result.title)
      .map((result) => {
        const title = stripMarkup(result.title ?? "");
        const abstract = stripMarkup(result.abstractText ?? "");
        const doi = normalizeDoi(result.doi);
        const pmid = normalizePmid(result.pmid);
        const authorsList =
          result.authorList?.author?.length
            ? uniqueStrings(
                result.authorList.author
                  .map((author) => author.fullName ?? [author.firstName, author.lastName].filter(Boolean).join(" "))
                  .filter(Boolean)
                  .map(stripMarkup),
              )
            : uniqueStrings((result.authorString ?? "").split(/,\s*/).map(stripMarkup));

        return createCollectedPaper({
          title,
          abstract,
          doi,
          pmid,
          journal: stripMarkup(result.journalTitle ?? ""),
          authors: authorsList,
          publishedAt: coerceIsoDate(result.firstPublicationDate),
          url: buildSourceUrl(
            "europe-pmc",
            { doi, pmid },
            `${result.source ?? "MED"}/${result.id ?? result.pmid ?? ""}`,
          ),
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { "europe-pmc": result.id ?? result.pmid ?? title },
          sources: ["europe-pmc"],
          primarySource: "europe-pmc",
        });
      });

    return {
      papers: normalized,
      status: { source: "europe-pmc", ok: true, count: normalized.length },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source: "europe-pmc",
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown Europe PMC error",
      },
    };
  }
}

async function searchCrossref(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    query: buildCrossrefQuery(),
    rows: String(limit),
  }).toString();

  type CrossrefItem = {
    DOI?: string;
    title?: string[];
    author?: Array<{ given?: string; family?: string; name?: string }>;
    issued?: { "date-parts"?: number[][] };
    "container-title"?: string[];
    abstract?: string;
    URL?: string;
  };

  type CrossrefResponse = {
    message?: {
      items?: CrossrefItem[];
    };
  };

  try {
    const payload = await fetchJson<CrossrefResponse>(url, "crossref");
    const items = payload.message?.items ?? [];

    const normalized = items
      .filter((item) => item.title?.[0])
      .map((item) => {
        const title = stripMarkup(item.title?.[0] ?? "");
        const abstract = stripMarkup(item.abstract ?? "");
        const doi = normalizeDoi(item.DOI);

        return createCollectedPaper({
          title,
          abstract,
          doi,
          journal: stripMarkup(item["container-title"]?.[0] ?? ""),
          authors: parseAuthorList(item.author),
          publishedAt: parseCrossrefDate(item.issued?.["date-parts"]),
          url: buildSourceUrl("crossref", { doi, url: item.URL }, undefined),
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { crossref: doi ?? title },
          sources: ["crossref"],
          primarySource: "crossref",
        });
      });

    return {
      papers: normalized,
      status: { source: "crossref", ok: true, count: normalized.length },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source: "crossref",
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown Crossref error",
      },
    };
  }
}

function normalizeMockPaper(paper: RadarPaper) {
  const journal = journals.find((journalItem) => journalItem.slug === paper.journalSlug)?.name ?? paper.journalSlug;
  const authorNames = paper.authorIds
    .map((authorId) => authors.find((author) => author.id === authorId)?.name)
    .filter(Boolean) as string[];

  return createCollectedPaper({
    title: paper.title,
    abstract: paper.abstract,
    doi: normalizeDoi(paper.doi),
    pmid: normalizePmid(paper.pmid),
    journal,
    authors: authorNames,
    publishedAt: paper.publishedAt,
    url: undefined,
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
    sourceIds: { mock: paper.id },
    sources: ["mock"],
    primarySource: "mock",
    appPaperId: paper.id,
  });
}

function chooseBestString(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => (right?.length ?? 0) - (left?.length ?? 0))[0];
}

function toExtractionSourcePaper(paper: CollectedPaper): ExtractionSourcePaper {
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

async function fetchUnpaywallOA(doi: string): Promise<string | null> {
  const email = process.env.UNPAYWALL_EMAIL || "team@geneeditradar.demo";
  const url = new URL(`https://api.unpaywall.org/v2/${doi}`);
  url.searchParams.set("email", email);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const data = await response.json();
    return data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || null;
  } catch {
    return null;
  }
}

async function fetchPmcFullText(pmid?: string, doi?: string): Promise<string | null> {
  // 优先尝试 Europe PMC 的 REST API 获取 XML
  const query = pmid ? `ext_id:${pmid}` : doi ? `doi:${doi}` : null;
  if (!query) return null;

  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.resultList?.result?.[0];
    
    if (result?.isOpenAccess === "Y" && result.pmcid) {
      // 获取全文 XML
      const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${result.pmcid}/fullTextXML`;
      const xmlRes = await fetch(fullTextUrl, { signal: AbortSignal.timeout(5000) });
      if (xmlRes.ok) {
        const xml = await xmlRes.text();
        // 简单提取正文（去除标签，提取段落）
        return xml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30000); // 截取前 30k 字符
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function enrichCollectedPaper(paper: CollectedPaper): Promise<ExtractedCollectedPaper> {
  // 尝试获取全文
  let fullText: string | undefined = undefined;
  if (paper.pmid || paper.doi) {
    fullText = (await fetchPmcFullText(paper.pmid, paper.doi)) ?? undefined;
    if (!fullText && paper.doi) {
      const oaUrl = await fetchUnpaywallOA(paper.doi);
      if (oaUrl) {
        console.log(`Found OA URL for ${paper.doi}: ${oaUrl}`);
      }
    }
  }

  const enrichedPaper = {
    ...paper,
    fullText,
  };

  return {
    ...enrichedPaper,
    extraction: await extractGeneEditingDetails({
      ...toExtractionSourcePaper(enrichedPaper),
      fullText,
    }),
  };
}

export function dedupePapers(input: CollectedPaper[]) {
  const parents = input.map((_, index) => index);

  const find = (index: number): number => {
    if (parents[index] !== index) {
      parents[index] = find(parents[index]);
    }

    return parents[index];
  };

  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parents[rightRoot] = leftRoot;
    }
  };

  const doiMap = new Map<string, number>();
  const pmidMap = new Map<string, number>();
  const titleMap = new Map<string, number>();

  input.forEach((paper, index) => {
    if (paper.doi) {
      const existing = doiMap.get(paper.doi);
      if (existing !== undefined) {
        union(existing, index);
      } else {
        doiMap.set(paper.doi, index);
      }
    }

    if (paper.pmid) {
      const existing = pmidMap.get(paper.pmid);
      if (existing !== undefined) {
        union(existing, index);
      } else {
        pmidMap.set(paper.pmid, index);
      }
    }

    if (paper.normalizedTitle.length >= 20) {
      const existing = titleMap.get(paper.normalizedTitle);
      if (existing !== undefined) {
        union(existing, index);
      } else {
        titleMap.set(paper.normalizedTitle, index);
      }
    }
  });

  const groups = new Map<number, CollectedPaper[]>();

  input.forEach((paper, index) => {
    const root = find(index);
    const existing = groups.get(root) ?? [];
    existing.push(paper);
    groups.set(root, existing);
  });

  return Array.from(groups.values()).map((group) => {
    const ordered = [...group].sort((left, right) => {
      const sourceDelta = SOURCE_PRIORITY[right.primarySource] - SOURCE_PRIORITY[left.primarySource];
      if (sourceDelta !== 0) {
        return sourceDelta;
      }

      return (right.abstract.length || 0) - (left.abstract.length || 0);
    });

    const base = ordered[0];
    const mergedWithoutScore: Omit<CollectedPaper, "signalScore"> = {
      ...base,
      title: chooseBestString(ordered.map((paper) => paper.title)) ?? base.title,
      normalizedTitle: base.normalizedTitle,
      abstract: chooseBestString(ordered.map((paper) => paper.abstract)) ?? "",
      doi: chooseBestString(ordered.map((paper) => paper.doi)) ?? undefined,
      pmid: chooseBestString(ordered.map((paper) => paper.pmid)) ?? undefined,
      journal: chooseBestString(ordered.map((paper) => paper.journal)) ?? "",
      authors: uniqueStrings(ordered.flatMap((paper) => paper.authors)),
      publishedAt: chooseBestString(ordered.map((paper) => paper.publishedAt)) ?? undefined,
      url: chooseBestString([
        ordered.find((paper) => paper.doi)?.url,
        ...ordered.map((paper) => paper.url),
      ]),
      organisms: uniqueStrings(ordered.flatMap((paper) => paper.organisms)),
      editorTypes: uniqueStrings(ordered.flatMap((paper) => paper.editorTypes)),
      keywords: uniqueStrings(ordered.flatMap((paper) => paper.keywords)),
      sourceIds: ordered.reduce<Partial<Record<LiteratureSource, string>>>((accumulator, paper) => {
        return { ...accumulator, ...paper.sourceIds };
      }, {}),
      sources: uniqueStrings(ordered.flatMap((paper) => paper.sources)) as LiteratureSource[],
      primarySource: base.primarySource,
      appPaperId: chooseBestString(ordered.map((paper) => paper.appPaperId)) ?? undefined,
      id: base.id,
    };

    return {
      ...mergedWithoutScore,
      signalScore: calculateSignalScore(mergedWithoutScore),
    };
  });
}

function resolveSubscription(subscription: RadarSubscription): ResolvedSubscription {
  const journalName = subscription.journalSlug
    ? journals.find((journal) => journal.slug === subscription.journalSlug)?.name
    : undefined;
  const topicLabel = subscription.topicSlug
    ? topics.find((topic) => topic.slug === subscription.topicSlug)?.label
    : undefined;

  return {
    ...subscription,
    allKeywords: uniqueStrings([
      ...subscription.keywords,
      ...(subscription.geneSymbol ? [subscription.geneSymbol] : []),
      ...(topicLabel ? [topicLabel] : []),
    ]),
    allAuthorNames: uniqueStrings(subscription.authorNames),
    allJournalNames: uniqueStrings([...subscription.journalNames, ...(journalName ? [journalName] : [])]),
    allOrganisms: uniqueStrings(subscription.organisms),
    allEditorTypes: uniqueStrings(subscription.editorTypes),
  };
}

function phraseIncluded(haystack: string, needle: string) {
  const normalizedNeedle = normalizeKeyword(needle);
  return normalizedNeedle.length > 0 && haystack.includes(normalizedNeedle);
}

export function matchPaperToSubscription(paper: CollectedPaper, rawSubscription: RadarSubscription): PaperMatch {
  const subscription = resolveSubscription(rawSubscription);
  const searchText = normalizeKeyword(
    [paper.title, paper.abstract, paper.journal, ...paper.authors, ...paper.keywords, ...paper.editorTypes, ...paper.organisms].join(" "),
  );
  const normalizedAuthors = paper.authors.map(normalizePersonName);
  const normalizedJournal = canonicalizeJournal(paper.journal);
  const normalizedOrganisms = paper.organisms.map(normalizeKeyword);
  const normalizedEditorTypes = paper.editorTypes.map(normalizeKeyword);

  const matchedKeywords = subscription.allKeywords.filter((keyword) => phraseIncluded(searchText, keyword));
  const matchedAuthors = subscription.allAuthorNames.filter((authorName) => {
    const normalizedAuthor = normalizePersonName(authorName);
    return normalizedAuthors.some(
      (candidate) => candidate.includes(normalizedAuthor) || normalizedAuthor.includes(candidate),
    );
  });
  const matchedJournals = subscription.allJournalNames.filter((journalName) => {
    const normalizedMatch = canonicalizeJournal(journalName);
    return normalizedJournal.length > 0 && (normalizedJournal.includes(normalizedMatch) || normalizedMatch.includes(normalizedJournal));
  });
  const matchedOrganisms = subscription.allOrganisms.filter((organism) =>
    normalizedOrganisms.includes(normalizeKeyword(organism)),
  );
  const matchedEditorTypes = subscription.allEditorTypes.filter((editorType) => {
    const normalizedEditorType = normalizeKeyword(editorType);
    return normalizedEditorTypes.includes(normalizedEditorType) || phraseIncluded(searchText, editorType);
  });

  const activeWeight =
    (subscription.allKeywords.length ? MATCH_WEIGHTS.keywords : 0) +
    (subscription.allAuthorNames.length ? MATCH_WEIGHTS.authors : 0) +
    (subscription.allJournalNames.length ? MATCH_WEIGHTS.journals : 0) +
    (subscription.allOrganisms.length ? MATCH_WEIGHTS.organisms : 0) +
    (subscription.allEditorTypes.length ? MATCH_WEIGHTS.editorTypes : 0);

  const earnedWeight =
    (subscription.allKeywords.length ? (matchedKeywords.length / subscription.allKeywords.length) * MATCH_WEIGHTS.keywords : 0) +
    (subscription.allAuthorNames.length ? (matchedAuthors.length / subscription.allAuthorNames.length) * MATCH_WEIGHTS.authors : 0) +
    (subscription.allJournalNames.length ? (matchedJournals.length / subscription.allJournalNames.length) * MATCH_WEIGHTS.journals : 0) +
    (subscription.allOrganisms.length ? (matchedOrganisms.length / subscription.allOrganisms.length) * MATCH_WEIGHTS.organisms : 0) +
    (subscription.allEditorTypes.length ? (matchedEditorTypes.length / subscription.allEditorTypes.length) * MATCH_WEIGHTS.editorTypes : 0);

  const matchScore = activeWeight === 0 ? 0 : Math.round((earnedWeight / activeWeight) * 100);
  const isMatch = matchScore >= 55 && paper.signalScore >= subscription.signalThreshold;

  return {
    subscriptionId: subscription.id,
    subscriptionLabel: subscription.label,
    matchScore,
    threshold: subscription.signalThreshold,
    isMatch,
    matchedKeywords,
    matchedAuthors,
    matchedJournals,
    matchedOrganisms,
    matchedEditorTypes,
    reasons: uniqueStrings([
      ...matchedKeywords.map((item) => `Keyword: ${item}`),
      ...matchedAuthors.map((item) => `Author: ${item}`),
      ...matchedJournals.map((item) => `Journal: ${item}`),
      ...matchedOrganisms.map((item) => `Organism: ${item}`),
      ...matchedEditorTypes.map((item) => `Editor: ${item}`),
    ]),
  };
}

async function searchPreprints(source: "biorxiv" | "medrxiv", limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const doiPrefix = source === "biorxiv" ? "10.1101" : "10.1101"; // Both are often 10.1101 but medRxiv is also 10.1101. Actually bioRxiv is 10.1101. medRxiv is 10.1101 too? No, medRxiv is 10.1101 as well but different volume?
  // Actually, let's just use Crossref with a filter.
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    query: buildCrossrefQuery(),
    filter: `prefix:${doiPrefix}`, // bioRxiv prefix
    rows: String(limit),
    sort: "published",
    order: "desc",
  }).toString();

  type CrossrefItem = {
    DOI?: string;
    title?: string[];
    author?: Array<{ given?: string; family?: string; name?: string }>;
    issued?: { "date-parts"?: number[][] };
    "container-title"?: string[];
    abstract?: string;
    URL?: string;
    type?: string;
  };

  type CrossrefResponse = {
    message?: {
      items?: CrossrefItem[];
    };
  };

  try {
    const payload = await fetchJson<CrossrefResponse>(url, "crossref");
    const items = payload.message?.items ?? [];

    const normalized = items
      .filter((item) => item.title?.[0])
      .map((item) => {
        const title = stripMarkup(item.title?.[0] ?? "");
        const abstract = stripMarkup(item.abstract ?? "");
        const doi = normalizeDoi(item.DOI);

        return createCollectedPaper({
          title,
          abstract,
          doi,
          journal: source === "biorxiv" ? "bioRxiv" : "medRxiv",
          authors: parseAuthorList(item.author),
          publishedAt: parseCrossrefDate(item.issued?.["date-parts"]),
          url: buildSourceUrl("crossref", { doi, url: item.URL }, undefined),
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { [source]: doi ?? title },
          sources: [source],
          primarySource: source,
        });
      });

    return {
      papers: normalized,
      status: { source, ok: true, count: normalized.length },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source,
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : `Unknown ${source} error`,
      },
    };
  }
}

export async function collectExternalLiterature(): Promise<LiteratureCollectionResult> {
  const results = await Promise.all([
    searchPubMed(), 
    searchEuropePmc(), 
    searchCrossref(),
    searchPreprints("biorxiv"),
    searchPreprints("medrxiv"),
  ]);
  const collected = results.flatMap((result) => result.papers);
  const deduped = dedupePapers(collected);

  if (deduped.length > 0) {
    return {
      papers: deduped.sort((left, right) => {
        if (right.signalScore !== left.signalScore) {
          return right.signalScore - left.signalScore;
        }

        return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
      }),
      sourceStatuses: results.map((result) => result.status),
      usedFallback: false,
    };
  }

  return {
    papers: [],
    sourceStatuses: results.map((result) => result.status),
    usedFallback: false,
  };
}

async function collectLiterature(): Promise<LiteratureCollectionResult> {
  const externalCollection = await collectExternalLiterature();

  if (externalCollection.papers.length > 0) {
    return externalCollection;
  }

  return {
    papers: papers.map(normalizeMockPaper).sort((left, right) => right.signalScore - left.signalScore),
    sourceStatuses: externalCollection.sourceStatuses,
    usedFallback: true,
  };
}

export const getLiteratureCollection = cache(collectLiterature);

export const getExtractedLiteratureCollection = cache(async (): Promise<{
  papers: ExtractedCollectedPaper[];
  sourceStatuses: LiteratureSourceStatus[];
  usedFallback: boolean;
}> => {
  const collection = await getLiteratureCollection();

  return {
    papers: await Promise.all(collection.papers.map(enrichCollectedPaper)),
    sourceStatuses: collection.sourceStatuses,
    usedFallback: collection.usedFallback,
  };
});

export const getSubscriptionIntelligence = cache(async (): Promise<SubscriptionIntelligence> => {
  const collection = await getExtractedLiteratureCollection();

  const matchedPapers = collection.papers
    .map((paper) => {
      const matches = subscriptions
        .map((subscription) => matchPaperToSubscription(paper, subscription))
        .filter((match) => match.isMatch)
        .sort((left, right) => right.matchScore - left.matchScore);

      return {
        ...paper,
        matches,
        topMatchScore: matches[0]?.matchScore ?? 0,
      };
    })
    .filter((paper) => paper.matches.length > 0)
    .sort((left, right) => {
      if (right.topMatchScore !== left.topMatchScore) {
        return right.topMatchScore - left.topMatchScore;
      }

      if (right.signalScore !== left.signalScore) {
        return right.signalScore - left.signalScore;
      }

      return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
    });

  const subscriptionOverviews = subscriptions.map<SubscriptionOverview>((subscription) => {
    const subscriptionMatches = matchedPapers
      .flatMap((paper) =>
        paper.matches
          .filter((match) => match.subscriptionId === subscription.id)
          .map((match) => ({ paper, match })),
      )
      .sort((left, right) => right.match.matchScore - left.match.matchScore);

    const resolved = resolveSubscription(subscription);

    return {
      ...subscription,
      matchingPaperCount: subscriptionMatches.length,
      bestMatchScore: subscriptionMatches[0]?.match.matchScore ?? 0,
      matchedPaperTitles: subscriptionMatches.slice(0, 3).map((item) => item.paper.title),
      filterSummary: uniqueStrings([
        ...resolved.allKeywords,
        ...resolved.allAuthorNames,
        ...resolved.allJournalNames,
        ...resolved.allOrganisms,
        ...resolved.allEditorTypes,
      ]).slice(0, 6),
    };
  });

  return {
    papers: matchedPapers,
    sourceStatuses: collection.sourceStatuses,
    subscriptionOverviews,
    usedFallback: collection.usedFallback,
  };
});
