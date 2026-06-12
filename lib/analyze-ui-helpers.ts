import type {
  AnalyzeMode,
  AnalyzePaper,
  AnalyzeResponse,
  AnalyzeEvaluation,
  GeneEditingFeature,
} from "@/lib/analyze-types";

export const NOT_REPORTED = "未报道";

export const exampleQueries = [
  "prime editing rice",
  "base editor wheat",
  "Cas12a plant genome editing",
  "TnpB genome editing",
  "cytosine base editor tomato",
];

export const modeOptions: Array<{
  value: AnalyzeMode;
  label: string;
  description: string;
}> = [
  {
    value: "keyword",
    label: "关键词 / 研究方向分析",
    description:
      "适合输入一个方向、工具组合、物种场景或应用问题，系统会返回相关文献与领域概览。",
  },
  {
    value: "paper",
    label: "文献标题 / DOI / PMID 分析",
    description:
      "适合围绕一篇种子文献做延展分析，系统会识别目标文献并生成结构化解读、衍生选题与评估。",
  },
];

export const loadingSteps = [
  "正在检索相关文献……",
  "正在解析基因编辑字段……",
  "正在生成衍生选题……",
  "正在评估发表潜力……",
];

export const workflowSteps = [
  {
    idleLabel: "文献检索",
    idleDescription:
      "从相关文献源中筛选最相关的基因编辑研究，并建立初始候选集合。",
    loadingLabel: "正在检索相关文献……",
    completedLabel: "已检索相关文献",
  },
  {
    idleLabel: "字段解析",
    idleDescription:
      "提取编辑工具、物种、编辑类型、递送方式等结构化基因编辑字段。",
    loadingLabel: "正在解析基因编辑字段……",
    completedLabel: "已解析基因编辑字段",
  },
  {
    idleLabel: "衍生选题",
    idleDescription:
      "结合种子文献与研究空白，生成可继续推进的后续研究方向。",
    loadingLabel: "正在生成衍生选题……",
    completedLabel: "已生成衍生选题",
  },
  {
    idleLabel: "发表评估",
    idleDescription:
      "基于启发式规则评估新颖性、可行性、发表潜力与竞争风险。",
    loadingLabel: "正在评估发表潜力……",
    completedLabel: "已完成发表潜力评估",
  },
] as const;

export const resultTabs = [
  { id: "papers", label: "相关文献" },
  { id: "overview", label: "领域概览" },
  { id: "ideas", label: "衍生选题" },
  { id: "evaluation", label: "可发表性评估" },
  { id: "journals", label: "期刊建议" },
] as const;

export type ResultTabId = (typeof resultTabs)[number]["id"];

export function getDefaultResultTab(mode: AnalyzeMode): ResultTabId {
  return mode === "paper" ? "ideas" : "papers";
}

export function getResultSectionSequence(
  mode: AnalyzeMode,
  hasPaperStrategySummary: boolean,
) {
  if (mode === "paper") {
    return hasPaperStrategySummary
      ? [
          "文献策略解读",
          "最优衍生方向",
          "衍生选题",
          "相关文献",
          "领域概览",
          "可发表性评估",
          "期刊建议",
        ]
      : [
          "衍生选题",
          "相关文献",
          "领域概览",
          "可发表性评估",
          "期刊建议",
        ];
  }

  return ["相关文献", "领域概览", "衍生选题", "可发表性评估", "期刊建议"];
}

export function truncateText(value: string, limit = 260) {
  if (!value || value === NOT_REPORTED) {
    return NOT_REPORTED;
  }

  return value.length <= limit ? value : `${value.slice(0, limit).trim()}...`;
}

export function toStringOrNotReported(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : NOT_REPORTED;
}

export function toStringArray(value: unknown, fallback = NOT_REPORTED) {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [fallback];
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function splitBadgeValues(value: string) {
  return value
    .split(/[;,，；、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== NOT_REPORTED);
}

export function collectTopFeatureValues(
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
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, limit)
    .map(([label]) => label);
}

export function normalizePaper(paper: unknown): AnalyzePaper | null {
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
    url:
      typeof candidate.url === "string" && candidate.url.trim()
        ? candidate.url
        : undefined,
    source: toStringOrNotReported(candidate.source),
    signalScore:
      typeof candidate.signalScore === "number" ? candidate.signalScore : 0,
    reliabilityLabel: "元数据",
  };
}

export function normalizeFeature(
  feature: unknown,
): GeneEditingFeature | null {
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
    followUpOpportunities: toStringOrNotReported(
      candidate.followUpOpportunities,
    ),
    reliabilityLabel: "规则解析",
  };
}

