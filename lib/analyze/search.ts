import { XMLParser } from "fast-xml-parser";

import { analysisSeedPapers, authors, journals, papers, type RadarPaper } from "@/lib/mock-data";
import {
  normalizeDoi,
  normalizePmid,
  type CollectedPaper,
} from "@/lib/literature";
import {
  createCollectedPaper,
  fetchJson,
  stripMarkup,
  parseAuthorList,
  coerceIsoDate,
  inferOrganisms,
  inferEditorTypes,
  normalizeTitle,
  uniqueStrings,
  parseCrossrefDate,
} from "@/lib/shared-utils";
import { isLlmEnabled } from "@/lib/llm";
import {
  type SourceStatus,
  type SourceResult,
  type RankedPaper,
  type PaperQueryDetection,
  DEFAULT_ANALYSIS_LIMIT,
} from "./helpers";


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

async function fetchPubMedAbstracts(pmids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (pmids.length === 0) {
    return result;
  }

  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
  url.search = new URLSearchParams({
    db: "pubmed",
    id: pmids.slice(0, 8).join(","),
    rettype: "abstract",
    retmode: "xml",
    tool: "GeneEditRadar",
  }).toString();

  try {
    const response = await fetch(url, {
      headers: { accept: "application/xml", "user-agent": "GeneEditRadar/0.1" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6_500),
    });

    if (!response.ok) {
      return result;
    }

    const xml = await response.text();

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const articles = parsed?.PubmedArticleSet?.PubmedArticle;
    const articleList = Array.isArray(articles) ? articles : articles ? [articles] : [];

    for (const article of articleList) {
      const pmid = article?.MedlineCitation?.PMID;
      if (!pmid) {
        continue;
      }

      const abstractTexts = article?.MedlineCitation?.Article?.Abstract?.AbstractText;
      const parts = Array.isArray(abstractTexts) ? abstractTexts : abstractTexts ? [abstractTexts] : [];
      const abstract = stripMarkup(parts.map((part: unknown) => {
        if (typeof part === "object" && part !== null && "#text" in part) {
          return String((part as Record<string, unknown>)["#text"] ?? "");
        }
        return String(part ?? "");
      }).join(" "));

      if (abstract) {
        result.set(String(pmid), abstract);
      }
    }
  } catch {
    // 网络/超时/解析失败：保持空，下游照常回退。
  }

  return result;
}

async function backfillPubMedAbstracts(papers: RankedPaper[]): Promise<RankedPaper[]> {
  if (!isLlmEnabled()) {
    return papers;
  }

  const needsAbstract = papers.filter((paper) => !paper.abstract && paper.pmid);
  if (needsAbstract.length === 0) {
    return papers;
  }

  const abstracts = await fetchPubMedAbstracts(needsAbstract.map((paper) => paper.pmid as string));
  if (abstracts.size === 0) {
    return papers;
  }

  return papers.map((paper) => {
    if (!paper.abstract && paper.pmid && abstracts.has(paper.pmid)) {
      return { ...paper, abstract: abstracts.get(paper.pmid) as string };
    }
    return paper;
  });
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

export {
  normalizeMockPaper,
  normalizeAnalysisSeedPaper,
  mockCollectedPapers,
  searchPubMedByKeyword,
  searchPubMedByReference,
  fetchPubMedAbstracts,
  backfillPubMedAbstracts,
  searchEuropePmc,
  searchEuropePmcByReference,
  searchCrossref,
  searchCrossrefByReference,
};
