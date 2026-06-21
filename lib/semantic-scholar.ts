import "server-only";

import { normalizeDoi } from "@/lib/literature";

export type SemanticScholarCitation = {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number | null;
  isInfluential: boolean;
  authors: Array<{ name: string }>;
};

/**
 * 从 Semantic Scholar 获取引用了指定 DOI 的文献列表。
 * 优先筛选“具有影响力”的引用，为技术演进分析提供上下文。
 */
export async function fetchInfluentialCitations(doi?: string | null): Promise<SemanticScholarCitation[]> {
  const cleanDoi = normalizeDoi(doi);
  if (!cleanDoi) return [];

  // Semantic Scholar API 限制：免费版每秒 1 次请求
  const url = new URL(`https://api.semanticscholar.org/graph/v1/paper/DOI:${cleanDoi}/citations`);
  url.searchParams.set("fields", "title,abstract,authors,year,citationCount,isInfluential");
  url.searchParams.set("limit", "50");

  try {
    const response = await fetch(url, {
      headers: { "user-agent": "GeneEditRadar/0.1" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`Semantic Scholar API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const citations: any[] = data.data || [];

    // 过滤掉没有摘要的文献，并优先选择 isInfluential 为 true 的
    return citations
      .map(item => ({
        paperId: item.citingPaper?.paperId,
        title: item.citingPaper?.title,
        abstract: item.citingPaper?.abstract,
        year: item.citingPaper?.year,
        citationCount: item.citingPaper?.citationCount,
        isInfluential: item.isInfluential,
        authors: item.citingPaper?.authors || [],
      }))
      .filter(item => item.title && item.abstract)
      .sort((a, b) => {
        // 排序逻辑：Influential 优先，其次按引用量
        if (a.isInfluential !== b.isInfluential) return a.isInfluential ? -1 : 1;
        return (b.citationCount || 0) - (a.citationCount || 0);
      })
      .slice(0, 15); // 取 Top 15 篇最有代表性的引用
  } catch (error) {
    console.error("Failed to fetch citations from Semantic Scholar:", error);
    return [];
  }
}