export function normalizeEvaluation(value: unknown): AnalyzeEvaluation {
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
    novelty:
      typeof candidate.novelty === "number" ? candidate.novelty : 0,
    feasibility:
      typeof candidate.feasibility === "number" ? candidate.feasibility : 0,
    publicationPotential:
      typeof candidate.publicationPotential === "number"
        ? candidate.publicationPotential
        : 0,
    competitionRisk:
      typeof candidate.competitionRisk === "number"
        ? candidate.competitionRisk
        : 0,
    articleType: toStringOrNotReported(candidate.articleType),
    additionalExperiments: toStringArray(candidate.additionalExperiments),
    journalTier: toStringOrNotReported(candidate.journalTier),
    warning:
      typeof candidate.warning === "string" && candidate.warning.trim()
        ? candidate.warning
        : undefined,
    lowNoveltyWarning:
      typeof candidate.lowNoveltyWarning === "string" &&
      candidate.lowNoveltyWarning.trim()
        ? candidate.lowNoveltyWarning
        : undefined,
    rationale: toStringArray(candidate.rationale),
    reliabilityLabel: "启发式评分",
  };
}

export function normalizeAnalyzeResponse(
  payload: unknown,
): AnalyzeResponse {
  const data =
    payload && typeof payload === "object"
      ? (payload as Partial<AnalyzeResponse>)
      : {};
  const seedPaper = normalizePaper(data.seedPaper);
  const papers = Array.isArray(data.papers)
    ? data.papers.map(normalizePaper).filter(isPresent).slice(0, 5)
    : [];
  const paperIds = new Set(papers.map((paper) => paper.id));
  const structuredFeatures = Array.isArray(data.structuredFeatures)
    ? data.structuredFeatures
        .map(normalizeFeature)
        .filter(
          (feature): feature is GeneEditingFeature =>
            Boolean(feature && paperIds.has(feature.paperId)),
        )
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
            priority:
              candidate.priority === "高" ||
              candidate.priority === "中" ||
              candidate.priority === "低"
                ? candidate.priority
                : "中",
            basedOnPapers: toStringArray(candidate.basedOnPapers),
            innovationLogic: truncateText(
              toStringOrNotReported(candidate.innovationLogic),
              280,
            ),
            feasibilityRisk: truncateText(
              toStringOrNotReported(candidate.feasibilityRisk),
              220,
            ),
            feasibilityRationale: truncateText(
              toStringOrNotReported(candidate.feasibilityRationale),
              220,
            ),
            minimumExperimentalPackage: toStringArray(
              candidate.minimumExperimentalPackage,
            ),
            minimumExperimentPackage: toStringArray(
              candidate.minimumExperimentPackage ??
                candidate.minimumExperimentalPackage,
            ),
            recommendedJournalTier: toStringOrNotReported(
              candidate.recommendedJournalTier,
            ),
            suggestedJournalTier: toStringOrNotReported(
              candidate.suggestedJournalTier ??
                candidate.recommendedJournalTier,
            ),
            articleType: toStringOrNotReported(candidate.articleType),
            novelty:
              typeof candidate.novelty === "number" ? candidate.novelty : 0,
            noveltyScore:
              typeof candidate.noveltyScore === "number"
                ? candidate.noveltyScore
                : typeof candidate.novelty === "number"
                  ? candidate.novelty
                  : 0,
            feasibility:
              typeof candidate.feasibility === "number"
                ? candidate.feasibility
                : 0,
            feasibilityScore:
              typeof candidate.feasibilityScore === "number"
                ? candidate.feasibilityScore
                : typeof candidate.feasibility === "number"
                  ? candidate.feasibility
                  : 0,
            publicationPotential:
              typeof candidate.publicationPotential === "number"
                ? candidate.publicationPotential
                : 0,
            publicationPotentialScore:
              typeof candidate.publicationPotentialScore === "number"
                ? candidate.publicationPotentialScore
                : typeof candidate.publicationPotential === "number"
                  ? candidate.publicationPotential
                  : 0,
            competitionRisk:
              typeof candidate.competitionRisk === "number"
                ? candidate.competitionRisk
                : 0,
            warning:
              typeof candidate.warning === "string" && candidate.warning.trim()
                ? candidate.warning
                : undefined,
            riskWarnings: toStringArray(candidate.riskWarnings),
            reliabilityLabel: "AI生成假设" as const,
          };
        })
        .filter(isPresent)
        .slice(0, 5)
    : [];
  const evaluation = normalizeEvaluation(data.evaluation);
  const paperStrategySummary =
    data.paperStrategySummary &&
    typeof data.paperStrategySummary === "object"
      ? {
          overallStrategy: toStringOrNotReported(
            data.paperStrategySummary.overallStrategy,
          ),
          whyPublishable: toStringOrNotReported(
            data.paperStrategySummary.whyPublishable,
          ),
          coreInnovation: toStringOrNotReported(
            data.paperStrategySummary.coreInnovation,
          ),
          evidenceChain: toStringArray(
            data.paperStrategySummary.evidenceChain,
          ),
          limitations: toStringArray(data.paperStrategySummary.limitations),
        }
      : undefined;
  const technologyTransferPaths = Array.isArray(
    data.technologyTransferPaths,
  )
    ? data.technologyTransferPaths
        .map((path) => {
          if (!path || typeof path !== "object") {
            return null;
          }

          const candidate =
            path as import("@/lib/analyze-types").TechnologyTransferPathSummary;
          return {
            path: candidate.path,
            label: toStringOrNotReported(candidate.label),
            rationale: truncateText(
              toStringOrNotReported(candidate.rationale),
              180,
            ),
            priority:
              candidate.priority === "高" ||
              candidate.priority === "中" ||
              candidate.priority === "低"
                ? candidate.priority
                : "中",
            reliabilityLabel: "规则解析" as const,
          };
        })
        .filter(isPresent)
    : [];

  return {
    mode: data.mode === "paper" ? "paper" : "keyword",
    query:
      typeof data.query === "string" && data.query.trim()
        ? data.query.trim()
        : "",
    detectedQueryKind:
      data.detectedQueryKind === "doi" ||
      data.detectedQueryKind === "pmid" ||
      data.detectedQueryKind === "title"
        ? data.detectedQueryKind
        : undefined,
    seedPaper: seedPaper ?? undefined,
    paperStrategySummary,
    technologyTransferPaths,
    papers,
    structuredFeatures,
    fieldOverview:
      typeof data.fieldOverview === "string" && data.fieldOverview.trim()
        ? data.fieldOverview
        : NOT_REPORTED,
    ideas,
    evaluation,
    journalSuggestions: Array.isArray(data.journalSuggestions)
      ? data.journalSuggestions
          .map((suggestion) => {
            if (!suggestion || typeof suggestion !== "object") {
              return null;
            }

            const candidate =
              suggestion as AnalyzeResponse["journalSuggestions"][number];
            return {
              journalTier: toStringOrNotReported(candidate.journalTier),
              rationale: truncateText(
                toStringOrNotReported(candidate.rationale),
                220,
              ),
              exampleJournals: toStringArray(candidate.exampleJournals),
              reliabilityLabel: "启发式评分" as const,
            };
          })
          .filter(isPresent)
          .slice(0, 5)
      : [],
    warnings: Array.isArray(data.warnings)
      ? data.warnings
          .map((warning) => toStringOrNotReported(warning))
          .filter((warning) => warning !== NOT_REPORTED)
      : [],
    usedFallback: Boolean(data.usedFallback),
    sourceStatuses: Array.isArray(data.sourceStatuses)
      ? data.sourceStatuses
          .map((status) => {
            if (!status || typeof status !== "object") {
              return null;
            }

            const candidate =
              status as AnalyzeResponse["sourceStatuses"][number];
            return {
              source: toStringOrNotReported(candidate.source),
              ok: Boolean(candidate.ok),
              count:
                typeof candidate.count === "number" ? candidate.count : 0,
              error:
                typeof candidate.error === "string" && candidate.error.trim()
                  ? candidate.error
                  : undefined,
            };
          })
          .filter(isPresent)
      : [],
  };
}

