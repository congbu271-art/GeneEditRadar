import { analysisSeedPapers, authors, journals, papers, topics, type RadarPaper } from "@/lib/mock-data";
import {
  NOT_REPORTED,
  extractGeneEditingDetails,
  type ExtractionSourcePaper,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";
import {
  dedupePapers,
  normalizeDoi,
  normalizePmid,
  normalizeTitle,
  type CollectedPaper,
  type LiteratureSource,
} from "@/lib/literature";
import {
  evaluateGeneEditingIdea,
  generateIdeasForSeedPaper,
  type GeneratedResearchIdea,
  type IdeaSeedPaper,
} from "@/lib/research-ideas";
import {
  getLocalizedEvaluationCopy,
  getLocalizedIdeaCopy,
  toZhExtractionValue,
  toZhIdeaType,
  toZhJournalTier,
  toZhSourceName,
} from "@/lib/ui-zh";
import type {
  AnalyzeEvaluation,
  AnalyzeIdea,
  AnalyzeMode,
  AnalyzePaper,
  PaperStrategySummary,
  AnalyzeRequestInput,
  AnalyzeResponse,
  GeneEditingFeature,
  JournalSuggestion,
  PaperQueryKind,
  TechnologyTransferPath,
  TechnologyTransferPathSummary,
} from "@/lib/analyze-types";

export type {
  AnalyzeEvaluation,
  AnalyzeIdea,
  AnalyzeMode,
  AnalyzePaper,
  PaperStrategySummary,
  AnalyzeRequestInput,
  AnalyzeResponse,
  GeneEditingFeature,
  JournalSuggestion,
  PaperQueryKind,
  TechnologyTransferPath,
  TechnologyTransferPathSummary,
} from "@/lib/analyze-types";

export const ANALYZE_NOT_REPORTED = "未报道";

type SourceStatus = {
  source: Exclude<LiteratureSource, "mock">;
  ok: boolean;
  count: number;
  error?: string;
};

type SourceResult = {
  papers: CollectedPaper[];
  status: SourceStatus;
};

type RankedPaper = CollectedPaper & {
  relevanceScore: number;
};

type PaperQueryDetection = {
  kind: PaperQueryKind;
  normalizedQuery: string;
};

type AnalyzeQueryResult = {
  papers: RankedPaper[];
  usedFallback: boolean;
  sourceStatuses: SourceStatus[];
  warnings: string[];
};

type AnalyzePaperQueryResult = AnalyzeQueryResult & {
  detection: PaperQueryDetection;
  seed?: RankedPaper;
};

const API_TIMEOUT_MS = 6_500;
const DEFAULT_ANALYSIS_LIMIT = 8;
const DEFAULT_PAPER_IDEA_LIMIT = 5;

const transferPathOrder: TechnologyTransferPath[] = [
  "mammalian_cell_to_plant",
  "animal_to_plant",
  "monocot_to_dicot",
  "crop_to_crop",
  "model_plant_to_crop",
  "tool_to_trait",
  "single_target_to_multiplex",
  "efficiency_optimization",
  "delivery_optimization",
  "specificity_optimization",
];

const transferPathLabelMap: Record<TechnologyTransferPath, string> = {
  animal_to_plant: "动物/细胞体系 → 植物体系",
  mammalian_cell_to_plant: "哺乳动物细胞体系 → 植物体系",
  monocot_to_dicot: "单子叶作物 → 双子叶作物",
  model_plant_to_crop: "模式植物 → 经济作物",
  crop_to_crop: "作物体系 → 其他作物体系",
  tool_to_trait: "工具验证 → 性状应用",
  single_target_to_multiplex: "单靶点 → 多靶点/通路编辑",
  efficiency_optimization: "编辑效率优化",
  delivery_optimization: "递送体系优化",
  specificity_optimization: "特异性/脱靶优化",
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkup(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function canonicalizeJournal(value: string) {
  return normalizeTitle(value);
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

function parseCrossrefDate(parts?: number[][]) {
  const date = parts?.[0];

  if (!date?.length) {
    return undefined;
  }

  const [year, month = 1, day = 1] = date;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function inferOrganisms(...values: string[]) {
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

  const geneLikeTokens = `${input.title} ${input.abstract}`.match(/\b[A-Z0-9-]{3,8}\b/g) ?? [];

  return uniqueStrings([...tokens, ...geneLikeTokens].map(stripMarkup));
}

function calculateSignalScore(paper: Omit<CollectedPaper, "signalScore">) {
  let score = 34;

  if (paper.abstract) {
    score += 12;
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
  score += paper.journal ? 6 : 0;

  if (paper.sources.length > 1) {
    score += 8;
  }

  if (paper.publishedAt) {
    const ageInDays = Math.max(0, Math.round((Date.now() - new Date(paper.publishedAt).getTime()) / 86_400_000));

    if (ageInDays <= 180) {
      score += 10;
    } else if (ageInDays <= 365) {
      score += 6;
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

function normalizeMockPaper(paper: RadarPaper): CollectedPaper {
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
    url: paper.doi ? `https://doi.org/${paper.doi}` : undefined,
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
    sourceIds: { mock: paper.id },
    sources: ["mock"],
    primarySource: "mock",
    appPaperId: paper.id,
  });
}

function normalizeAnalysisSeedPaper(paper: (typeof analysisSeedPapers)[number]): CollectedPaper {
  return createCollectedPaper({
    title: paper.title,
    abstract: paper.abstract,
    doi: normalizeDoi(paper.doi),
    pmid: normalizePmid(paper.pmid),
    journal: paper.journal,
    authors: paper.authors,
    publishedAt: paper.publishedAt,
    url: paper.doi ? `https://doi.org/${paper.doi}` : undefined,
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
    sourceIds: { mock: paper.id },
    sources: ["mock"],
    primarySource: "mock",
  });
}

const mockCollectedPapers = [...papers.map(normalizeMockPaper), ...analysisSeedPapers.map(normalizeAnalysisSeedPaper)];

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

async function searchPubMedByKeyword(query: string, limit = DEFAULT_ANALYSIS_LIMIT): Promise<SourceResult> {
  const esearchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  esearchUrl.search = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(limit),
    sort: "pub_date",
    term: query,
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
      return { papers: [], status: { source: "pubmed", ok: true, count: 0 } };
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
          url: doi ? `https://doi.org/${doi}` : pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
          organisms: inferOrganisms(title, journal),
          editorTypes: inferEditorTypes(title),
          sourceIds: { pubmed: pmid ?? title },
          sources: ["pubmed"],
          primarySource: "pubmed",
        });
      });

    return { papers: normalized, status: { source: "pubmed", ok: true, count: normalized.length } };
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

async function searchPubMedByReference(detection: PaperQueryDetection): Promise<SourceResult> {
  if (detection.kind === "pmid") {
    return searchPubMedByKeyword(detection.normalizedQuery, 1);
  }

  if (detection.kind === "doi") {
    return searchPubMedByKeyword(`${detection.normalizedQuery}[AID]`, 3);
  }

  return searchPubMedByKeyword(`"${detection.normalizedQuery}"`, 5);
}

async function searchEuropePmc(query: string, limit = DEFAULT_ANALYSIS_LIMIT): Promise<SourceResult> {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.search = new URLSearchParams({
    query,
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
          url: doi
            ? `https://doi.org/${doi}`
            : result.id
              ? `https://europepmc.org/article/${result.source ?? "MED"}/${result.id}`
              : undefined,
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { "europe-pmc": result.id ?? result.pmid ?? title },
          sources: ["europe-pmc"],
          primarySource: "europe-pmc",
        });
      });

    return { papers: normalized, status: { source: "europe-pmc", ok: true, count: normalized.length } };
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

async function searchEuropePmcByReference(detection: PaperQueryDetection): Promise<SourceResult> {
  if (detection.kind === "doi") {
    return searchEuropePmc(`DOI:"${detection.normalizedQuery}"`, 3);
  }

  if (detection.kind === "pmid") {
    return searchEuropePmc(`EXT_ID:${detection.normalizedQuery} AND SRC:MED`, 3);
  }

  return searchEuropePmc(`"${detection.normalizedQuery}"`, 5);
}

async function searchCrossref(query: string, limit = DEFAULT_ANALYSIS_LIMIT): Promise<SourceResult> {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    query,
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
          url: doi ? `https://doi.org/${doi}` : item.URL,
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { crossref: doi ?? title },
          sources: ["crossref"],
          primarySource: "crossref",
        });
      });

    return { papers: normalized, status: { source: "crossref", ok: true, count: normalized.length } };
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

