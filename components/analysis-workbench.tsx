"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, LoaderCircle, Sparkles, Network, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ScoreBars } from "@/components/score-bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  AnalyzeMode,
  AnalyzePaper,
  AnalyzeResponse,
  AnalyzeEvaluation,
  GeneEditingFeature,
  PaperStrategySummary,
  TechnologyTransferPathSummary,
} from "@/lib/analyze-types";
import { cn } from "@/lib/utils";

const NOT_REPORTED = "未报道";
const DEV_MODE = process.env.NODE_ENV === "development";

const exampleQueries = [
  "prime editing rice",
  "base editor wheat",
  "Cas12a plant genome editing",
  "TnpB genome editing",
  "cytosine base editor tomato",
];

const modeOptions: Array<{
  value: AnalyzeMode;
  label: string;
  description: string;
}> = [
  {
    value: "keyword",
    label: "关键词 / 研究方向分析",
    description: "适合输入一个方向、工具组合、物种场景或应用问题，系统会返回相关文献与领域概览。",
  },
  {
    value: "paper",
    label: "文献标题 / DOI / PMID 分析",
    description: "适合围绕一篇种子文献做延展分析，系统会识别目标文献并生成结构化解读、衍生选题与评估。",
  },
];

const loadingSteps = [
  "正在检索相关文献……",
  "正在解析基因编辑字段……",
  "正在生成衍生选题……",
  "正在评估发表潜力……",
];

const workflowSteps = [
  {
    idleLabel: "文献检索",
    idleDescription: "从相关文献源中筛选最相关的基因编辑研究，并建立初始候选集合。",
    loadingLabel: "正在检索相关文献……",
    completedLabel: "已检索相关文献",
  },
  {
    idleLabel: "字段解析",
    idleDescription: "提取编辑工具、物种、编辑类型、递送方式等结构化基因编辑字段。",
    loadingLabel: "正在解析基因编辑字段……",
    completedLabel: "已解析基因编辑字段",
  },
  {
    idleLabel: "衍生选题",
    idleDescription: "结合种子文献与研究空白，生成可继续推进的后续研究方向。",
    loadingLabel: "正在生成衍生选题……",
    completedLabel: "已生成衍生选题",
  },
  {
    idleLabel: "发表评估",
    idleDescription: "基于启发式规则评估新颖性、可行性、发表潜力与竞争风险。",
    loadingLabel: "正在评估发表潜力……",
    completedLabel: "已完成发表潜力评估",
  },
] as const;

const resultTabs = [
  { id: "papers", label: "相关文献" },
  { id: "overview", label: "领域概览" },
  { id: "ideas", label: "衍生选题" },
  { id: "evaluation", label: "可发表性评估" },
  { id: "journals", label: "期刊建议" },
] as const;

const workbenchCardClass = "overflow-hidden border-slate-200/80 bg-white";
const panelClass = "rounded-2xl border border-slate-200 bg-slate-50 p-4";
const accentPanelClass = "rounded-2xl border border-cyan-200 bg-cyan-50 p-4";
const softPanelClass = "rounded-2xl border border-slate-200 bg-white p-4";

type ResultTabId = (typeof resultTabs)[number]["id"];

export function getDefaultResultTab(mode: AnalyzeMode): ResultTabId {
  return mode === "paper" ? "ideas" : "papers";
}

export function getResultSectionSequence(mode: AnalyzeMode, hasPaperStrategySummary: boolean) {
  if (mode === "paper") {
    return hasPaperStrategySummary
      ? ["文献策略解读", "最优衍生方向", "衍生选题", "相关文献", "领域概览", "可发表性评估", "期刊建议"]
      : ["衍生选题", "相关文献", "领域概览", "可发表性评估", "期刊建议"];
  }

  return ["相关文献", "领域概览", "衍生选题", "可发表性评估", "期刊建议"];
}

function ReliabilityBadge({ label }: { label: string }) {
  const variant =
    label === "元数据" ? "secondary" : label === "规则解析" ? "default" : label === "启发式评分" ? "warning" : "success";

  return <Badge variant={variant}>{label}</Badge>;
}

function truncateText(value: string, limit = 260) {
  if (!value || value === NOT_REPORTED) {
    return NOT_REPORTED;
  }

  return value.length <= limit ? value : `${value.slice(0, limit).trim()}...`;
}

function toStringOrNotReported(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : NOT_REPORTED;
}