export function getMatchedReason(
  mode: AnalyzeMode,
  paper: AnalyzePaper,
  feature: GeneEditingFeature | undefined,
  index: number,
  detectedQueryKind?: AnalyzeResponse["detectedQueryKind"],
) {
  const evidence = [
    feature?.editingTool && feature.editingTool !== NOT_REPORTED
      ? `编辑工具为${feature.editingTool}`
      : "",
    feature?.organism && feature.organism !== NOT_REPORTED
      ? `研究物种为${feature.organism}`
      : "",
    feature?.editingType && feature.editingType !== NOT_REPORTED
      ? `编辑类型为${feature.editingType}`
      : "",
  ].filter(Boolean);

  if (mode === "paper") {
    if (index === 0) {
      const queryKindLabel =
        detectedQueryKind === "doi"
          ? "DOI"
          : detectedQueryKind === "pmid"
            ? "PMID"
            : "标题";
      return `该论文与输入${queryKindLabel}直接匹配，已作为种子文献进入后续结构化分析。`;
    }

    return `该论文与种子文献在${evidence.slice(0, 2).join("、") || "主题与应用方向"}上具有交集，因此被纳入相关文献列表。`;
  }

  return `该论文在${evidence.join("、") || "标题、摘要与主题关键词"}层面与当前研究方向相关。`;
}

export function getTransferPathIdea(
  result: AnalyzeResponse,
  label: string,
) {
  return result.ideas.find((idea) => idea.transferPath === label);
}