async function searchCrossrefByReference(detection: PaperQueryDetection): Promise<SourceResult> {
  if (detection.kind === "doi") {
    const url = new URL("https://api.crossref.org/works");
    url.search = new URLSearchParams({
      filter: `doi:${detection.normalizedQuery}`,
      rows: "3",
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
        .map((item) =>
          createCollectedPaper({
            title: stripMarkup(item.title?.[0] ?? ""),
            abstract: stripMarkup(item.abstract ?? ""),
            doi: normalizeDoi(item.DOI),
            journal: stripMarkup(item["container-title"]?.[0] ?? ""),
            authors: parseAuthorList(item.author),
            publishedAt: parseCrossrefDate(item.issued?.["date-parts"]),
            url: item.URL,
            organisms: inferOrganisms(item.title?.[0] ?? "", item.abstract ?? ""),
            editorTypes: inferEditorTypes(item.title?.[0] ?? "", item.abstract ?? ""),
            sourceIds: { crossref: normalizeDoi(item.DOI) ?? item.title?.[0] ?? detection.normalizedQuery },
            sources: ["crossref"],
            primarySource: "crossref",
          }),
        );

      return { papers: normalized, status: { source: "crossref", ok: true, count: normalized.length } };
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

  if (detection.kind === "title") {
    const url = new URL("https://api.crossref.org/works");
    url.search = new URLSearchParams({
      "query.title": detection.normalizedQuery,
      rows: "5",
    }).toString();

    return searchCrossref(url.searchParams.get("query.title") ?? detection.normalizedQuery, 5);
  }

  return searchCrossref(detection.normalizedQuery, 3);
}

function tokenizeQuery(query: string) {
  return uniqueStrings(normalizeTitle(query).split(" ").filter((token) => token.length >= 2));
}

function scoreKeywordRelevance(paper: CollectedPaper, query: string) {
  const normalizedQuery = normalizeTitle(query);
  const tokens = tokenizeQuery(query);
  const title = paper.normalizedTitle;
  const abstract = normalizeTitle(paper.abstract);
  const journal = canonicalizeJournal(paper.journal);
  const combined = normalizeTitle(
    [paper.title, paper.abstract, paper.journal, ...paper.authors, ...paper.organisms, ...paper.editorTypes, ...paper.keywords].join(" "),
  );

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 52;
  }

  if (abstract.includes(normalizedQuery)) {
    score += 28;
  }

  if (journal.includes(normalizedQuery)) {
    score += 12;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 11;
    }

    if (abstract.includes(token)) {
      score += 6;
    }

    if (combined.includes(token)) {
      score += 3;
    }
  }

  if (paper.doi && normalizeDoi(query) === paper.doi) {
    score += 80;
  }

  if (paper.pmid && normalizePmid(query) === paper.pmid) {
    score += 80;
  }

  return score + Math.round(paper.signalScore * 0.35);
}

function scoreTitleReferenceMatch(paper: CollectedPaper, query: string) {
  const normalizedQuery = normalizeTitle(query);
  const title = paper.normalizedTitle;
  const tokens = tokenizeQuery(query);

  if (title === normalizedQuery) {
    return 220;
  }

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 140;
  }

  const matchedTokens = tokens.filter((token) => title.includes(token)).length;
  if (tokens.length > 0) {
    score += Math.round((matchedTokens / tokens.length) * 80);
  }

  return score + Math.round(paper.signalScore * 0.25);
}

function rankKeywordPapers(collected: CollectedPaper[], query: string, limit = DEFAULT_ANALYSIS_LIMIT) {
  return collected
    .map((paper) => ({ ...paper, relevanceScore: scoreKeywordRelevance(paper, query) }))
    .filter((paper) => paper.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore || right.signalScore - left.signalScore)
    .slice(0, limit);
}

function rankReferencePapers(collected: CollectedPaper[], detection: PaperQueryDetection, limit = DEFAULT_ANALYSIS_LIMIT) {
  const ranked = collected
    .map((paper) => {
      let relevanceScore = 0;

      if (detection.kind === "doi") {
        relevanceScore = normalizeDoi(paper.doi) === detection.normalizedQuery ? 240 : 0;
      } else if (detection.kind === "pmid") {
        relevanceScore = normalizePmid(paper.pmid) === detection.normalizedQuery ? 240 : 0;
      } else {
        relevanceScore = scoreTitleReferenceMatch(paper, detection.normalizedQuery);
      }

      return { ...paper, relevanceScore };
    })
    .filter((paper) => paper.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore || right.signalScore - left.signalScore);

  return ranked.slice(0, limit);
}

function withZeroRelevance(paper: CollectedPaper): RankedPaper {
  return {
    ...paper,
    relevanceScore: 0,
  };
}

function getDefaultLocalPapers(limit = DEFAULT_ANALYSIS_LIMIT) {
  return [...mockCollectedPapers]
    .sort((left, right) => right.signalScore - left.signalScore)
    .slice(0, limit)
    .map(withZeroRelevance);
}

export function searchLocalPapers(query: string, localPapers: CollectedPaper[] = mockCollectedPapers, limit = DEFAULT_ANALYSIS_LIMIT) {
  return rankKeywordPapers(localPapers, query, limit);
}

function searchMockByKeyword(query: string, limit = DEFAULT_ANALYSIS_LIMIT) {
  return searchLocalPapers(query, mockCollectedPapers, limit);
}

function searchMockByReference(detection: PaperQueryDetection, limit = DEFAULT_ANALYSIS_LIMIT) {
  return rankReferencePapers(mockCollectedPapers, detection, limit);
}

function isExactReferenceMatch(paper: CollectedPaper, detection: PaperQueryDetection) {
  if (detection.kind === "doi") {
    return normalizeDoi(paper.doi) === detection.normalizedQuery;
  }

  if (detection.kind === "pmid") {
    return normalizePmid(paper.pmid) === detection.normalizedQuery;
  }

  return normalizeTitle(paper.title) === normalizeTitle(detection.normalizedQuery);
}

function buildRelatedKeywordFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  return uniqueStrings([
    extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : "",
    extraction.editingType !== NOT_REPORTED ? extraction.editingType : "",
    extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : "",
    paper.title.split(" ").slice(0, 8).join(" "),
  ])
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
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

function localizeReportedValue(value?: string) {
  if (!value || value === NOT_REPORTED) {
    return ANALYZE_NOT_REPORTED;
  }

  return toZhExtractionValue(value);
}

function toAnalyzePaper(paper: CollectedPaper): AnalyzePaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract || ANALYZE_NOT_REPORTED,
    journal: paper.journal || ANALYZE_NOT_REPORTED,
    authors: paper.authors.length > 0 ? paper.authors : [ANALYZE_NOT_REPORTED],
    doi: paper.doi ?? ANALYZE_NOT_REPORTED,
    pmid: paper.pmid ?? ANALYZE_NOT_REPORTED,
    publishedAt: paper.publishedAt ?? ANALYZE_NOT_REPORTED,
    url: paper.url,
    source: uniqueStrings(paper.sources.map(toZhSourceName)).join(" / "),
    signalScore: paper.signalScore,
    reliabilityLabel: "元数据",
  };
}

function toStructuredFeature(paper: CollectedPaper, extraction: GeneEditingExtraction): GeneEditingFeature {
  return {
    paperId: paper.id,
    paperTitle: paper.title,
    editingTool: localizeReportedValue(extraction.editingTool),
    editorVariant: localizeReportedValue(extraction.editorVariant),
    editingType: localizeReportedValue(extraction.editingType),
    organism: localizeReportedValue(extraction.organism),
    deliveryMethod: localizeReportedValue(extraction.deliveryMethod),
    targetGene: localizeReportedValue(extraction.targetGene),
    targetTrait: localizeReportedValue(extraction.targetTrait),
    editingEfficiency: localizeReportedValue(extraction.editingEfficiency),
    offTargetAnalysis: localizeReportedValue(extraction.offTargetAnalysis),
    phenotypeValidation: localizeReportedValue(extraction.phenotypeValidation),
    mainInnovation: localizeReportedValue(extraction.mainInnovation),
    limitations: localizeReportedValue(extraction.limitations),
    paperType: localizeReportedValue(extraction.paperType),
    followUpOpportunities: localizeReportedValue(extraction.followUpOpportunities),
    reliabilityLabel: "规则解析",
  };
}

export function detectQueryType(query: string): PaperQueryDetection {
  const trimmed = query.trim();
  const normalizedDoi = normalizeDoi(trimmed);
  const normalizedPmid = normalizePmid(trimmed);

  if (normalizedDoi && /\b10\.\d{4,9}\//i.test(trimmed)) {
    return { kind: "doi", normalizedQuery: normalizedDoi };
  }

  if (normalizedPmid && (/^\s*(pmid\s*:)?\s*\d+\s*$/i.test(trimmed) || trimmed.length <= 12)) {
    return { kind: "pmid", normalizedQuery: normalizedPmid };
  }

  return { kind: "title", normalizedQuery: normalizeWhitespace(trimmed) };
}

export const detectPaperReferenceQuery = detectQueryType;

export function normalizeAnalyzeRequest(input: AnalyzeRequestInput): AnalyzeRequestInput {
  const query = normalizeWhitespace(input.query);

  if (!query) {
    throw new Error("查询内容不能为空。");
  }

  return {
    mode: input.mode,
    query,
  };
}

function inferDiseaseAreaFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  const text = normalizeTitle(
    [paper.title, paper.abstract, extraction.targetTrait, extraction.targetGene, ...paper.keywords].join(" "),
  );

  if (/\b(pcsk9|ldl|cardio|metabolic)\b/.test(text)) {
    return "Cardiometabolic";
  }

  if (/\b(tumor|tumour|oncology|cancer|synthetic lethal)\b/.test(text)) {
    return "Oncology";
  }

  if (/\b(rpe65|retina|retinal|blindness|ocular|ophthalm)\b/.test(text)) {
    return "Ophthalmology";
  }

  if (/\b(thalassemia|hemoglobin|rare disease|monogenic)\b/.test(text)) {
    return "Rare disease";
  }

  if (/\b(rice|wheat|maize|arabidopsis|plant)\b/.test(text)) {
    return "Plant biotechnology";
  }

  return extraction.targetTrait !== NOT_REPORTED ? extraction.targetTrait : "Gene editing";
}

function inferTopicSlugsFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction, query: string) {
  const text = normalizeTitle([paper.title, paper.abstract, extraction.editingType, extraction.deliveryMethod, query].join(" "));
  const result: string[] = [];

  if (/\b(base|adenine|cytosine|prime)\b/.test(text)) {
    result.push("base-editing");
  }

  if (/\b(lnp|aav|delivery|subretinal|electroporation)\b/.test(text)) {
    result.push("delivery");
  }

  if (/\b(t cell|cell therapy|allogeneic|trac)\b/.test(text)) {
    result.push("cell-therapy");
  }

  if (/\b(rare disease|thalassemia|blindness|retina|rpe65)\b/.test(text)) {
    result.push("rare-disease");
  }

  if (/\b(screen|screening|synthetic lethal|perturbation)\b/.test(text)) {
    result.push("screening");
  }

  return result.length > 0 ? uniqueStrings(result) : ["delivery"];
}

