import {
  authors,
  journals,
  type RadarPaper,
} from "@/lib/mock-data";
import {
  extractGeneEditingDetails,
  type ExtractionSourcePaper,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";
import {
  createCollectedPaper,
  toExtractionSourcePaper,
  normalizeTitle,
  normalizeWhitespace,
  stripMarkup,
} from "@/lib/shared-utils";
import {
  type CollectedPaper,
  type ExtractedCollectedPaper,
  normalizeDoi,
  normalizePmid,
  buildSourceUrl,
} from "./types";

export function normalizeMockPaper(paper: RadarPaper) {
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

export async function fetchUnpaywallOA(doi: string): Promise<string | null> {
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

export async function fetchPmcFullText(pmid?: string, doi?: string): Promise<string | null> {
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
      const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${result.pmcid}/fullTextXML`;
      const xmlRes = await fetch(fullTextUrl, { signal: AbortSignal.timeout(5000) });
      if (xmlRes.ok) {
        const xml = await xmlRes.text();
        return xml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30000);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function enrichCollectedPaper(paper: CollectedPaper): Promise<ExtractedCollectedPaper> {
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