function toStringArray(value: unknown, fallback = NOT_REPORTED) {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [fallback];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function splitBadgeValues(value: string) {
  return value
    .split(/[;,，；、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== NOT_REPORTED);
}

function collectTopFeatureValues(
  features: GeneEditingFeature[],
  key: "editingTool" | "organism",
  limit = 4,
) {
  const counts = new Map<string, number>();

  for (const feature of features) {
    for (const value of splitBadgeValues(feature[key])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label]) => label);
}

function normalizePaper(paper: unknown): AnalyzePaper | null {
  if (!paper || typeof paper !== "object") {
    return null;
  }

  const candidate = paper as Partial<AnalyzePaper>;

  return {
    id: toStringOrNotReported(candidate.id),
    title: toStringOrNotReported(candidate.title),
    abstract: truncateText(toStringOrNotReported(candidate.abstract), 300),
    journal: toStringOrNotReported(candidate.journal),
    authors: toStringArray(candidate.authors),
    doi: toStringOrNotReported(candidate.doi),
    pmid: toStringOrNotReported(candidate.pmid),
    publishedAt: toStringOrNotReported(candidate.publishedAt),
    url: typeof candidate.url === "string" && candidate.url.trim() ? candidate.url : undefined,
    source: toStringOrNotReported(candidate.source),
    signalScore: typeof candidate.signalScore === "number" ? candidate.signalScore : 0,
    reliabilityLabel: "元数据",
  };
}

function normalizeFeature(feature: unknown): GeneEditingFeature | null {
  if (!feature || typeof feature !== "object") {
    return null;
  }

  const candidate = feature as Partial<GeneEditingFeature>;

  return {
    paperId: toStringOrNotReported(candidate.paperId),
    paperTitle: toStringOrNotReported(candidate.paperTitle),
    editingTool: toStringOrNotReported(candidate.editingTool),
    editorVariant: toStringOrNotReported(candidate.editorVariant),
    editingType: toStringOrNotReported(candidate.editingType),
    organism: toStringOrNotReported(candidate.organism),
    deliveryMethod: toStringOrNotReported(candidate.deliveryMethod),
    targetGene: toStringOrNotReported(candidate.targetGene),
    targetTrait: toStringOrNotReported(candidate.targetTrait),
    editingEfficiency: toStringOrNotReported(candidate.editingEfficiency),
    offTargetAnalysis: toStringOrNotReported(candidate.offTargetAnalysis),
    phenotypeValidation: toStringOrNotReported(candidate.phenotypeValidation),
    mainInnovation: toStringOrNotReported(candidate.mainInnovation),
    limitations: toStringOrNotReported(candidate.limitations),
    paperType: toStringOrNotReported(candidate.paperType),
    followUpOpportunities: toStringOrNotReported(candidate.followUpOpportunities),
    reliabilityLabel: "规则解析",
  };
}

function normalizeEvaluation(value: unknown): AnalyzeEvaluation {
  if (!value || typeof value !== "object") {
    return {
      targetIdeaName: NOT_REPORTED,
      novelty: 0,
      feasibility: 0,
      publicationPotential: 0,
      competitionRisk: 0,
      articleType: NOT_REPORTED,
      additionalExperiments: [NOT_REPORTED],
      journalTier: NOT_REPORTED,
      rationale: [NOT_REPORTED],
      reliabilityLabel: "启发式评分",
    };
  }

  const candidate = value as Partial<AnalyzeEvaluation>;

  return {
    targetIdeaName: toStringOrNotReported(candidate.targetIdeaName),
    novelty: typeof candidate.novelty === "number" ? candidate.novelty : 0,
    feasibility: typeof candidate.feasibility === "number" ? candidate.feasibility : 0,
    publicationPotential: typeof candidate.publicationPotential === "number" ? candidate.publicationPotential : 0,
    competitionRisk: typeof candidate.competitionRisk === "number" ? candidate.competitionRisk : 0,
    articleType: toStringOrNotReported(candidate.articleType),
    additionalExperiments: toStringArray(candidate.additionalExperiments),
    journalTier: toStringOrNotReported(candidate.journalTier),
    warning: typeof candidate.warning === "string" && candidate.warning.trim() ? candidate.warning : undefined,
    lowNoveltyWarning:
      typeof candidate.lowNoveltyWarning === "string" && candidate.lowNoveltyWarning.trim()
        ? candidate.lowNoveltyWarning
        : undefined,
    rationale: toStringArray(candidate.rationale),
    reliabilityLabel: "启发式评分",
  };
}

function normalizeAnalyzeResponse(payload: unknown): AnalyzeResponse {
  const data = payload && typeof payload === "object" ? (payload as Partial<AnalyzeResponse>) : {};
  const seedPaper = normalizePaper(data.seedPaper);
  const papers = Array.isArray(data.papers) ? data.papers.map(normalizePaper).filter(isPresent).slice(0, 5) : [];
  const paperIds = new Set(papers.map((paper) => paper.id));
  const structuredFeatures = Array.isArray(data.structuredFeatures)
    ? data.structuredFeatures
        .map(normalizeFeature)
        .filter((feature): feature is GeneEditingFeature => Boolean(feature && paperIds.has(feature.paperId)))
        .slice(0, 5)
    : [];
  const ideas = Array.isArray(data.ideas)
    ? data.ideas
        .map((idea) => {
          if (!idea || typeof idea !== "object") {
            return null;
          }

          const candidate = idea as AnalyzeResponse["ideas"][number];
          return {
            id: toStringOrNotReported(candidate.id),
            name: toStringOrNotReported(candidate.name),
            innovationType: toStringOrNotReported(candidate.innovationType),
            transferPath: toStringOrNotReported(candidate.transferPath),
            priority: candidate.priority === "高" || candidate.priority === "中" || candidate.priority === "低" ? candidate.priority : "中",
            basedOnPapers: toStringArray(candidate.basedOnPapers),
            innovationLogic: truncateText(toStringOrNotReported(candidate.innovationLogic), 280),
            feasibilityRisk: truncateText(toStringOrNotReported(candidate.feasibilityRisk), 220),
            feasibilityRationale: truncateText(toStringOrNotReported(candidate.feasibilityRationale), 220),
            minimumExperimentalPackage: toStringArray(candidate.minimumExperimentalPackage),
            minimumExperimentPackage: toStringArray(candidate.minimumExperimentPackage ?? candidate.minimumExperimentalPackage),
            recommendedJournalTier: toStringOrNotReported(candidate.recommendedJournalTier),
            suggestedJournalTier: toStringOrNotReported(candidate.suggestedJournalTier ?? candidate.recommendedJournalTier),
            articleType: toStringOrNotReported(candidate.articleType),
            novelty: typeof candidate.novelty === "number" ? candidate.novelty : 0,
            noveltyScore: typeof candidate.noveltyScore === "number" ? candidate.noveltyScore : typeof candidate.novelty === "number" ? candidate.novelty : 0,
            feasibility: typeof candidate.feasibility === "number" ? candidate.feasibility : 0,
            feasibilityScore:
              typeof candidate.feasibilityScore === "number" ? candidate.feasibilityScore : typeof candidate.feasibility === "number" ? candidate.feasibility : 0,
            publicationPotential: typeof candidate.publicationPotential === "number" ? candidate.publicationPotential : 0,
            publicationPotentialScore:
              typeof candidate.publicationPotentialScore === "number"
                ? candidate.publicationPotentialScore
                : typeof candidate.publicationPotential === "number"
                  ? candidate.publicationPotential
                  : 0,
            competitionRisk: typeof candidate.competitionRisk === "number" ? candidate.competitionRisk : 0,
            warning: typeof candidate.warning === "string" && candidate.warning.trim() ? candidate.warning : undefined,
            riskWarnings: toStringArray(candidate.riskWarnings),
            reliabilityLabel: "AI生成假设" as const,
          };
        })
        .filter(isPresent)
        .slice(0, 5)
    : [];
  const evaluation = normalizeEvaluation(data.evaluation);
  const paperStrategySummary: PaperStrategySummary | undefined =
    data.paperStrategySummary && typeof data.paperStrategySummary === "object"
      ? {
          overallStrategy: toStringOrNotReported(data.paperStrategySummary.overallStrategy),
          whyPublishable: toStringOrNotReported(data.paperStrategySummary.whyPublishable),
          coreInnovation: toStringOrNotReported(data.paperStrategySummary.coreInnovation),
          evidenceChain: toStringArray(data.paperStrategySummary.evidenceChain),
          limitations: toStringArray(data.paperStrategySummary.limitations),
        }
      : undefined;
  const technologyTransferPaths: TechnologyTransferPathSummary[] = Array.isArray(data.technologyTransferPaths)
    ? data.technologyTransferPaths
        .map((path) => {
          if (!path || typeof path !== "object") {
            return null;
          }

          const candidate = path as TechnologyTransferPathSummary;
          return {
            path: candidate.path,
            label: toStringOrNotReported(candidate.label),
            rationale: truncateText(toStringOrNotReported(candidate.rationale), 180),
            priority: candidate.priority === "高" || candidate.priority === "中" || candidate.priority === "低" ? candidate.priority : "中",
            reliabilityLabel: "规则解析" as const,
          };
        })
        .filter(isPresent)
    : [];

  return {
    mode: data.mode === "paper" ? "paper" : "keyword",
    query: typeof data.query === "string" && data.query.trim() ? data.query.trim() : "",
    detectedQueryKind:
      data.detectedQueryKind === "doi" || data.detectedQueryKind === "pmid" || data.detectedQueryKind === "title"
        ? data.detectedQueryKind
        : undefined,
    seedPaper: seedPaper ?? undefined,
    paperStrategySummary,
    technologyTransferPaths,
    papers,
    structuredFeatures,
    fieldOverview: typeof data.fieldOverview === "string" && data.fieldOverview.trim() ? data.fieldOverview : NOT_REPORTED,
    ideas,
    evaluation,
    journalSuggestions: Array.isArray(data.journalSuggestions)
      ? data.journalSuggestions
          .map((suggestion) => {
            if (!suggestion || typeof suggestion !== "object") {
              return null;
            }

            const candidate = suggestion as AnalyzeResponse["journalSuggestions"][number];
            return {
              journalTier: toStringOrNotReported(candidate.journalTier),
              rationale: truncateText(toStringOrNotReported(candidate.rationale), 220),
              exampleJournals: toStringArray(candidate.exampleJournals),
              reliabilityLabel: "启发式评分" as const,
            };
          })
          .filter(isPresent)
          .slice(0, 5)
      : [],
    warnings: Array.isArray(data.warnings)
      ? data.warnings.map((warning) => toStringOrNotReported(warning)).filter((warning) => warning !== NOT_REPORTED)
      : [],
    usedFallback: Boolean(data.usedFallback),
    sourceStatuses: Array.isArray(data.sourceStatuses)
      ? data.sourceStatuses
          .map((status) => {
            if (!status || typeof status !== "object") {
              return null;
            }

            const candidate = status as AnalyzeResponse["sourceStatuses"][number];
            return {
              source: toStringOrNotReported(candidate.source),
              ok: Boolean(candidate.ok),
              count: typeof candidate.count === "number" ? candidate.count : 0,
              error: typeof candidate.error === "string" && candidate.error.trim() ? candidate.error : undefined,
            };
          })
          .filter(isPresent)
      : [],
  };
}

function ScorePanel({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50",
      )}
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={cn("mt-3 font-display text-3xl", accent ? "text-cyan-800" : "text-slate-950")}>{value}</p>
    </div>
  );
}

function DetailPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-slate-950">{value}</p>
    </div>
  );
}

function getMatchedReason(
  mode: AnalyzeMode,
  paper: AnalyzePaper,
  feature: GeneEditingFeature | undefined,
  index: number,
  detectedQueryKind?: AnalyzeResponse["detectedQueryKind"],
) {
  const evidence = [
    feature?.editingTool && feature.editingTool !== NOT_REPORTED ? `编辑工具为${feature.editingTool}` : "",
    feature?.organism && feature.organism !== NOT_REPORTED ? `研究物种为${feature.organism}` : "",
    feature?.editingType && feature.editingType !== NOT_REPORTED ? `编辑类型为${feature.editingType}` : "",
  ].filter(Boolean);

  if (mode === "paper") {
    if (index === 0) {
      const queryKindLabel =
        detectedQueryKind === "doi" ? "DOI" : detectedQueryKind === "pmid" ? "PMID" : "标题";
      return `该论文与输入${queryKindLabel}直接匹配，已作为种子文献进入后续结构化分析。`;
    }

    return `该论文与种子文献在${evidence.slice(0, 2).join("、") || "主题与应用方向"}上具有交集，因此被纳入相关文献列表。`;
  }

  return `该论文在${evidence.join("、") || "标题、摘要与主题关键词"}层面与当前研究方向相关。`;
}