function inferModalityFromExtraction(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  const editingType = extraction.editingType !== NOT_REPORTED ? extraction.editingType : (paper.editorTypes[0] ?? "Gene editing");
  const delivery = extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : undefined;

  return delivery ? `${editingType} + ${delivery}` : editingType;
}

function inferStageFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction): IdeaSeedPaper["stage"] {
  const paperType = extraction.paperType.toLowerCase();
  const text = normalizeTitle([paper.title, paper.abstract, extraction.paperType].join(" "));

  if (paperType.includes("clinical") || /\b(patient|patients|clinical)\b/.test(text)) {
    return "Clinical";
  }

  if (paperType.includes("platform") || /\b(screen|screening|atlas|perturbation)\b/.test(text)) {
    return "Platform";
  }

  return "Preclinical";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSyntheticRadarPaper(seedPaper: IdeaSeedPaper): RadarPaper {
  return {
    id: seedPaper.id,
    slug: seedPaper.slug,
    title: seedPaper.title,
    abstract: seedPaper.abstract,
    publishedAt: seedPaper.publishedAt ?? "",
    doi: seedPaper.doi ?? "",
    pmid: undefined,
    modality: seedPaper.modality,
    diseaseArea: seedPaper.diseaseArea,
    stage: seedPaper.stage,
    status: "Watchlist",
    noveltyScore: seedPaper.compositeScore ?? 75,
    momentumScore: seedPaper.compositeScore ?? 75,
    translationalScore: seedPaper.compositeScore ?? 75,
    evidenceScore: seedPaper.compositeScore ?? 75,
    compositeScore: seedPaper.compositeScore ?? 75,
    citationCount: 0,
    clinicalSignal: "",
    keyTakeaway: "",
    marketSignal: "",
    journalSlug: seedPaper.journalSlug,
    authorIds: [],
    geneSymbols: seedPaper.geneSymbols,
    topicSlugs: seedPaper.topicSlugs,
    organisms: seedPaper.organisms,
    editorTypes: seedPaper.editorTypes,
  };
}

function buildIdeaSeedPaper(paper: CollectedPaper, extraction: GeneEditingExtraction, query: string): IdeaSeedPaper {
  return {
    id: paper.appPaperId ?? paper.id,
    slug: slugify(paper.title).slice(0, 64),
    title: paper.title,
    abstract: paper.abstract,
    publishedAt: paper.publishedAt,
    doi: paper.doi,
    modality: inferModalityFromExtraction(paper, extraction),
    diseaseArea: inferDiseaseAreaFromPaper(paper, extraction),
    stage: inferStageFromPaper(paper, extraction),
    compositeScore: paper.appPaperId
      ? papers.find((item) => item.id === paper.appPaperId)?.compositeScore ?? paper.signalScore
      : paper.signalScore,
    journalSlug: journals.find((journal) => canonicalizeJournal(journal.name) === canonicalizeJournal(paper.journal))?.slug ?? paper.journal,
    geneSymbols:
      extraction.targetGene !== NOT_REPORTED
        ? uniqueStrings(
            extraction.targetGene
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        : uniqueStrings(paper.keywords.filter((item) => /\b[A-Z0-9-]{3,8}\b/.test(item))).slice(0, 3),
    topicSlugs: inferTopicSlugsFromPaper(paper, extraction, query),
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
  };
}

function topCounts(values: string[], limit = 3) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || normalized === ANALYZE_NOT_REPORTED) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => `${label}（${count} 篇）`);
}

