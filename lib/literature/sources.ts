import {
  subscriptions,
  topics,
} from "@/lib/mock-data";
import {
  createCollectedPaper,
  fetchJson,
  inferEditorTypes,
  inferOrganisms,
  normalizeTitle,
  parseAuthorList,
  parseCrossrefDate,
  stripMarkup,
  uniqueStrings,
  coerceIsoDate,
} from "@/lib/shared-utils";
import {
  type CollectedPaper,
  type LiteratureSource,
  type SourceResult,
  normalizeDoi,
  normalizePmid,
  normalizeKeyword,
  buildSourceUrl,
  DEFAULT_LIMIT_PER_SOURCE,
} from "./types";

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

export async function searchPubMed(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
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
          organisms: inferOrganisms(title, ""),
          editorTypes: inferEditorTypes(title, ""),
          sourceIds: { pubmed: pmid ?? doi ?? title },
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
        error: error instanceof Error ? error.message : "Unknown pubmed error",
      },
    };
  }
}

export async function searchEuropePmc(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.search = new URLSearchParams({
    query: buildBooleanQuery(),
    format: "json",
    resultType: "core",
    pageSize: String(limit),
    sort: "FIRST_PDATE desc",
  }).toString();

  type EuropePmcItem = {
    doi?: string;
    pmid?: string;
    title?: string;
    authorString?: string;
    journalTitle?: string;
    firstPublicationDate?: string;
    abstractText?: string;
    meshHeadingList?: { meshHeading?: Array<{ descriptorName?: string }> };
    keywordList?: { keyword?: string[] };
  };

  type EuropePmcResponse = {
    resultList?: {
      result?: EuropePmcItem[];
    };
  };

  try {
    const payload = await fetchJson<EuropePmcResponse>(url, "europe-pmc");
    const items = payload.resultList?.result ?? [];

    const normalized = items
      .filter((item) => item.title)
      .map((item) => {
        const title = stripMarkup(item.title ?? "");
        const abstract = stripMarkup(item.abstractText ?? "");
        const doi = normalizeDoi(item.doi);
        const pmid = normalizePmid(item.pmid);
        const journal = stripMarkup(item.journalTitle ?? "");
        const authors = item.authorString ? item.authorString.split(", ").map((a) => a.trim()) : [];
        const keywords = item.keywordList?.keyword ?? [];

        const meshTerms = item.meshHeadingList?.meshHeading?.map((m) => m.descriptorName ?? "").filter(Boolean) ?? [];
        const allKeywords = uniqueStrings([...keywords, ...meshTerms]);

        return createCollectedPaper({
          title,
          abstract,
          doi,
          pmid,
          journal,
          authors,
          publishedAt: item.firstPublicationDate,
          url: buildSourceUrl("europe-pmc", { doi, pmid }, undefined),
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { "europe-pmc": pmid ?? doi ?? title },
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
        error: error instanceof Error ? error.message : "Unknown europe-pmc error",
      },
    };
  }
}

export async function searchCrossref(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    query: buildCrossrefQuery(),
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
        error: error instanceof Error ? error.message : "Unknown crossref error",
      },
    };
  }
}

export async function searchPreprints(source: "biorxiv" | "medrxiv", limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  const baseUrl = source === "biorxiv" ? "https://api.biorxiv.org/details/biorxiv" : "https://api.biorxiv.org/details/medrxiv";
  
  type BioRxivItem = {
    doi?: string;
    title?: string;
    authors?: string;
    author_corresponding?: string;
    author_corresponding_orcid?: string;
    published?: string;
    posted?: string;
    category?: string;
    abstract?: string;
    url?: string;
    journal?: string;
    rank?: string;
  };
  
  type BioRxivResponse = {
    messages?: Array<{ status?: string; total?: number }>;
    collection?: BioRxivItem[];
  };

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("cursor", "*");
    url.searchParams.set("per_page", String(Math.min(limit, 100)));
    
    const payload = await fetchJson<BioRxivResponse>(url, source);
    const items = payload.collection ?? [];
    
    const normalized = items
      .filter((item) => item.title && item.doi)
      .map((item) => {
        const title = stripMarkup(item.title ?? "");
        const abstract = stripMarkup(item.abstract ?? "");
        const doi = normalizeDoi(item.doi);
        const authors = item.authors ? item.authors.split("; ").map(a => a.trim()) : [];
        
        return createCollectedPaper({
          title,
          abstract,
          doi,
          journal: source === "biorxiv" ? "bioRxiv" : "medRxiv",
          authors,
          publishedAt: item.posted || item.published,
          url: item.url || `https://doi.org/${doi}`,
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

export async function searchOpenAlex(limit = DEFAULT_LIMIT_PER_SOURCE): Promise<SourceResult> {
  type OpenAlexAuthor = {
    display_name?: string;
    orcid?: string;
  };
  
  type OpenAlexItem = {
    id?: string;
    doi?: string;
    title?: string;
    display_name?: string;
    authorships?: Array<{ author?: OpenAlexAuthor }>;
    publication_date?: string;
    primary_location?: {
      source?: {
        display_name?: string;
      };
    };
    abstract_inverted_index?: Record<string, number[]>;
    open_access?: {
      is_oa?: boolean;
      oa_url?: string;
    };
  };
  
  type OpenAlexResponse = {
    results?: OpenAlexItem[];
    meta?: {
      count?: number;
    };
  };

  try {
    const searchTerms = buildSearchTerms();
    const query = searchTerms.join(" ");
    
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query);
    url.searchParams.set("per_page", String(Math.min(limit, 100)));
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("filter", "publication_year:2024-2026");
    url.searchParams.set("mailto", "team@geneeditradar.demo");
    
    const payload = await fetchJson<OpenAlexResponse>(url, "openalex");
    const items = payload.results ?? [];
    
    const normalized = items
      .filter((item) => item.title && item.doi)
      .map((item) => {
        const title = stripMarkup(item.title ?? item.display_name ?? "");
        const doi = normalizeDoi(item.doi);
        const authors = item.authorships
          ?.map((a) => a.author?.display_name)
          .filter(Boolean) as string[] ?? [];
        
        let abstract = "";
        if (item.abstract_inverted_index) {
          const words: string[] = [];
          const entries = Object.entries(item.abstract_inverted_index);
          for (const [word, positions] of entries) {
            for (const pos of positions) {
              words[pos] = word;
            }
          }
          abstract = words.join(" ");
        }
        
        const journal = item.primary_location?.source?.display_name ?? "";
        
        return createCollectedPaper({
          title,
          abstract,
          doi,
          journal,
          authors,
          publishedAt: item.publication_date,
          url: item.open_access?.oa_url || `https://doi.org/${doi}`,
          organisms: inferOrganisms(title, abstract),
          editorTypes: inferEditorTypes(title, abstract),
          sourceIds: { openalex: item.id ?? doi ?? title },
          sources: ["openalex"],
          primarySource: "openalex",
        });
      });

    return {
      papers: normalized,
      status: { source: "openalex", ok: true, count: normalized.length },
    };
  } catch (error) {
    return {
      papers: [],
      status: {
        source: "openalex",
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown openalex error",
      },
    };
  }
}
