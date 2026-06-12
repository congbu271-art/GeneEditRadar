import type {
  AnalyzeEvaluation,
  AnalyzeIdea,
  AnalyzePaper,
  GeneEditingFeature,
  JournalSuggestion,
} from "@/lib/analyze-types";
import type { FieldOverviewAnchors } from "@/lib/analyze-llm";
import { toZhJournalTier } from "@/lib/ui-zh";
import { DISPLAY_NOT_REPORTED, uniqueStrings } from "@/lib/shared-utils";
import { topCounts, splitFeatureValues } from "./helpers";

export function buildFieldOverviewAnchors(features: GeneEditingFeature[]): FieldOverviewAnchors {
  return {
    tools: topCounts(features.flatMap((feature) => splitFeatureValues(feature.editingTool))),
    organisms: topCounts(features.flatMap((feature) => splitFeatureValues(feature.organism))),
    deliveries: topCounts(features.flatMap((feature) => splitFeatureValues(feature.deliveryMethod))),
    applications: topCounts(features.flatMap((feature) => splitFeatureValues(feature.targetTrait))),
  };
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
  const offTargetMissing = features.filter((feature) => feature.offTargetAnalysis === DISPLAY_NOT_REPORTED).length;
  const phenotypeMissing = features.filter((feature) => feature.phenotypeValidation === DISPLAY_NOT_REPORTED).length;

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
    `主要编辑工具：${tools.join("；") || DISPLAY_NOT_REPORTED}。`,
    `主要研究物种：${organisms.join("；") || DISPLAY_NOT_REPORTED}。`,
    `常见递送方式：${deliveryMethods.join("；") || DISPLAY_NOT_REPORTED}。`,
    `已报道应用方向：${applications.join("；") || DISPLAY_NOT_REPORTED}。`,
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
    .filter((tier) => tier && tier !== DISPLAY_NOT_REPORTED)
    .slice(0, 3);
  const observedJournals = uniqueStrings(
    analyzedPapers
      .map((paper) => paper.journal)
      .filter((journal) => journal !== DISPLAY_NOT_REPORTED),
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
        ? `基于当前启发式评分，优先建议以"${journalTier}"作为首选投稿层级，并围绕最低实验数据包补齐关键证据。`
        : averageScore >= 80
          ? `当前方向整体发表潜力较高，若差异化结果稳定，可同步关注"${journalTier}"层级窗口。`
          : `当前方向更适合作为"${journalTier}"层级的稳健投稿选项，建议先强化差异化与验证深度。`,
    exampleJournals: observedJournals.length > 0 ? observedJournals.slice(0, 3) : defaultExamples[journalTier] ?? [],
    reliabilityLabel: "启发式评分",
  }));
}