function splitFeatureValues(value: string) {
  return value
    .split(/[;,，；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNonReported(values: string[]) {
  return uniqueStrings(values.filter((value) => value && value !== ANALYZE_NOT_REPORTED && value !== NOT_REPORTED));
}

function buildSeedClassificationText(
  paper: Pick<IdeaSeedPaper, "title" | "abstract" | "organisms" | "editorTypes" | "geneSymbols" | "modality" | "diseaseArea">,
  extraction: Pick<
    GeneEditingExtraction,
    | "editingTool"
    | "editorVariant"
    | "editingType"
    | "organism"
    | "deliveryMethod"
    | "targetGene"
    | "targetTrait"
    | "mainInnovation"
    | "limitations"
    | "paperType"
    | "offTargetAnalysis"
    | "phenotypeValidation"
  >,
) {
  return normalizeTitle(
    [
      paper.title,
      paper.abstract,
      paper.modality,
      paper.diseaseArea,
      ...paper.organisms,
      ...paper.editorTypes,
      ...paper.geneSymbols,
      extraction.editingTool,
      extraction.editorVariant,
      extraction.editingType,
      extraction.organism,
      extraction.deliveryMethod,
      extraction.targetGene,
      extraction.targetTrait,
      extraction.mainInnovation,
      extraction.limitations,
      extraction.paperType,
      extraction.offTargetAnalysis,
      extraction.phenotypeValidation,
    ].join(" "),
  );
}

function classifyPriority(value: number): "高" | "中" | "低" {
  if (value >= 75) {
    return "高";
  }

  if (value >= 55) {
    return "中";
  }

  return "低";
}

function priorityWeight(priority: "高" | "中" | "低") {
  switch (priority) {
    case "高":
      return 3;
    case "中":
      return 2;
    case "低":
      return 1;
  }
}

function determineTransferPathPriority(path: TechnologyTransferPath, text: string): "高" | "中" | "低" {
  const hasLimitedPriorReports = /\b(not yet reported in plants|limited prior reports|few reports|first in plants)\b/.test(text);

  switch (path) {
    case "mammalian_cell_to_plant":
    case "animal_to_plant":
      return hasLimitedPriorReports ? "高" : "高";
    case "monocot_to_dicot":
    case "crop_to_crop":
      return "高";
    case "model_plant_to_crop":
    case "tool_to_trait":
    case "efficiency_optimization":
    case "delivery_optimization":
    case "specificity_optimization":
      return "中";
    case "single_target_to_multiplex":
      return "中";
  }
}

function buildTransferPathSummary(
  path: TechnologyTransferPath,
  rationale: string,
  priority?: "高" | "中" | "低",
): TechnologyTransferPathSummary {
  return {
    path,
    label: transferPathLabelMap[path],
    rationale,
    priority: priority ?? determineTransferPathPriority(path, rationale),
    reliabilityLabel: "规则解析",
  };
}

function isPlantKeyword(text: string) {
  return /\b(rice|oryza|wheat|maize|corn|soybean|soy|tomato|arabidopsis|plant|crop|dicot|monocot|callus|agrobacterium)\b/.test(text);
}

function isMonocotKeyword(text: string) {
  return /\b(rice|oryza|wheat|maize|corn|barley|sorghum)\b/.test(text);
}

function isDicotCropKeyword(text: string) {
  return /\b(tomato|soybean|soy|cotton|potato|canola|rapeseed)\b/.test(text);
}

function isModelPlantKeyword(text: string) {
  return /\b(arabidopsis|nicotiana|model plant)\b/.test(text);
}

function isAnimalOrCellKeyword(text: string) {
  return /\b(human|primate|mouse|mice|murine|rat|dog|canine|zebrafish|animal|mammalian|hek|hela|293t|stem cell|stem cells|cell line|cell lines|organoid|organoids|human cells|mammalian cells)\b/.test(text);
}

function isMammalianCellKeyword(text: string) {
  return /\b(mammalian cell|mammalian cells|human cell|human cells|cell line|cell lines|hek|hela|293t|stem cell|stem cells|organoid|organoids)\b/.test(text);
}

function isPeOrBeKeyword(text: string) {
  return /\b(prime editing|prime editor|base editing|base editor|abe|cbe|pe)\b/.test(text);
}

function isMultiplexOrPathwayKeyword(text: string) {
  return /\b(multiplex|multigene|multi-gene|multi gene|pathway|quintuple|simultaneous(?:ly)?|five key genes)\b/.test(text);
}

function inferPaperArchetype(
  paper: Pick<IdeaSeedPaper, "title" | "abstract" | "diseaseArea">,
  extraction: Pick<
    GeneEditingExtraction,
    "mainInnovation" | "targetTrait" | "phenotypeValidation" | "paperType" | "deliveryMethod" | "offTargetAnalysis"
  >,
) {
  const text = buildSeedClassificationText(
    {
      ...paper,
      organisms: [],
      editorTypes: [],
      geneSymbols: [],
      modality: "",
    },
    {
      editingTool: NOT_REPORTED,
      editorVariant: NOT_REPORTED,
      editingType: NOT_REPORTED,
      organism: NOT_REPORTED,
      deliveryMethod: extraction.deliveryMethod,
      targetGene: NOT_REPORTED,
      targetTrait: extraction.targetTrait,
      mainInnovation: extraction.mainInnovation,
      limitations: NOT_REPORTED,
      paperType: extraction.paperType,
      offTargetAnalysis: extraction.offTargetAnalysis,
      phenotypeValidation: extraction.phenotypeValidation,
    },
  );

  const isToolOptimization = /\b(optimized|optimization|variant|architecture|scaffold|promoter|nls|pegRNA|sgRNA|compare|comparison|engineering|compact|payload|improve efficiency|enhancing efficiency|tool platform|toolkit)\b/.test(
    text,
  );
  const isTraitApplication =
    extraction.targetTrait !== NOT_REPORTED ||
    extraction.phenotypeValidation !== NOT_REPORTED ||
    /\b(trait|yield|quality|nutrition|nutritional|biofortification|phytonutrient|vitamin|fruit|resistance|phenotype|agronomic|disease|rescue|blindness|anemia)\b/.test(
      text,
    );
  const isDeliveryFocused = extraction.deliveryMethod !== NOT_REPORTED || /\b(delivery|lnp|aav|electroporation|agrobacterium)\b/.test(text);
  const isSpecificityFocused =
    extraction.offTargetAnalysis !== NOT_REPORTED || /\b(off target|specificity|bystander|precision)\b/.test(text);
  const isMultiplexOrPathway = isMultiplexOrPathwayKeyword(text);

  return {
    isToolOptimization,
    isTraitApplication,
    isDeliveryFocused,
    isSpecificityFocused,
    isMultiplexOrPathway,
  };
}

export function classifyTechnologyTransferPath(
  paper: Pick<
    IdeaSeedPaper,
    "title" | "abstract" | "organisms" | "editorTypes" | "geneSymbols" | "modality" | "diseaseArea" | "stage"
  >,
  extraction: Pick<
    GeneEditingExtraction,
    | "editingTool"
    | "editorVariant"
    | "editingType"
    | "organism"
    | "deliveryMethod"
    | "targetGene"
    | "targetTrait"
    | "mainInnovation"
    | "limitations"
    | "paperType"
    | "offTargetAnalysis"
    | "phenotypeValidation"
  >,
): TechnologyTransferPathSummary[] {
  const text = buildSeedClassificationText(paper, extraction);
  const isPlant = isPlantKeyword(text);
  const isAnimalOrCell = isAnimalOrCellKeyword(text);
  const isMammalianCell = isMammalianCellKeyword(text);
  const isRice = /\b(rice|oryza sativa)\b/.test(text);
  const isMonocot = isMonocotKeyword(text);
  const isDicotCrop = isDicotCropKeyword(text);
  const isModelPlant = isModelPlantKeyword(text);
  const isPeOrBe = isPeOrBeKeyword(text);
  const { isToolOptimization, isTraitApplication, isDeliveryFocused, isSpecificityFocused, isMultiplexOrPathway } = inferPaperArchetype(
    paper,
    extraction,
  );
  const summaries: TechnologyTransferPathSummary[] = [];

  const add = (path: TechnologyTransferPath, rationale: string, priority?: "高" | "中" | "低") => {
    if (summaries.some((summary) => summary.path === path)) {
      return;
    }

    summaries.push(buildTransferPathSummary(path, rationale, priority));
  };

  if (isAnimalOrCell && isPeOrBe && !isPlant) {
    if (isMammalianCell) {
      add(
        "mammalian_cell_to_plant",
        "该论文的核心价值更像是编辑器架构或工具体系本身，而不是特定动物性状，因此优先考虑将其迁移到植物体系验证可移植性。",
        "高",
      );
    }

    add(
      "animal_to_plant",
      "当前结果显示该工具主要在动物或细胞体系中成立，若尚未在植物中建立，将其转入水稻、Arabidopsis 或番茄会形成更清晰的新场景论文路径。",
      "高",
    );
  }

  if (isRice && isPeOrBe) {
    add(
      "monocot_to_dicot",
      "该论文已证明水稻中的单子叶可行性，下一步最现实的延展是转向番茄或大豆等双子叶体系，检验架构是否具备跨类群适配能力。",
      "高",
    );
    add(
      "crop_to_crop",
      "在水稻中成立的 PE/BE 体系继续扩展到小麦、玉米等作物，通常更容易形成有比较深度的新物种应用论文。",
      "高",
    );
  }

  if (isDicotCrop && isPeOrBe) {
    add(
      "crop_to_crop",
      "该论文已在双子叶作物中完成验证，继续扩展到其他双子叶作物或转入单子叶作物，是最自然的发表延展路径。",
      "高",
    );
  }

  if (isPlant && isTraitApplication) {
    add(
      "crop_to_crop",
      "当前论文已经把编辑工具与明确性状读出连接起来，最现实的后续方向是把同类品质、抗性或营养强化策略迁移到相关经济作物中。",
      "高",
    );
  }

  if (isModelPlant && isPlant) {
    add(
      "model_plant_to_crop",
      "如果当前工作更偏模式植物验证，将同一工具路线推进到经济作物通常比继续做模型内重复更有发表价值。",
      "高",
    );
  }

  if (isToolOptimization) {
    add(
      "efficiency_optimization",
      "该论文的发表基础在于工具架构或参数优化，因此继续做效率与版本比较，是最稳妥的后续发表方向。",
      "中",
    );
    add(
      "single_target_to_multiplex",
      "若当前工作仍主要停留在单靶点验证，进一步扩展到多靶点或通路级编辑，更能提升工具论文的说服力。",
      "中",
    );
  }

  if (isPlant && (isTraitApplication || isMultiplexOrPathway)) {
    add(
      "single_target_to_multiplex",
      isMultiplexOrPathway
        ? "当前论文已经展示了多基因或通路级编辑的潜力，下一步可继续扩展到更系统的通路重构、更多目标位点或不同作物背景。"
        : "若当前工作尚未覆盖通路级设计，则把单性状编辑推进到多位点协同调控，通常更容易形成新的发表层级。",
      "高",
    );
  }

  if (isDeliveryFocused) {
    add(
      "delivery_optimization",
      "当前技术路线对递送条件较敏感，继续围绕启动子、载体或稳定转化环节做优化，通常有明确的方法学延展空间。",
      "中",
    );
  }

  if (isSpecificityFocused || extraction.offTargetAnalysis === ANALYZE_NOT_REPORTED) {
    add(
      "specificity_optimization",
      extraction.offTargetAnalysis === ANALYZE_NOT_REPORTED
        ? "当前论文尚未充分展开脱靶或特异性验证，因此补做特异性优化与比较，是合理且必要的延展路径。"
        : "在已有脱靶或特异性讨论基础上继续优化安全性，往往能形成更完整的方法学或平台升级文章。",
      "中",
    );
  }

  if (isTraitApplication) {
    add(
      "tool_to_trait",
      isPlant
        ? "当前论文已经证明工具能够支撑明确的植物性状终点，下一步更具发表性的方向是把同一逻辑迁移到相邻品质、抗性或营养性状。"
        : "如果当前论文已经展示了明确性状或疾病终点，最现实的下一步不是重复同一目标，而是把工具迁移到相邻性状或相关作物场景。",
      isPlant ? "中" : "中",
    );
  }

  return summaries
    .sort((left, right) => {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return transferPathOrder.indexOf(left.path) - transferPathOrder.indexOf(right.path);
    })
    .slice(0, DEFAULT_PAPER_IDEA_LIMIT);
}

function splitInsightList(value: string) {
  return uniqueNonReported(
    value
      .split(/[.;；。\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function buildPaperStrategySummary(
  seedPaper: AnalyzePaper,
  feature: GeneEditingFeature,
  transferPaths: TechnologyTransferPathSummary[],
): PaperStrategySummary {
  const editingTool = feature.editingTool !== ANALYZE_NOT_REPORTED ? feature.editingTool : feature.editingType;
  const organism = feature.organism !== ANALYZE_NOT_REPORTED ? feature.organism : ANALYZE_NOT_REPORTED;
  const targetGene = feature.targetGene !== ANALYZE_NOT_REPORTED ? feature.targetGene : ANALYZE_NOT_REPORTED;
  const targetTrait = feature.targetTrait !== ANALYZE_NOT_REPORTED ? feature.targetTrait : ANALYZE_NOT_REPORTED;
  const paperFocusText = normalizeTitle([seedPaper.title, seedPaper.abstract, feature.mainInnovation, feature.paperType, feature.limitations].join(" "));
  const hasMultiplexSignal = /\b(multiplex|multigene|multi-gene|five key genes|quintuple|pathway)\b/.test(paperFocusText);
  const hasTraitQuantification = /\b(vitamin|phytonutrient|lycopene|gaba|quality|yield|resistance|metabolite|trait)\b/.test(paperFocusText);
  const hasTradeoffCheck = /\b(no significant trade-offs|fruit quality|growth|agronomic)\b/.test(paperFocusText);
  const hasInVivoValidation = /\b(in vivo|xenograft|mouse|mice|primate|canine|rodent)\b/.test(paperFocusText);
  const hasHeritabilitySignal = /\b(heritab|stable transformation|offspring|t1|t2)\b/.test(paperFocusText);
  const isPlantPaper = /\b(tomato|rice|soybean|maize|wheat|arabidopsis|crop|plant)\b/.test(paperFocusText);
  const primaryOrganism =
    isPlantPaper
      ? splitFeatureValues(organism).find((item) => /番茄|水稻|大豆|小麦|玉米|拟南芥|plant|tomato|rice|soybean|wheat|maize|arabidopsis/i.test(item)) ?? organism
      : organism;
  const isToolPaper =
    /\b(optimized|optimization|variant|architecture|platform|tool|editor|pegRNA|sgRNA|compare|comparison|enhancing efficiency)\b/.test(
      paperFocusText,
    ) || feature.mainInnovation !== ANALYZE_NOT_REPORTED;
  const isTraitPaper =
    targetTrait !== ANALYZE_NOT_REPORTED ||
    feature.phenotypeValidation !== ANALYZE_NOT_REPORTED ||
    /\b(trait|yield|quality|nutrition|biofortification|phytonutrient|rescue|resistance|phenotype|agronomic)\b/.test(paperFocusText);

  const overallStrategy =
    isTraitPaper && hasMultiplexSignal
      ? `该研究围绕${targetTrait !== ANALYZE_NOT_REPORTED ? targetTrait : "目标性状"}这一应用问题，采用${editingTool}在${primaryOrganism}中同步编辑多个关键位点，以通路级重构的方式完成性状强化，并进一步用功能或表型结果证明其应用价值。`
      : isToolPaper
        ? `该研究围绕编辑工具本身的可用性与扩展性，先在${primaryOrganism}中建立或优化${editingTool}路线，再围绕${targetGene !== ANALYZE_NOT_REPORTED ? targetGene : "目标位点"}验证该工具是否具备更好的性能与迁移潜力。`
        : `该研究围绕${targetTrait !== ANALYZE_NOT_REPORTED ? targetTrait : "目标问题"}，采用${editingTool}在${primaryOrganism}中完成编辑验证，并通过功能或表型读出支撑研究结论。`;

  const whyPublishable =
    isTraitPaper
      ? `它之所以具有发表性，关键在于把编辑工具、${primaryOrganism}体系与${targetTrait !== ANALYZE_NOT_REPORTED ? targetTrait : "应用终点"}直接连接起来，并用${hasTraitQuantification ? "代谢物或目标性状定量" : "功能读出"}、${hasTradeoffCheck ? "trade-off 评估" : "表型观察"}${hasInVivoValidation ? "以及进一步的体内验证" : ""}组成较完整的数据闭环。`
      : `它之所以能够发表，核心不只是“能不能编辑”，而是提出了可比较、可迁移的技术路线，并在${primaryOrganism}中提供了${feature.offTargetAnalysis !== ANALYZE_NOT_REPORTED ? "性能与特异性" : "性能"}层面的关键验证，因此具备继续外推到其他体系的价值。`;

  const coreInnovation =
    hasMultiplexSignal && isTraitPaper
      ? `该研究的核心创新在于利用${editingTool}在${primaryOrganism}中同步编辑多个关键位点，把多条营养或功能相关通路整合到同一作物背景中，形成比单性状改良更完整的多目标应用框架。`
      : feature.mainInnovation !== ANALYZE_NOT_REPORTED
      ? feature.mainInnovation
      : transferPaths[0]
        ? `该研究最值得延展的创新点在于其“${transferPaths[0].label}”潜力，即该技术路线有机会跨体系迁移或转化为更强的后续应用。`
        : `该研究的创新点主要体现为在${organism}中搭建了${editingTool}相关技术路线。`;

  const evidenceChain = uniqueNonReported([
    hasMultiplexSignal ? "多基因 / 多位点编辑策略设计" : "编辑策略与构建设计",
    feature.editingEfficiency !== ANALYZE_NOT_REPORTED ? "多靶点效率与编辑结果验证" : "编辑结果与分子层面验证",
    hasTraitQuantification ? "目标性状或代谢物定量检测" : "",
    feature.phenotypeValidation !== ANALYZE_NOT_REPORTED ? "表型或功能验证" : "",
    hasTradeoffCheck ? "生长、果实品质或 trade-off 评估" : "",
    hasHeritabilitySignal ? "稳定遗传或后代一致性验证" : "",
    feature.offTargetAnalysis !== ANALYZE_NOT_REPORTED ? "脱靶或副产物分析" : "",
  ]);

  const limitations = uniqueNonReported([
    ...splitInsightList(feature.limitations),
    ...(feature.editingEfficiency === ANALYZE_NOT_REPORTED ? ["编辑效率的定量结果未报道。"] : []),
    ...(feature.offTargetAnalysis === ANALYZE_NOT_REPORTED ? ["脱靶或特异性评估仍需补充。"] : []),
    ...(feature.phenotypeValidation === ANALYZE_NOT_REPORTED ? ["表型或功能验证仍需进一步强化。"] : []),
    ...(isPlantPaper && !hasHeritabilitySignal ? ["稳定遗传或后代一致性证据仍需进一步补齐。"] : []),
    ...(isToolPaper ? ["若缺少与既有编辑器版本的系统 head-to-head 比较，工具升级幅度仍可能被低估。"] : []),
    ...(transferPaths.length === 0 ? ["当前尚未形成明确的跨体系技术迁移路线。"] : []),
  ]);

  return {
    overallStrategy,
    whyPublishable,
    coreInnovation,
    evidenceChain: evidenceChain.length > 0 ? evidenceChain : [ANALYZE_NOT_REPORTED],
    limitations: limitations.length > 0 ? limitations : [ANALYZE_NOT_REPORTED],
  };
}

function selectJournalTierFromScores(
  novelty: number,
  feasibility: number,
  publicationPotential: number,
  competitionRisk: number,
) {
  const overallStrength = Math.round((novelty + feasibility + publicationPotential + (100 - competitionRisk)) / 4);

  if (overallStrength >= 86 && publicationPotential >= 82) {
    return "top-tier biotech or flagship translational journal";
  }

  if (overallStrength >= 76) {
    return "strong specialty translational journal";
  }

  if (overallStrength >= 66) {
    return "field-leading specialty journal";
  }

  return "focused application or methods journal";
}

function mapTransferPathToIdeaType(path: TechnologyTransferPath) {
  switch (path) {
    case "animal_to_plant":
    case "mammalian_cell_to_plant":
    case "model_plant_to_crop":
    case "crop_to_crop":
    case "monocot_to_dicot":
      return "organism transfer" as const;
    case "tool_to_trait":
    case "single_target_to_multiplex":
      return "trait application" as const;
    case "efficiency_optimization":
      return "editor optimization" as const;
    case "delivery_optimization":
      return "delivery optimization" as const;
    case "specificity_optimization":
      return "off-target reduction" as const;
  }
}

function buildPlantTransferTargetText(seedPaper: IdeaSeedPaper) {
  const text = normalizeTitle([seedPaper.title, seedPaper.abstract, ...seedPaper.organisms].join(" "));

  if (/\b(rice|oryza)\b/.test(text)) {
    return "番茄或大豆";
  }

  if (/\b(tomato|soybean|soy)\b/.test(text)) {
    return "水稻、玉米或相关双子叶作物";
  }

  if (/\b(arabidopsis)\b/.test(text)) {
    return "番茄、大豆或小麦";
  }

  return "水稻、Arabidopsis 或番茄";
}

function buildRelatedCropTransferTarget(seedPaper: IdeaSeedPaper) {
  const text = normalizeTitle([seedPaper.title, seedPaper.abstract, ...seedPaper.organisms].join(" "));

  if (/\b(tomato)\b/.test(text)) {
    return "辣椒、马铃薯或茄子等茄科作物";
  }

  if (/\b(soybean|soy)\b/.test(text)) {
    return "花生、菜豆或其他豆科作物";
  }

  if (/\b(rice|oryza)\b/.test(text)) {
    return "小麦、玉米或高转化效率粮食作物";
  }

  if (/\b(arabidopsis)\b/.test(text)) {
    return "番茄、大豆或其他经济作物";
  }

  return "其他相关经济作物";
}

function buildTransferPathIdeaDraft(
  seedPaper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
  pathSummary: TechnologyTransferPathSummary,
) {
  const tool = extraction.editingTool !== NOT_REPORTED ? toZhExtractionValue(extraction.editingTool) : toZhExtractionValue(extraction.editingType);
  const targetGene = extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : "目标位点";
  const targetTrait =
    extraction.targetTrait !== NOT_REPORTED ? toZhExtractionValue(extraction.targetTrait) : "目标性状";
  const transferTarget = buildPlantTransferTargetText(seedPaper);
  const relatedCropTarget = buildRelatedCropTransferTarget(seedPaper);

  switch (pathSummary.path) {
    case "mammalian_cell_to_plant":
    case "animal_to_plant":
      return {
        title: `将${tool}适配到${transferTarget}体系并验证植物可移植性`,
        innovationLogic: `该论文的核心价值更偏向工具路线本身，而不是既有动物/细胞应用终点。因此最现实的高优先级延展，是把同一编辑架构迁移到${transferTarget}，通过植物密码子优化、启动子选择、NLS 调整及 pegRNA/sgRNA scaffold 适配验证跨体系可用性。`,
        feasibilityRationale: `${transferTarget}具备相对成熟的转化或遗传操作基础；若当前工具尚未在植物中系统报道，则新颖性与发表潜力都较强。`,
        minimumExperimentPackage: [
          `完成${tool}在${transferTarget}中的密码子优化与植物启动子/NLS 重构。`,
          `至少在 2 个植物靶点比较新体系与现有植物 PE/BE 系统的编辑效率与纯度。`,
          "补充稳定转化、后代遗传一致性以及初步脱靶/特异性评估。",
        ],
        riskWarnings: ["植物转化效率和表达稳定性可能成为首要瓶颈。", "若缺少与现有植物编辑器的直接比较，发表说服力会明显下降。"],
      };
    case "monocot_to_dicot":
      return {
        title: `将该${tool}从水稻扩展到番茄或大豆并比较跨类群表现`,
        innovationLogic: "水稻论文已经提供了单子叶体系中的可行性证据，下一步更具发表价值的是在双子叶作物中验证同一编辑架构是否仍成立，并比较不同作物背景下的效率、纯度与 heritability。",
        feasibilityRationale: "番茄和大豆是最常见的双子叶转化体系，便于形成与水稻结果的清晰对照，因此在作物延展论文中可行性较高。",
        minimumExperimentPackage: [
          "在番茄或大豆中重建原始编辑架构，并保留与水稻论文一致的关键设计参数。",
          `选择至少一个明确性状或农艺相关靶点，比较原策略与改造策略对${targetGene}或相近位点的编辑表现。`,
          "补充稳定转化后代表型或遗传一致性验证。",
        ],
        riskWarnings: ["若只做单个位点技术验证，容易被视为简单移植。", "缺少作物性状读出时，发表层级会受限。"],
      };
    case "crop_to_crop":
      return {
        title: `将该${tool}拓展到${relatedCropTarget}并围绕${targetTrait}做对照应用`,
        innovationLogic: `该论文的技术路线已在当前作物中成立，最可发表的延展通常是推进到${relatedCropTarget}等相关作物，并把工具迁移与性状验证结合起来，而不是停留在重复性的单点复现。`,
        feasibilityRationale: `相关作物之间的代谢通路、农艺评价框架和转化流程更连续；若能把${targetTrait}迁移到${relatedCropTarget}，通常更容易形成完整的 comparative application 论文。`,
        minimumExperimentPackage: [
          `选择${relatedCropTarget}中的至少一种目标作物重建同一编辑架构。`,
          `围绕${targetTrait}完成至少 2 个位点验证，其中 1 个需要连接明确性状或代谢终点。`,
          "与原论文中的作物策略进行效率、纯度、代谢物累积或遗传稳定性比较。",
        ],
        riskWarnings: ["若缺少性状或农艺层面读出，容易被归为低创新增量研究。"],
      };
    case "model_plant_to_crop":
      return {
        title: `把${tool}从模式植物推进到经济作物体系`,
        innovationLogic: "如果当前工作更偏模式植物验证，真正能提升发表性的下一步通常不是继续在模式系统内做参数重复，而是验证其在经济作物中是否仍具备可用性与遗传稳定性。",
        feasibilityRationale: "模式植物中的构建和表达逻辑通常可以迁移，但经济作物会提供更强的应用价值与审稿说服力。",
        minimumExperimentPackage: [
          "保持核心编辑架构不变，将构建迁移到至少一种经济作物中。",
          "比较模式植物与经济作物中的编辑表现及表达稳定性。",
          "加入后代遗传一致性或性状读出，避免仅停留在瞬时表达层面。",
        ],
        riskWarnings: ["经济作物再生周期较长，实验周期会显著拉长。"],
      };
    case "tool_to_trait":
      return {
        title: `将该${tool}从工具验证推进到${targetTrait}导向的性状应用`,
        innovationLogic: "当前论文若以工具或路线验证为主，下一篇更容易发表的工作是把同一体系带入更明确的性状或疾病终点，让技术路线与应用结果形成闭环。",
        feasibilityRationale: "已有工具基础可以直接复用，只要找到合理靶点与表型读出，就能在不重做整套平台的前提下形成新文章。",
        minimumExperimentPackage: [
          "围绕一个明确性状或疾病终点选定正交靶点。",
          "同时给出编辑结果与表型/功能读出，而不是只报告分子层面的成功编辑。",
          "与原工具验证场景比较其适用性边界和性能差异。",
        ],
        riskWarnings: ["若表型终点不够清晰，论文会重新退回到“仅技术验证”的评价。"],
      };
    case "single_target_to_multiplex":
      if (isMultiplexOrPathwayKeyword(normalizeTitle([seedPaper.title, seedPaper.abstract, extraction.mainInnovation].join(" ")))) {
        return {
          title: `将${tool}的多基因编辑进一步扩展到通路级与多作物验证`,
          innovationLogic: "当前论文已经展示了多基因协同编辑的可行性，下一步更具发表价值的方向是继续扩展代谢通路级设计、跨作物复现与更完整的功能比较，而不是停留在单一作物的一次性成功。",
          feasibilityRationale: "已有多基因构建和表型评价框架可直接复用，只要增加通路层面的对照和跨作物验证，就能显著提高论文的外推性与完整度。",
          minimumExperimentPackage: [
            "在原有多基因编辑框架基础上增加通路级目标或第二组功能模块。",
            "比较单一作物与第二作物中的代谢物、表型和潜在 trade-off。",
            "补充稳定遗传、产量相关性状或组织特异性读出，避免只停留在代谢物定量层面。",
          ],
          riskWarnings: ["多通路设计会显著增加构建复杂度与背景效应。", "若缺少跨作物或跨品系对照，创新性会被削弱。"],
        };
      }

      return {
        title: `将单靶点${tool}验证扩展到多靶点或通路级编辑`,
        innovationLogic: "当原论文主要展示单靶点效果时，下一步更有发表性的方向通常是将同一架构推进到双靶点、多靶点或通路级编辑，以证明其不是偶然命中单个位点。",
        feasibilityRationale: "多靶点设计会增加构建复杂度，但能显著提升工具或应用论文的完整性和创新度。",
        minimumExperimentPackage: [
          "设计至少 2–3 个相关位点的联合编辑方案。",
          "比较单靶点与多靶点条件下的编辑效率、纯度和潜在相互影响。",
          "若面向性状或疾病应用，补充通路层面的功能读出。",
        ],
        riskWarnings: ["多靶点设计会显著增加构建和验证复杂度。", "若仅增加靶点数量而无功能收益，发表潜力有限。"],
      };
    case "efficiency_optimization":
      return {
        title: `围绕${tool}继续做效率与版本迭代优化`,
        innovationLogic: "如果原论文的可发表性主要来自编辑器架构优化，那么最稳的后续工作通常是继续围绕 promoter、NLS、scaffold、payload 架构或版本比较，做更系统的效率提升与对照验证。",
        feasibilityRationale: "这一方向最接近原论文实验体系，失败成本相对可控，适合快速积累第二篇方法学或工具升级文章。",
        minimumExperimentPackage: [
          "至少构建 2–3 个结构或参数变体并进行 head-to-head 比较。",
          "补充多个位点而非单个位点的效率验证。",
          "增加与旧版本编辑器的直接对照以及必要的特异性检查。",
        ],
        riskWarnings: ["如果提升幅度过小，容易被视为微小改良。", "仅单靶点验证通常不足以支撑较高层级投稿。"],
      };
    case "delivery_optimization":
      return {
        title: `围绕${tool}进行递送与表达框架优化`,
        innovationLogic: "当当前论文对表达或递送环节依赖较强时，围绕启动子、载体、稳定转化、组织特异性或递送构型继续优化，往往能形成独立的方法学延展。",
        feasibilityRationale: "递送优化常常不需要完全重写编辑器本体，但可以显著影响编辑表现和组织适配性，因此是高性价比的后续方向。",
        minimumExperimentPackage: [
          "比较至少 2 种表达或递送配置。",
          "同步测量编辑结果、表达水平和基础表型或功能读出。",
          "加入组织特异性、稳定性或继代一致性评价。",
        ],
        riskWarnings: ["如果只有表达增强而无编辑或表型收益，文章说服力会不足。"],
      };
    case "specificity_optimization":
      return {
        title: `补强${tool}的特异性与脱靶控制证据链`,
        innovationLogic: "如果当前论文在特异性、旁观者编辑或脱靶层面仍不完整，那么下一步最务实的高质量延展是把工具升级与安全性比较结合起来，形成更完整的技术路线文章。",
        feasibilityRationale: "特异性优化与比较通常能与原体系直接衔接，且对审稿人来说是最容易理解的“必要补全”方向。",
        minimumExperimentPackage: [
          "加入至少 1–2 组特异性优化设计，例如 guide scaffold、表达窗口或 editor 版本调整。",
          "同时报告在靶编辑、旁观者编辑与脱靶对照结果。",
          "在第二个独立位点或第二种体系中复现特异性收益。",
        ],
        riskWarnings: ["若缺少对照编辑器版本，特异性改进很难被说服性接受。"],
      };
  }
}

function applyPriorityAdjustments(
  scores: Pick<AnalyzeEvaluation, "novelty" | "feasibility" | "publicationPotential" | "competitionRisk">,
  priority: "高" | "中" | "低",
  title: string,
) {
  const knockoutLike = /\b(knockout|ko)\b/i.test(title);
  let novelty = scores.novelty;
  let feasibility = scores.feasibility;
  let publicationPotential = scores.publicationPotential;
  let competitionRisk = scores.competitionRisk;

  if (priority === "高") {
    novelty += 8;
    feasibility += 4;
    publicationPotential += 8;
    competitionRisk -= 4;
  } else if (priority === "中") {
    novelty += 2;
    publicationPotential += 2;
  } else {
    novelty -= 6;
    publicationPotential -= 8;
    competitionRisk += 6;
  }

  if (knockoutLike) {
    novelty = Math.min(novelty, 55);
    publicationPotential = Math.min(publicationPotential, 60);
  }

  return {
    novelty: Math.max(0, Math.min(100, Math.round(novelty))),
    feasibility: Math.max(0, Math.min(100, Math.round(feasibility))),
    publicationPotential: Math.max(0, Math.min(100, Math.round(publicationPotential))),
    competitionRisk: Math.max(0, Math.min(100, Math.round(competitionRisk))),
  };
}

export function buildPaperModeIdeas(
  seedPaper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
  transferPaths: TechnologyTransferPathSummary[],
): AnalyzeIdea[] {
  const ideas = transferPaths.map((pathSummary, index) => {
    const draft = buildTransferPathIdeaDraft(seedPaper, extraction, pathSummary);
    const evaluation = evaluateGeneEditingIdea({
      title: draft.title,
      summary: draft.innovationLogic,
        suggestedIdeaType: mapTransferPathToIdeaType(pathSummary.path),
        sourcePaperContext: { paper: seedPaper, extraction },
      });
    const localizedEvaluation = getLocalizedEvaluationCopy(evaluation, toSyntheticRadarPaper(seedPaper));
    const adjustedScores = applyPriorityAdjustments(evaluation, pathSummary.priority, draft.title);
    const suggestedJournalTier = toZhJournalTier(
      selectJournalTierFromScores(
        adjustedScores.novelty,
        adjustedScores.feasibility,
        adjustedScores.publicationPotential,
        adjustedScores.competitionRisk,
      ),
    );
    const genericRiskWarnings = [
      ...(pathSummary.priority === "低" ? ["当前方向更接近技术验证，需避免仅重复原论文场景。"] : []),
      ...draft.riskWarnings,
      ...(evaluation.isIncremental ? ["若只完成单靶点验证，容易被评价为低创新增量研究。"] : []),
    ];

    return {
      id: `paper-mode-idea-${index + 1}-${slugify(pathSummary.path)}`,
      name: draft.title,
      innovationType: toZhIdeaType(mapTransferPathToIdeaType(pathSummary.path)),
      transferPath: pathSummary.label,
      priority: pathSummary.priority,
      basedOnPapers: [seedPaper.title],
      innovationLogic: draft.innovationLogic,
      feasibilityRisk: genericRiskWarnings[0] ?? ANALYZE_NOT_REPORTED,
      feasibilityRationale: draft.feasibilityRationale,
      minimumExperimentalPackage: draft.minimumExperimentPackage,
      minimumExperimentPackage: draft.minimumExperimentPackage,
      recommendedJournalTier: suggestedJournalTier,
      suggestedJournalTier,
      articleType: localizedEvaluation.articleType,
      novelty: adjustedScores.novelty,
      noveltyScore: adjustedScores.novelty,
      feasibility: adjustedScores.feasibility,
      feasibilityScore: adjustedScores.feasibility,
      publicationPotential: adjustedScores.publicationPotential,
      publicationPotentialScore: adjustedScores.publicationPotential,
      competitionRisk: adjustedScores.competitionRisk,
      warning: evaluation.warning,
      riskWarnings: uniqueNonReported(genericRiskWarnings),
      reliabilityLabel: "AI生成假设" as const,
    };
  });

  return ideas
    .sort((left, right) => {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.publicationPotentialScore - left.publicationPotentialScore || right.noveltyScore - left.noveltyScore;
    })
    .slice(0, DEFAULT_PAPER_IDEA_LIMIT);
}

export function buildFieldOverview(analyzedPapers: AnalyzePaper[], features: GeneEditingFeature[]) {
  const currentStatus =
    analyzedPapers.length >= 6
      ? "当前方向已有一定文献密度，整体处于持续扩展阶段。"
      : analyzedPapers.length >= 3
        ? "当前方向已有早期聚集信号，但文献规模仍然有限。"
        : "当前仅检索到少量相关文献，结论需要谨慎解释。";

  const tools = topCounts(features.flatMap((feature) => splitFeatureValues(feature.editingTool)));
  const organisms = topCounts(features.flatMap((feature) => splitFeatureValues(feature.organism)));
  const deliveryMethods = topCounts(features.flatMap((feature) => splitFeatureValues(feature.deliveryMethod)));
  const applications = topCounts(features.flatMap((feature) => splitFeatureValues(feature.targetTrait)));

  const gaps: string[] = [];
  const offTargetMissing = features.filter((feature) => feature.offTargetAnalysis === ANALYZE_NOT_REPORTED).length;
  const phenotypeMissing = features.filter((feature) => feature.phenotypeValidation === ANALYZE_NOT_REPORTED).length;

  if (offTargetMissing >= Math.ceil(features.length / 2)) {
    gaps.push("多数研究未系统报告脱靶分析。");
  }

  if (phenotypeMissing >= Math.ceil(features.length / 2)) {
    gaps.push("相当一部分研究尚未给出充分的表型验证。");
  }

  if (!organisms.some((item) => item.includes("Primate") || item.includes("Human") || item.includes("人") || item.includes("灵长类"))) {
    gaps.push("高保真验证物种或更接近临床的模型仍相对不足。");
  }

  if (deliveryMethods.length <= 1) {
    gaps.push("递送策略多样性有限，重复给药与组织选择性仍值得展开。");
  }

  if (tools.length <= 1) {
    gaps.push("编辑工具类型相对集中，跨工具比较不足。");
  }

  const lines = [
    `当前研究状态：${currentStatus}`,
    `主要编辑工具：${tools.join("；") || ANALYZE_NOT_REPORTED}。`,
    `主要研究物种：${organisms.join("；") || ANALYZE_NOT_REPORTED}。`,
    `常见递送方式：${deliveryMethods.join("；") || ANALYZE_NOT_REPORTED}。`,
    `已报道应用方向：${applications.join("；") || ANALYZE_NOT_REPORTED}。`,
    `潜在研究空白：${gaps.join("；") || "当前样本中尚未形成明确的共性空白。"}。`,
  ];

  if (analyzedPapers.length < 3) {
    lines.push(`提示：当前仅检索到 ${analyzedPapers.length} 篇相关文献，领域概览稳定性有限。`);
  }

  return lines.join("\n");
}

export function buildJournalSuggestions(
  evaluation: AnalyzeEvaluation,
  ideas: AnalyzeIdea[],
  analyzedPapers: AnalyzePaper[] = [],
): JournalSuggestion[] {
  const uniqueTiers = uniqueStrings([evaluation.journalTier, ...ideas.map((idea) => idea.recommendedJournalTier)])
    .filter((tier) => tier && tier !== ANALYZE_NOT_REPORTED)
    .slice(0, 3);
  const observedJournals = uniqueStrings(
    analyzedPapers
      .map((paper) => paper.journal)
      .filter((journal) => journal !== ANALYZE_NOT_REPORTED),
  );

  const defaultExamples: Record<string, string[]> = {
    [toZhJournalTier("top-tier biotech or flagship translational journal")]: ["Nature Biotechnology", "Cell"],
    [toZhJournalTier("strong specialty translational journal")]: ["Nature Biotechnology", "Molecular Therapy"],
    [toZhJournalTier("field-leading specialty journal")]: ["Molecular Therapy", "The CRISPR Journal"],
    [toZhJournalTier("focused application or methods journal")]: ["The CRISPR Journal", "Molecular Therapy"],
  };

  const averageScore =
    ideas.length > 0
      ? Math.round(ideas.reduce((sum, idea) => sum + idea.publicationPotential, 0) / ideas.length)
      : evaluation.publicationPotential;

  return uniqueTiers.map((journalTier) => ({
    journalTier,
    rationale:
      journalTier === evaluation.journalTier
        ? `基于当前启发式评分，优先建议以“${journalTier}”作为首选投稿层级，并围绕最低实验数据包补齐关键证据。`
        : averageScore >= 80
          ? `当前方向整体发表潜力较高，若差异化结果稳定，可同步关注“${journalTier}”层级窗口。`
          : `当前方向更适合作为“${journalTier}”层级的稳健投稿选项，建议先强化差异化与验证深度。`,
    exampleJournals: observedJournals.length > 0 ? observedJournals.slice(0, 3) : defaultExamples[journalTier] ?? [],
    reliabilityLabel: "启发式评分",
  }));
}

async function analyzeKeywordQuery(query: string): Promise<AnalyzeQueryResult> {
  const sourceResults = await Promise.all([
    searchPubMedByKeyword(query),
    searchEuropePmc(query),
    searchCrossref(query),
  ]);

  const externalPapers = sourceResults.flatMap((result) => result.papers);
  const localMatches = searchLocalPapers(query, mockCollectedPapers, DEFAULT_ANALYSIS_LIMIT);
  const merged = dedupePapers([...externalPapers, ...localMatches]);
  let selected = rankKeywordPapers(merged, query, DEFAULT_ANALYSIS_LIMIT);
  const warnings: string[] = [];
  let usedFallback = externalPapers.length === 0;

  if (externalPapers.length === 0) {
    warnings.push("外部文献源当前不可用，结果已回退到本地模拟文献。");
  }

  if (selected.length === 0 && localMatches.length > 0) {
    selected = localMatches;
  }

  if (selected.length === 0) {
    selected = getDefaultLocalPapers(DEFAULT_ANALYSIS_LIMIT);
    usedFallback = true;
    warnings.push(`未检索到与“${query}”直接相关的文献，当前返回本地模拟文献作为分析参考。`);
  }

  return {
    papers: selected,
    usedFallback,
    sourceStatuses: sourceResults.map((result) => result.status),
    warnings,
  };
}

async function analyzePaperQuery(query: string): Promise<AnalyzePaperQueryResult> {
  const detection = detectQueryType(query);
  const sourceResults = await Promise.all([
    searchPubMedByReference(detection),
    searchEuropePmcByReference(detection),
    searchCrossrefByReference(detection),
  ]);

  const externalCandidates = sourceResults.flatMap((result) => result.papers);
  const localReferenceMatches = searchMockByReference(detection, DEFAULT_ANALYSIS_LIMIT);
  const localClosestMatches = searchLocalPapers(
    detection.kind === "title" ? detection.normalizedQuery : query,
    mockCollectedPapers,
    DEFAULT_ANALYSIS_LIMIT,
  );
  const rankedReferenceMatches = rankReferencePapers(
    dedupePapers([...externalCandidates, ...localReferenceMatches]),
    detection,
    DEFAULT_ANALYSIS_LIMIT,
  );
  const warnings: string[] = [];
  let usedFallback = externalCandidates.length === 0;

  if (externalCandidates.length === 0) {
    warnings.push("外部文献源当前不可用，结果已回退到本地模拟文献。");
  }

  let candidatePool =
    rankedReferenceMatches.length > 0
      ? rankedReferenceMatches
      : localClosestMatches.length > 0
        ? localClosestMatches
        : getDefaultLocalPapers(DEFAULT_ANALYSIS_LIMIT);

  if (rankedReferenceMatches.length === 0) {
    usedFallback = true;
    warnings.push("未找到与输入完全一致的文献记录，已返回最接近的本地候选文献。");
  }

  const seed = candidatePool[0];

  if (!seed) {
    return {
      detection,
      papers: [] as RankedPaper[],
      usedFallback: true,
      sourceStatuses: sourceResults.map((result) => result.status),
      warnings: [...warnings, "当前没有可用文献可供分析。"],
    };
  }

  if (!isExactReferenceMatch(seed, detection)) {
    usedFallback = true;

    if (!warnings.includes("未找到与输入完全一致的文献记录，已返回最接近的本地候选文献。")) {
      warnings.push("未找到与输入完全一致的文献记录，已返回最接近的本地候选文献。");
    }
  }

  const seedExtraction = await extractGeneEditingDetails(toExtractionSourcePaper(seed));
  const relatedQuery = buildRelatedKeywordFromPaper(seed, seedExtraction);
  const localRelated = searchLocalPapers(relatedQuery, mockCollectedPapers, DEFAULT_ANALYSIS_LIMIT);
  const relatedPool = dedupePapers([
    seed,
    ...externalCandidates,
    ...localRelated,
  ]);
  const relatedRanked = rankKeywordPapers(relatedPool, relatedQuery, DEFAULT_ANALYSIS_LIMIT)
    .sort((left, right) => {
      if (left.id === seed.id) {
        return -1;
      }

      if (right.id === seed.id) {
        return 1;
      }

      return right.relevanceScore - left.relevanceScore;
    })
    .slice(0, DEFAULT_ANALYSIS_LIMIT);

  candidatePool = relatedRanked.length > 0 ? relatedRanked : candidatePool;

  return {
    detection,
    papers: candidatePool,
    seed,
    usedFallback,
    sourceStatuses: sourceResults.map((result) => result.status),
    warnings,
  };
}

export async function analyzeResearchInput(input: AnalyzeRequestInput): Promise<AnalyzeResponse> {
  const normalizedInput = normalizeAnalyzeRequest(input);
  const { mode, query } = normalizedInput;

  const keywordResult = mode === "keyword" ? await analyzeKeywordQuery(query) : undefined;
  const paperResult = mode === "paper" ? await analyzePaperQuery(query) : undefined;
  const queryResult = keywordResult ?? paperResult;

  if (!queryResult) {
    throw new Error("分析流程未返回结果。");
  }

  const rankedPapers = queryResult.papers.slice(0, mode === "keyword" ? 8 : 6);
  const extracted = await Promise.all(
    rankedPapers.map(async (paper) => ({
      paper,
      extraction: await extractGeneEditingDetails(toExtractionSourcePaper(paper)),
    })),
  );

  const analyzedPapers = extracted.map(({ paper }) => toAnalyzePaper(paper));
  const structuredFeatures = extracted.map(({ paper, extraction }) => toStructuredFeature(paper, extraction));
  const fieldOverview = buildFieldOverview(analyzedPapers, structuredFeatures);
  const seedExtracted =
    mode === "paper" && paperResult?.seed
      ? extracted.find((item) => item.paper.id === paperResult.seed?.id) ?? extracted[0]
      : undefined;
  const seedPaper = seedExtracted ? toAnalyzePaper(seedExtracted.paper) : undefined;
  const seedIdeaPaper = seedExtracted ? buildIdeaSeedPaper(seedExtracted.paper, seedExtracted.extraction, query) : undefined;
  const technologyTransferPaths =
    mode === "paper" && seedIdeaPaper && seedExtracted
      ? classifyTechnologyTransferPath(seedIdeaPaper, seedExtracted.extraction)
      : undefined;
  const paperStrategySummary =
    mode === "paper" && seedPaper && seedExtracted
      ? buildPaperStrategySummary(seedPaper, toStructuredFeature(seedExtracted.paper, seedExtracted.extraction), technologyTransferPaths ?? [])
      : undefined;

  const generatedIdeas =
    mode === "paper" && seedIdeaPaper && seedExtracted
      ? []
      : extracted
          .flatMap(({ paper, extraction }) => {
            const ideaSeedPaper = buildIdeaSeedPaper(paper, extraction, query);
            return generateIdeasForSeedPaper(ideaSeedPaper, extraction).map((idea) => ({
              idea,
              seedPaper: ideaSeedPaper,
              extraction,
            }));
          })
          .sort((left, right) => right.idea.score - left.idea.score)
          .slice(0, DEFAULT_PAPER_IDEA_LIMIT);

  const ideas: AnalyzeIdea[] =
    mode === "paper" && seedIdeaPaper && seedExtracted
      ? buildPaperModeIdeas(seedIdeaPaper, seedExtracted.extraction, technologyTransferPaths ?? [])
      : generatedIdeas.map(({ idea, seedPaper: generatedSeedPaper, extraction }) => {
          const localizedSeedPaper = toSyntheticRadarPaper(generatedSeedPaper);
          const localizedIdea = getLocalizedIdeaCopy({ ...idea, paper: localizedSeedPaper });
          const evaluation = evaluateGeneEditingIdea({
            title: idea.title,
            summary: idea.thesis,
            suggestedIdeaType: idea.ideaType,
            sourcePaperContext: { paper: generatedSeedPaper, extraction },
          });
          const localizedEvaluation = getLocalizedEvaluationCopy(evaluation, localizedSeedPaper);
          const riskWarnings = uniqueNonReported([
            localizedIdea.risk,
            ...(evaluation.isIncremental ? ["若仅完成单靶点验证，容易被评价为低创新增量研究。"] : []),
          ]);

          return {
            id: idea.id,
            name: localizedIdea.title,
            innovationType: toZhIdeaType(idea.ideaType),
            transferPath: toZhIdeaType(idea.ideaType),
            priority: classifyPriority(idea.score),
            basedOnPapers: [generatedSeedPaper.title],
            innovationLogic: localizedIdea.thesis,
            feasibilityRisk: localizedIdea.risk,
            feasibilityRationale: localizedIdea.moat,
            minimumExperimentalPackage: localizedEvaluation.minimumExperimentalPackage,
            minimumExperimentPackage: localizedEvaluation.minimumExperimentalPackage,
            recommendedJournalTier: localizedEvaluation.journalTier,
            suggestedJournalTier: localizedEvaluation.journalTier,
            articleType: localizedEvaluation.articleType,
            novelty: evaluation.novelty,
            noveltyScore: evaluation.novelty,
            feasibility: evaluation.feasibility,
            feasibilityScore: evaluation.feasibility,
            publicationPotential: evaluation.publicationPotential,
            publicationPotentialScore: evaluation.publicationPotential,
            competitionRisk: evaluation.competitionRisk,
            warning: localizedEvaluation.warning,
            riskWarnings,
            reliabilityLabel: "AI生成假设",
          };
        });

  const primaryIdea = mode === "paper" ? undefined : generatedIdeas[0];
  const evaluation = primaryIdea
    ? (() => {
        const localizedSeedPaper = toSyntheticRadarPaper(primaryIdea.seedPaper);
        const evaluationResult = evaluateGeneEditingIdea({
          title: primaryIdea.idea.title,
          summary: primaryIdea.idea.thesis,
          suggestedIdeaType: primaryIdea.idea.ideaType,
          sourcePaperContext: { paper: primaryIdea.seedPaper, extraction: primaryIdea.extraction },
        });
        const localizedEvaluation = getLocalizedEvaluationCopy(evaluationResult, localizedSeedPaper);

        return {
          targetIdeaName: getLocalizedIdeaCopy({ ...primaryIdea.idea, paper: localizedSeedPaper }).title,
          novelty: evaluationResult.novelty,
          feasibility: evaluationResult.feasibility,
          publicationPotential: evaluationResult.publicationPotential,
          competitionRisk: evaluationResult.competitionRisk,
          articleType: localizedEvaluation.articleType,
          additionalExperiments: localizedEvaluation.additionalExperiments,
          journalTier: localizedEvaluation.journalTier,
          warning: localizedEvaluation.warning,
          lowNoveltyWarning: evaluationResult.isIncremental ? "低创新增量研究" : undefined,
          rationale: localizedEvaluation.rationale,
          reliabilityLabel: "启发式评分" as const,
        };
      })()
    : {
        targetIdeaName: ANALYZE_NOT_REPORTED,
        novelty: 0,
        feasibility: 0,
        publicationPotential: 0,
        competitionRisk: 0,
        articleType: ANALYZE_NOT_REPORTED,
        additionalExperiments: [ANALYZE_NOT_REPORTED],
        journalTier: toZhJournalTier("focused application or methods journal"),
        lowNoveltyWarning: undefined,
        rationale: ["当前未生成可评估的衍生选题。"],
        reliabilityLabel: "启发式评分" as const,
      };
  const paperModeEvaluation =
    mode === "paper" && ideas[0] && seedIdeaPaper && seedExtracted
      ? (() => {
          const leadIdea = ideas[0];
          const evaluationResult = evaluateGeneEditingIdea({
            title: leadIdea.name,
            summary: leadIdea.innovationLogic,
            suggestedIdeaType: mapTransferPathToIdeaType((technologyTransferPaths?.[0]?.path ?? "tool_to_trait") as TechnologyTransferPath),
            sourcePaperContext: { paper: seedIdeaPaper, extraction: seedExtracted.extraction },
          });

          return {
            targetIdeaName: leadIdea.name,
            novelty: leadIdea.noveltyScore,
            feasibility: leadIdea.feasibilityScore,
            publicationPotential: leadIdea.publicationPotentialScore,
            competitionRisk: leadIdea.competitionRisk,
            articleType: leadIdea.articleType,
            additionalExperiments:
              leadIdea.minimumExperimentPackage.length > 0 ? leadIdea.minimumExperimentPackage : [ANALYZE_NOT_REPORTED],
            journalTier: leadIdea.suggestedJournalTier,
            warning: leadIdea.warning,
            lowNoveltyWarning: leadIdea.priority === "低" ? "低创新增量研究" : undefined,
            rationale: [
              `首选衍生路径：${leadIdea.transferPath}。`,
              leadIdea.feasibilityRationale,
              ...evaluationResult.rationale,
            ],
            reliabilityLabel: "启发式评分" as const,
          };
        })()
      : undefined;

  const finalEvaluation = paperModeEvaluation ?? evaluation;

  const journalSuggestions = buildJournalSuggestions(finalEvaluation, ideas, analyzedPapers);
  const warnings = uniqueStrings([
    ...queryResult.warnings,
    ...(analyzedPapers.length < 3 ? [`当前仅有 ${analyzedPapers.length} 篇文献进入分析，结论稳定性有限。`] : []),
    ...(finalEvaluation.lowNoveltyWarning ? [finalEvaluation.lowNoveltyWarning] : []),
  ]);

  return {
    mode,
    query,
    detectedQueryKind: paperResult?.detection.kind,
    seedPaper,
    paperStrategySummary,
    technologyTransferPaths,
    papers: analyzedPapers,
    fieldOverview,
    structuredFeatures,
    ideas,
    evaluation: finalEvaluation,
    journalSuggestions,
    warnings,
    usedFallback: queryResult.usedFallback,
    sourceStatuses: queryResult.sourceStatuses.map((status) => ({
      source: toZhSourceName(status.source),
      ok: status.ok,
      count: status.count,
      error: status.error,
    })),
  };
}
