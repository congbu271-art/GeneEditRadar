import type { Route } from "next";

import {
  authors,
  geneTargets,
  getDashboardMetrics,
  journals,
  papers,
  subscriptions,
  topics,
} from "@/lib/mock-data";
import { generatedResearchIdeas } from "@/lib/research-ideas";
import { average } from "@/lib/utils";

export const navigationItems = [
  { href: "/dashboard", label: "文献雷达" },
  { href: "/papers", label: "最新文献" },
  { href: "/subscriptions", label: "订阅匹配" },
  { href: "/notifications" as Route, label: "文献通知" },
  { href: "/analyze" as Route, label: "智能分析" },
  { href: "/ideas", label: "选题机会" },
  { href: "/evaluate", label: "选题评估" },
  { href: "/journals", label: "期刊匹配" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export const dashboardMetrics = getDashboardMetrics();

export const enrichedPapers = papers.map((paper) => ({
  ...paper,
  journal: journals.find((journal) => journal.slug === paper.journalSlug)!,
  authors: authors.filter((author) => paper.authorIds.includes(author.id)),
  genes: geneTargets.filter((gene) => paper.geneSymbols.includes(gene.symbol)),
  topics: topics.filter((topic) => paper.topicSlugs.includes(topic.slug)),
}));

export const enrichedIdeas = generatedResearchIdeas.map((idea) => ({
  ...idea,
  paper: enrichedPapers.find((paper) => paper.id === idea.paperId),
  topic: topics.find((topic) => topic.slug === idea.topicSlug),
}));

export const enrichedSubscriptions = subscriptions.map((subscription) => ({
  ...subscription,
  journal: journals.find((journal) => journal.slug === subscription.journalSlug),
  topic: topics.find((topic) => topic.slug === subscription.topicSlug),
  gene: geneTargets.find((gene) => gene.symbol === subscription.geneSymbol),
  matchingPaperCount: enrichedPapers.filter((paper) => {
    const matchesTopic = subscription.topicSlug ? paper.topicSlugs.includes(subscription.topicSlug) : true;
    const matchesJournal = subscription.journalSlug ? paper.journalSlug === subscription.journalSlug : true;
    const matchesGene = subscription.geneSymbol ? paper.geneSymbols.includes(subscription.geneSymbol) : true;
    return matchesTopic && matchesJournal && matchesGene && paper.compositeScore >= subscription.signalThreshold;
  }).length,
}));

export const enrichedJournals = journals.map((journal) => {
  const journalPapers = enrichedPapers.filter((paper) => paper.journalSlug === journal.slug);

  return {
    ...journal,
    topics: topics.filter((topic) => journal.topicSlugs.includes(topic.slug)),
    papers: journalPapers,
    averageScore: average(journalPapers.map((paper) => paper.compositeScore)),
    trendCount: journalPapers.filter((paper) => paper.status === "Trending").length,
  };
});

export const topicSignalMap = topics.map((topic) => {
  const topicPapers = enrichedPapers.filter((paper) => paper.topicSlugs.includes(topic.slug));

  return {
    ...topic,
    paperCount: topicPapers.length,
    averageScore: average(topicPapers.map((paper) => paper.compositeScore)),
  };
});

export const evaluationBenchmarks = [
  {
    label: "新颖性评分",
    description: "衡量方案相对锚定论文的差异化程度，以及其可能带来的新增研究信号。",
  },
  {
    label: "可行性评分",
    description: "衡量在较小研究规模下，编辑、递送与读出体系是否能够被可信地执行。",
  },
  {
    label: "发表潜力评分",
    description: "衡量结果是否足以支撑一篇扎实的方法学、转化或应用型论文。",
  },
  {
    label: "竞争风险",
    description: "衡量该方向相对于当前热点编辑主题与显性跟进工作而言，是否已显得拥挤。",
  },
];

export const signalWindows = [
  { label: "7 日增幅", value: "+18%", detail: "相较上一周新增的高信号文献" },
  { label: "期刊覆盖", value: "4", detail: "当前持续跟踪的不同期刊数量" },
  {
    label: "选题产出",
    value: `${enrichedIdeas.filter((idea) => idea.score >= 80).length}`,
    detail: "当前生成并达到 80 分以上评估阈值的衍生研究方向数量。",
  },
];
