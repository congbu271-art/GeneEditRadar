import {
  dedupePapers,
  type CollectedPaper,
} from "@/lib/literature";
import {
  extractGeneEditingDetails,
} from "@/lib/paper-extraction";
import {
  evaluateGeneEditingIdea,
  generateIdeasForSeedPaper,
} from "@/lib/research-ideas";
import {
  getLocalizedEvaluationCopy,
  getLocalizedIdeaCopy,
  toZhIdeaType,
  toZhJournalTier,
  toZhSourceName,
} from "@/lib/ui-zh";
import type {
  AnalyzeIdea,
  AnalyzeRequestInput,
  AnalyzeResponse,
  TechnologyTransferPath,
} from "@/lib/analyze-types";
import { isLlmEnabled } from "@/lib/llm";
import {
  buildFieldOverviewWithLlm,
  buildPaperInsightsWithLlm,
} from "@/lib/analyze-llm";
import {
  DISPLAY_NOT_REPORTED,
  toExtractionSourcePaper,
  uniqueStrings,
} from "@/lib/shared-utils";

import {
  DEFAULT_ANALYSIS_LIMIT,
  type RankedPaper,
  type SourceStatus,
  type PaperQueryDetection,
} from "./helpers";
import {
  searchPubMedByKeyword,
  searchPubMedByReference,
  backfillPubMedAbstracts,
  searchEuropePmc,
  searchEuropePmcByReference,
  searchCrossref,
  searchCrossrefByReference,
  mockCollectedPapers,
} from "./search";
import {
  rankKeywordPapers,
  rankReferencePapers,
  detectQueryType,
  normalizeAnalyzeRequest,
  searchLocalPapers,
  searchMockByReference,
  getDefaultLocalPapers,
  isExactReferenceMatch,
  buildRelatedKeywordFromPaper,
} from "./ranking";
import { toAnalyzePaper, toStructuredFeature, toSyntheticRadarPaper, buildIdeaSeedPaper } from "./features";
import {
  classifyTechnologyTransferPath,
} from "./transfer-paths";
import {
  buildPaperStrategySummary,
  buildPaperModeIdeas,
  buildLlmTransferPathSummaries,
  buildLlmPaperStrategySummary,
  buildLlmPaperModeIdeas,
  mapTransferPathToIdeaType,
} from "./strategy";
import {
  buildFieldOverview,
  buildFieldOverviewAnchors,
  buildJournalSuggestions,
} from "./field-overview";

type SourceResult = {
  papers: CollectedPaper[];
  status: SourceStatus;
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
    warnings.push(`未检索到与"${query}"直接相关的文献，当前返回本地模拟文献作为分析参考。`);
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

  const rankedPapers = await backfillPubMedAbstracts(queryResult.papers.slice(0, mode === "keyword" ? 8 : 6));
  const extracted = await Promise.all(
    rankedPapers.map(async (paper) => ({
      paper,
      extraction: await extractGeneEditingDetails(toExtractionSourcePaper(paper)),
    })),
  );

  const analyzedPapers = extracted.map(({ paper }) => toAnalyzePaper(paper));
  const structuredFeatures = extracted.map(({ paper, extraction }) => toStructuredFeature(paper, extraction));
  const seedExtracted =
    mode === "paper" && paperResult?.seed
      ? extracted.find((item) => item.paper.id === paperResult.seed?.id) ?? extracted[0]
      : undefined;
  const seedPaper = seedExtracted ? toAnalyzePaper(seedExtracted.paper) : undefined;
  const seedIdeaPaper = seedExtracted ? buildIdeaSeedPaper(seedExtracted.paper, seedExtracted.extraction, query) : undefined;

  const fieldOverview =
    (mode === "keyword" && isLlmEnabled()
      ? await buildFieldOverviewWithLlm(analyzedPapers, structuredFeatures, buildFieldOverviewAnchors(structuredFeatures))
      : null) ?? buildFieldOverview(analyzedPapers, structuredFeatures);

  const paperInsights =
    mode === "paper" && seedIdeaPaper && seedExtracted && isLlmEnabled()
      ? await buildPaperInsightsWithLlm({
          seed: {
            title: seedExtracted.paper.title,
            abstract: seedExtracted.paper.abstract,
            journal: seedExtracted.paper.journal,
            organisms: seedExtracted.paper.organisms,
            editorTypes: seedExtracted.paper.editorTypes,
          },
          extraction: seedExtracted.extraction as unknown as Record<string, string>,
          relatedPapers: analyzedPapers
            .filter((paper) => paper.id !== seedPaper?.id)
            .map((paper) => ({ title: paper.title, abstract: paper.abstract })),
        })
      : null;

  const technologyTransferPaths =
    mode === "paper" && seedIdeaPaper && seedExtracted
      ? paperInsights
        ? buildLlmTransferPathSummaries(paperInsights)
        : classifyTechnologyTransferPath(seedIdeaPaper, seedExtracted.extraction)
      : undefined;
  const paperStrategySummary =
    mode === "paper" && seedPaper && seedExtracted
      ? paperInsights
        ? buildLlmPaperStrategySummary(paperInsights)
        : buildPaperStrategySummary(seedPaper, toStructuredFeature(seedExtracted.paper, seedExtracted.extraction), technologyTransferPaths ?? [])
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
          .slice(0, DEFAULT_ANALYSIS_LIMIT);

  const ideas: AnalyzeIdea[] =
    mode === "paper" && seedIdeaPaper && seedExtracted
      ? paperInsights
        ? buildLlmPaperModeIdeas(seedIdeaPaper, seedExtracted.extraction, paperInsights)
        : buildPaperModeIdeas(seedIdeaPaper, seedExtracted.extraction, technologyTransferPaths ?? [])
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
          const riskWarnings = uniqueStrings([
            localizedIdea.risk,
            ...(evaluation.isIncremental ? ["若仅完成单靶点验证，容易被评价为低创新增量研究。"] : []),
          ]).filter((value) => value && value !== DISPLAY_NOT_REPORTED);

          return {
            id: idea.id,
            name: localizedIdea.title,
            innovationType: toZhIdeaType(idea.ideaType),
            transferPath: toZhIdeaType(idea.ideaType),
            priority: "中" as const,
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
        targetIdeaName: DISPLAY_NOT_REPORTED,
        novelty: 0,
        feasibility: 0,
        publicationPotential: 0,
        competitionRisk: 0,
        articleType: DISPLAY_NOT_REPORTED,
        additionalExperiments: [DISPLAY_NOT_REPORTED],
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
              leadIdea.minimumExperimentPackage.length > 0 ? leadIdea.minimumExperimentPackage : [DISPLAY_NOT_REPORTED],
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