function getTransferPathIdea(result: AnalyzeResponse, label: string) {
  return result.ideas.find((idea) => idea.transferPath === label);
}

function EmptyResultState() {
  return (
    <Card className={workbenchCardClass}>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full border border-cyan-200 bg-cyan-50 p-4 text-cyan-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-2xl text-slate-950">等待分析输入</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            请输入关键词、研究方向、文献标题、DOI 或 PMID，系统会返回结构化的分析结果。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalysisWorkbench() {
  const [mode, setMode] = useState<AnalyzeMode>("keyword");
  const [query, setQuery] = useState(exampleQueries[0]);
  const [activeTab, setActiveTab] = useState<ResultTabId>(getDefaultResultTab("keyword"));
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (!DEV_MODE) {
      return;
    }

    if (result) {
      console.log("[analyze] response received", {
        mode: result.mode,
        hasPaperStrategySummary: Boolean(result.paperStrategySummary),
        technologyTransferPathsLength: result.technologyTransferPaths?.length ?? 0,
        ideasLength: result.ideas.length,
      });
    }
  }, [result]);

  useEffect(() => {
    if (!DEV_MODE) {
      return;
    }

    if (!isLoading) {
      console.log("[analyze] loading state changed to false");
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 900);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading]);

  const modeConfig = modeOptions.find((option) => option.value === mode) ?? modeOptions[0];
  const structuredFeatureMap = new Map((result?.structuredFeatures ?? []).map((feature) => [feature.paperId, feature]));
  const workflowPhase = isLoading ? "loading" : result ? "complete" : "idle";
  const overviewTools = result ? collectTopFeatureValues(result.structuredFeatures, "editingTool") : [];
  const overviewOrganisms = result ? collectTopFeatureValues(result.structuredFeatures, "organism") : [];

  const runAnalysis = useCallback(async () => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setError("请输入关键词、文献标题、DOI 或 PMID");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode, query: normalizedQuery }),
      });

      const payload = (await response.json()) as AnalyzeResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "分析失败，请稍后重试");
      }

      const normalizedResult = normalizeAnalyzeResponse(payload);

      if (DEV_MODE) {
        console.log("[analyze] response received", payload);
        console.log("[analyze] result.mode", normalizedResult.mode);
        console.log("[analyze] has paperStrategySummary", Boolean(normalizedResult.paperStrategySummary));
        console.log("[analyze] technologyTransferPaths.length", normalizedResult.technologyTransferPaths?.length ?? 0);
        console.log("[analyze] ideas.length", normalizedResult.ideas.length);
      }

      setResult(normalizedResult);
      setActiveTab(getDefaultResultTab(normalizedResult.mode));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "分析失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [mode, query]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="智能分析"
        title="智能分析"
        description="输入关键词、研究方向、文献标题、DOI 或 PMID，系统将返回相关文献、衍生选题、可发表性评估和期刊层级建议。"
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className={workbenchCardClass}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>分析入口</Badge>
              <Badge variant="secondary">中文学术工作流</Badge>
            </div>
            <CardTitle className="text-3xl text-slate-950">输入研究问题</CardTitle>
            <p className="text-sm leading-7 text-slate-600">{modeConfig.description}</p>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    mode === option.value
                      ? "border-cyan-300 bg-cyan-50 shadow-[0_16px_42px_-30px_rgba(14,116,144,0.75)]"
                      : "border-slate-200 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50/60",
                  )}
                >
                  <p className="font-display text-lg text-slate-950">{option.label}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{option.description}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-3">
              <label htmlFor="analysis-query" className="text-sm font-medium text-slate-700">
                分析输入
              </label>
              <Textarea
                id="analysis-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：prime editing rice、base editor wheat，或输入一篇文献标题 / DOI / PMID"
                className="min-h-40"
              />
              {mode === "paper" ? (
                <p className="text-xs leading-6 text-slate-500">
                  文献模式下可直接输入文献标题、DOI 或 PMID；未精确匹配时会返回最接近的候选文献。
                </p>
              ) : null}
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium text-slate-700">示例查询</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <Button type="button" size="lg" onClick={runAnalysis} disabled={isLoading} className="justify-center">
              {isLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在分析
                </>
              ) : (
                "开始分析"
              )}
            </Button>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-700">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={workbenchCardClass}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">分析流程</Badge>
              <ReliabilityBadge label="元数据" />
              <ReliabilityBadge label="规则解析" />
              <ReliabilityBadge label="启发式评分" />
              <ReliabilityBadge label="AI生成假设" />
            </div>
            <CardTitle className="text-3xl text-slate-950">输出结构与可靠性标签</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {workflowSteps.map((step, index) => {
              const isActive = workflowPhase === "loading" && loadingStepIndex === index;
              const isCompleted = workflowPhase === "complete";
              const title =
                workflowPhase === "idle"
                  ? step.idleLabel
                  : workflowPhase === "loading"
                    ? step.loadingLabel
                    : step.completedLabel;
              const description =
                workflowPhase === "idle"
                  ? step.idleDescription
                  : workflowPhase === "loading"
                    ? "系统正在处理这一阶段，请稍候查看完整结果。"
                    : "该步骤的结果已写入当前分析视图，可在下方标签页继续查看。";

              return (
                <div key={step.idleLabel} className={panelClass}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn("font-medium", isActive || isCompleted ? "text-slate-950" : "text-slate-700")}>{title}</p>
                    {isActive ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-700" /> : null}
                    {isCompleted ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        已完成
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isActive
                          ? "w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(52,211,153,0.92))]"
                          : isCompleted
                            ? "w-full bg-[linear-gradient(90deg,rgba(74,222,128,0.92),rgba(45,212,191,0.9))]"
                            : "w-1/3 bg-slate-300",
                      )}
                    />
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5 text-sm leading-7 text-slate-600">
              <p className="font-display text-xl text-slate-950">结果说明</p>
              <p className="mt-2">
                相关结论会尽量标注来源类型。文献信息属于“元数据”，字段提取属于“规则解析”，评分与期刊层级属于“启发式评分”，
                衍生选题属于“AI生成假设”。
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {isLoading ? (
        <Card className={workbenchCardClass}>
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center gap-3">
              <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" />
              <p className="font-display text-2xl text-slate-950">{loadingSteps[loadingStepIndex]}</p>
            </div>
            <p className="text-sm leading-7 text-slate-500">
              系统会依次聚合文献、解析基因编辑字段、生成衍生选题，并给出可发表性与期刊层级建议。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <Card className={workbenchCardClass}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>分析结果</Badge>
                  {result.detectedQueryKind ? (
                    <Badge variant="secondary">识别类型：{result.detectedQueryKind.toUpperCase()}</Badge>
                  ) : null}
                  {result.usedFallback ? <Badge variant="warning">已启用本地模拟文献回退</Badge> : null}
                </div>
                <CardTitle className="text-3xl text-slate-950">查询摘要</CardTitle>
                <p className="text-sm leading-7 text-slate-600">
                  {result.mode === "keyword"
                    ? "系统已基于该方向聚合相关文献，并形成领域概览、衍生选题与投稿建议。"
                    : "系统已围绕该种子文献生成相关文献集、结构化字段解析与选题评估。"}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className={accentPanelClass}>
                  <p className="text-xs font-semibold text-cyan-700">查询关键词</p>
                  <p className="mt-2 break-words font-display text-2xl text-cyan-950">{result.query}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <ScorePanel label="找到相关文献" value={`${result.papers.length} 篇`} accent />
                  <ScorePanel label="生成衍生选题" value={`${result.ideas.length} 个`} />
                  <ScorePanel label="新颖性评分" value={result.evaluation.novelty} />
                  <ScorePanel label="可行性评分" value={result.evaluation.feasibility} />
                  <ScorePanel label="发表潜力评分" value={result.evaluation.publicationPotential} />
                  <ScorePanel label="竞争风险" value={result.evaluation.competitionRisk} />
                </div>
                {result.warnings.length > 0 ? (
                  <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                    {result.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className={workbenchCardClass}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">数据源状态</Badge>
                  <ReliabilityBadge label="元数据" />
                </div>
                <CardTitle className="text-3xl text-slate-950">检索来源</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {result.usedFallback ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                    当前结果基于本地示例数据生成，后续接入真实文献源后可进一步更新。
                  </div>
                ) : result.sourceStatuses.length > 0 ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-800">
                    当前结果已综合 {result.sourceStatuses.map((status) => status.source).join("、")} 等文献源。
                  </div>
                ) : null}
                {result.sourceStatuses.length > 0 ? (
                  result.sourceStatuses.map((status) => (
                    <div
                      key={status.source}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-950">{status.source}</p>
                        <p className="mt-1 text-slate-500">
                          {status.ok ? `已返回 ${status.count} 条候选记录` : status.error ?? "检索失败"}
                        </p>
                      </div>
                      <Badge variant={status.ok ? "success" : "warning"}>{status.ok ? "在线" : "回退"}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前响应未提供额外数据源状态，结果已按核心分析字段完成渲染。
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {result.mode === "paper" ? result.paperStrategySummary ? (
            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className={workbenchCardClass}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ReliabilityBadge label="规则解析" />
                    <Badge variant="secondary">文献策略解读</Badge>
                  </div>
                  <CardTitle className="text-3xl text-slate-950">文献策略解读</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={panelClass}>
                      <p className="text-sm font-medium text-slate-950">研究整体思路</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{result.paperStrategySummary.overallStrategy}</p>
                    </div>
                    <div className={panelClass}>
                      <p className="text-sm font-medium text-slate-950">为什么这篇文章能够发表</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{result.paperStrategySummary.whyPublishable}</p>
                    </div>
                  </div>
                  <div className={accentPanelClass}>
                    <p className="text-sm font-medium text-cyan-950">核心创新点</p>
                    <p className="mt-3 text-sm leading-7 text-cyan-950/80">{result.paperStrategySummary.coreInnovation}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={panelClass}>
                      <p className="text-sm font-medium text-slate-950">证据链</p>
                      <div className="mt-3 grid gap-3">
                        {result.paperStrategySummary.evidenceChain.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-600">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={panelClass}>
                      <p className="text-sm font-medium text-slate-950">局限性</p>
                      <div className="mt-3 grid gap-3">
                        {result.paperStrategySummary.limitations.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-600">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={workbenchCardClass}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ReliabilityBadge label="规则解析" />
                    <Badge variant="secondary">最优衍生方向</Badge>
                  </div>
                  <CardTitle className="text-3xl text-slate-950">最优衍生方向</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {result.technologyTransferPaths && result.technologyTransferPaths.length > 0 ? (
                    result.technologyTransferPaths.map((path) => {
                      const transferIdea = getTransferPathIdea(result, path.label);

                      return (
                      <div key={path.path} className={panelClass}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{path.label}</Badge>
                          <Badge variant={path.priority === "高" ? "success" : path.priority === "中" ? "warning" : "secondary"}>
                            {path.priority}优先级
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{path.rationale}</p>
                        {transferIdea ? (
                          <div className="mt-4 grid gap-3">
                            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm leading-7 text-cyan-950/80">
                              <p className="font-medium text-cyan-950">优先建议继续做的体系</p>
                              <p className="mt-2">{transferIdea.name}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-600">
                              <p className="font-medium text-slate-950">为什么这个方向可行</p>
                              <p className="mt-2">{transferIdea.feasibilityRationale}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {transferIdea.minimumExperimentPackage.slice(0, 2).map((item) => (
                                <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-600">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                      当前未形成明确的技术迁移路径，建议结合更多上下游文献再判断最优衍生方向。
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
              当前结果缺少文献策略解读，请检查 /api/analyze 的 paper-mode 返回结构。
            </div>
          ) : null}

          <section className="flex flex-wrap gap-3">
            {resultTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800",
                )}
              >
                {tab.label}
              </button>
            ))}
          </section>

          {activeTab === "papers" ? (
            result.papers.length > 0 ? (
              <section className="grid gap-6">
                {result.papers.map((paper, index) => {
                  const feature = structuredFeatureMap.get(paper.id);

                  return (
                    <Card key={paper.id} className={workbenchCardClass}>
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-4xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <ReliabilityBadge label={paper.reliabilityLabel} />
                              <Badge variant="secondary">{paper.source}</Badge>
                              <Badge variant="secondary">信号分 {paper.signalScore}</Badge>
                            </div>
                            <CardTitle className="mt-4 text-2xl">{paper.title}</CardTitle>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {paper.journal} · {paper.publishedAt}
                          </p>
                        </div>
                          {paper.url ? (
                            <Button asChild variant="outline">
                              <a href={paper.url} target="_blank" rel="noreferrer">
                                查看来源
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-5">
                        <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 p-4 text-sm leading-7 text-slate-600">
                          <p className="font-medium text-slate-950">命中原因</p>
                          <p className="mt-2">
                            {getMatchedReason(result.mode, paper, feature, index, result.detectedQueryKind)}
                          </p>
                        </div>
                        <p className="text-sm leading-7 text-slate-600">{paper.abstract}</p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <DetailPanel label="来源" value={paper.source} />
                          <DetailPanel label="期刊" value={paper.journal} />
                          <DetailPanel label="发表日期" value={paper.publishedAt} />
                          <DetailPanel label="DOI" value={paper.doi} />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <DetailPanel label="PMID" value={paper.pmid} />
                          <DetailPanel label="编辑工具" value={feature?.editingTool ?? NOT_REPORTED} />
                          <DetailPanel label="研究物种" value={feature?.organism ?? NOT_REPORTED} />
                          <DetailPanel label="编辑类型" value={feature?.editingType ?? NOT_REPORTED} />
                        </div>
                        <div className={panelClass}>
                          <div className="flex flex-wrap items-center gap-2">
                            <ReliabilityBadge label={feature?.reliabilityLabel ?? "规则解析"} />
                            <Badge variant="secondary">{feature?.editingTool ?? NOT_REPORTED}</Badge>
                            <Badge variant="secondary">{feature?.organism ?? NOT_REPORTED}</Badge>
                            <Badge variant="secondary">{feature?.editingType ?? NOT_REPORTED}</Badge>
                          </div>
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                            <p className="font-medium text-slate-950">作者</p>
                            <p className="mt-2">{paper.authors.join(", ")}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            ) : (
              <Card className={workbenchCardClass}>
                <CardContent className="flex min-h-48 items-center justify-center text-center text-sm leading-7 text-muted-foreground">
                  未找到足够相关的文献，请尝试更具体的关键词
                </CardContent>
              </Card>
            )
          ) : null}

          {activeTab === "overview" ? (
            <Card className={workbenchCardClass}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ReliabilityBadge label="规则解析" />
                  <Badge variant="secondary">领域概览</Badge>
                </div>
                <CardTitle className="text-3xl">当前方向的结构化概览</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={panelClass}>
                    <p className="text-xs font-semibold text-slate-500">主要编辑工具</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {overviewTools.length > 0 ? (
                        overviewTools.map((tool) => (
                          <Badge key={tool} variant="secondary">
                            {tool}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">{NOT_REPORTED}</Badge>
                      )}
                    </div>
                  </div>
                  <div className={panelClass}>
                    <p className="text-xs font-semibold text-slate-500">主要研究物种</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {overviewOrganisms.length > 0 ? (
                        overviewOrganisms.map((organism) => (
                          <Badge key={organism} variant="secondary">
                            {organism}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">{NOT_REPORTED}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-8 text-slate-600">
                  {result.fieldOverview}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "ideas" ? (
            <section className="grid gap-6">
              {result.ideas.map((idea) => (
                <Card key={idea.id} className={workbenchCardClass}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-4xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <ReliabilityBadge label={idea.reliabilityLabel} />
                          <Badge variant="secondary">{idea.innovationType}</Badge>
                          <Badge variant="secondary">{idea.recommendedJournalTier}</Badge>
                        </div>
                        <CardTitle className="mt-4 text-2xl">{idea.name}</CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">基于文献：{idea.basedOnPapers.join("；")}</p>
                      </div>
                      <div className="rounded-3xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center">
                        <p className="font-display text-3xl text-cyan-700">{idea.publicationPotential}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-700/80">发表潜力</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailPanel label="创新类型" value={idea.innovationType} />
                      <DetailPanel label="衍生路径" value={idea.transferPath} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailPanel label="优先级" value={idea.priority} />
                      <DetailPanel label="推荐期刊层级" value={idea.suggestedJournalTier} />
                    </div>
                    {idea.evolutionAnalysis && (
                      <div className={cn(panelClass, "border-cyan-100 bg-cyan-50/30")}>
                        <div className="flex items-center gap-2 mb-3">
                          <Network className="h-4 w-4 text-cyan-600" />
                          <p className="font-medium text-slate-950">技术演进脉络 (基于真实引文图谱)</p>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed mb-4">{idea.evolutionAnalysis.innovationPathSummary}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> 已确立的研究分支 (红海)</p>
                            <ul className="list-disc pl-4 space-y-1 text-sm text-slate-600">
                              {idea.evolutionAnalysis.establishedPaths.map((path, i) => <li key={i}>{path}</li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-cyan-700 mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> 识别出的演进空白 (蓝海)</p>
                            <ul className="list-disc pl-4 space-y-1 text-sm text-cyan-800">
                              {idea.evolutionAnalysis.identifiedGaps.map((gap, i) => <li key={i}>{gap}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={panelClass}>
                      <p className="font-medium text-slate-950">创新逻辑</p>
                      <p className="mt-2">{idea.innovationLogic}</p>
                    </div>
                    <div className={panelClass}>
                      <p className="font-medium text-slate-950">可行性风险</p>
                      <p className="mt-2">{idea.feasibilityRisk}</p>
                    </div>
                    <div className={panelClass}>
                      <p className="font-medium text-slate-950">可行性依据</p>
                      <p className="mt-2">{idea.feasibilityRationale}</p>
                    </div>
                    <ScoreBars
                      scores={[
                        { label: "新颖性", value: idea.noveltyScore },
                        { label: "可行性", value: idea.feasibilityScore },
                        { label: "发表潜力", value: idea.publicationPotentialScore },
                        { label: "竞争风险", value: idea.competitionRisk },
                      ]}
                    />
                    <div className="grid gap-3">
                      <p className="font-display text-xl text-slate-950">最低实验数据包</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {idea.minimumExperimentPackage.map((item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    {idea.riskWarnings.length > 0 ? (
                      <div className="grid gap-3">
                        <p className="font-display text-xl text-slate-950">风险提示</p>
                        {idea.riskWarnings.map((warning) => (
                          <div
                            key={warning}
                            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800"
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {idea.warning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                        {idea.warning}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}

          {activeTab === "evaluation" ? (
            <Card className={workbenchCardClass}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ReliabilityBadge label={result.evaluation.reliabilityLabel} />
                  <Badge variant="secondary">主选题评估</Badge>
                </div>
                <CardTitle className="text-3xl">{result.evaluation.targetIdeaName}</CardTitle>
                <p className="text-sm leading-7 text-slate-600">
                  下列分数用于快速判断该方向是否值得继续投入实验设计与投稿准备，分数越高代表整体可推进性越强。
                </p>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ScorePanel label="新颖性评分" value={result.evaluation.novelty} accent />
                  <ScorePanel label="可行性评分" value={result.evaluation.feasibility} />
                  <ScorePanel label="发表潜力评分" value={result.evaluation.publicationPotential} />
                  <ScorePanel label="竞争风险" value={result.evaluation.competitionRisk} />
                </div>
                <ScoreBars
                  scores={[
                    { label: "新颖性评分", value: result.evaluation.novelty },
                    { label: "可行性评分", value: result.evaluation.feasibility },
                    { label: "发表潜力评分", value: result.evaluation.publicationPotential },
                    { label: "竞争风险", value: result.evaluation.competitionRisk },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailPanel label="文章类型判断" value={result.evaluation.articleType} />
                  <DetailPanel label="推荐期刊层级" value={result.evaluation.journalTier} />
                </div>
                {result.evaluation.warning ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                    {result.evaluation.warning}
                  </div>
                ) : null}
                {result.evaluation.lowNoveltyWarning ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-700">
                    {result.evaluation.lowNoveltyWarning}
                  </div>
                ) : null}
                <div className="grid gap-3">
                  <p className="font-display text-xl text-slate-950">建议补充实验</p>
                  {result.evaluation.additionalExperiments.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="grid gap-3">
                  <p className="font-display text-xl text-slate-950">评分依据</p>
                  {result.evaluation.rationale.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "journals" ? (
            <section className="grid gap-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                期刊建议为启发式判断，不代表投稿保证；实际投稿需结合完整数据质量、期刊 scope 和审稿偏好。
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {result.journalSuggestions.map((suggestion) => (
                  <Card key={suggestion.journalTier} className={workbenchCardClass}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <ReliabilityBadge label={suggestion.reliabilityLabel} />
                        <Badge variant="secondary">期刊层级建议</Badge>
                      </div>
                      <CardTitle className="text-2xl">{suggestion.journalTier}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <p className="text-sm leading-7 text-slate-600">{suggestion.rationale}</p>
                      <div className="grid gap-3">
                        <p className="text-xs font-semibold text-slate-500">示例期刊</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.exampleJournals.length > 0 ? (
                            suggestion.exampleJournals.map((journal) => (
                              <Badge key={journal} variant="secondary">
                                {journal}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary">{NOT_REPORTED}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyResultState />
      )}
    </div>
  );
}
