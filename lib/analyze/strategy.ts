import { NOT_REPORTED, type GeneEditingExtraction } from "@/lib/paper-extraction";
import {
  evaluateGeneEditingIdea,
  type IdeaSeedPaper,
} from "@/lib/research-ideas";
import {
  getLocalizedEvaluationCopy,
  toZhExtractionValue,
  toZhIdeaType,
  toZhJournalTier,
} from "@/lib/ui-zh";
import type {
  AnalyzeEvaluation,
  AnalyzeIdea,
  AnalyzePaper,
  GeneEditingFeature,
  PaperStrategySummary,
  TechnologyTransferPath,
  TechnologyTransferPathSummary,
} from "@/lib/analyze-types";
import type { PaperInsightsLlm } from "@/lib/analyze-llm";
import { DISPLAY_NOT_REPORTED, normalizeTitle } from "@/lib/shared-utils";
import { toSyntheticRadarPaper } from "./features";
import {
  DEFAULT_PAPER_IDEA_LIMIT,
  transferPathLabelMap,
  slugify,
  splitFeatureValues,
  uniqueNonReported,
  priorityWeight,
  splitInsightList,
} from "./helpers";

function isMultiplexOrPathwayKeyword(text: string) {
  return /\b(multiplex|multigene|multi-gene|multi gene|pathway|quintuple|simultaneous(?:ly)?|five key genes)\b/.test(text);
}

export function buildPaperStrategySummary(
  seedPaper: AnalyzePaper,
  feature: GeneEditingFeature,
  transferPaths: TechnologyTransferPathSummary[],
): PaperStrategySummary {
  const editingTool = feature.editingTool !== DISPLAY_NOT_REPORTED ? feature.editingTool : feature.editingType;
  const organism = feature.organism !== DISPLAY_NOT_REPORTED ? feature.organism : DISPLAY_NOT_REPORTED;
  const targetGene = feature.targetGene !== DISPLAY_NOT_REPORTED ? feature.targetGene : DISPLAY_NOT_REPORTED;
  const targetTrait = feature.targetTrait !== DISPLAY_NOT_REPORTED ? feature.targetTrait : DISPLAY_NOT_REPORTED;
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
    ) || feature.mainInnovation !== DISPLAY_NOT_REPORTED;
  const isTraitPaper =
    targetTrait !== DISPLAY_NOT_REPORTED ||
    feature.phenotypeValidation !== DISPLAY_NOT_REPORTED ||
    /\b(trait|yield|quality|nutrition|biofortification|phytonutrient|rescue|resistance|phenotype|agronomic)\b/.test(paperFocusText);

  const overallStrategy =
    isTraitPaper && hasMultiplexSignal
      ? `该研究围绕${targetTrait !== DISPLAY_NOT_REPORTED ? targetTrait : "目标性状"}这一应用问题，采用${editingTool}在${primaryOrganism}中同步编辑多个关键位点，以通路级重构的方式完成性状强化，并进一步用功能或表型结果证明其应用价值。`
      : isToolPaper
        ? `该研究围绕编辑工具本身的可用性与扩展性，先在${primaryOrganism}中建立或优化${editingTool}路线，再围绕${targetGene !== DISPLAY_NOT_REPORTED ? targetGene : "目标位点"}验证该工具是否具备更好的性能与迁移潜力。`
        : `该研究围绕${targetTrait !== DISPLAY_NOT_REPORTED ? targetTrait : "目标问题"}，采用${editingTool}在${primaryOrganism}中完成编辑验证，并通过功能或表型读出支撑研究结论。`;

  const whyPublishable =
    isTraitPaper
      ? `它之所以具有发表性，关键在于把编辑工具、${primaryOrganism}体系与${targetTrait !== DISPLAY_NOT_REPORTED ? targetTrait : "应用终点"}直接连接起来，并用${hasTraitQuantification ? "代谢物或目标性状定量" : "功能读出"}、${hasTradeoffCheck ? "trade-off 评估" : "表型观察"}${hasInVivoValidation ? "以及进一步的体内验证" : ""}组成较完整的数据闭环。`
      : `它之所以能够发表，核心不只是"能不能编辑"，而是提出了可比较、可迁移的技术路线，并在${primaryOrganism}中提供了${feature.offTargetAnalysis !== DISPLAY_NOT_REPORTED ? "性能与特异性" : "性能"}层面的关键验证，因此具备继续外推到其他体系的价值。`;

  const coreInnovation =
    hasMultiplexSignal && isTraitPaper
      ? `该研究的核心创新在于利用${editingTool}在${primaryOrganism}中同步编辑多个关键位点，把多条营养或功能相关通路整合到同一作物背景中，形成比单性状改良更完整的多目标应用框架。`
      : feature.mainInnovation !== DISPLAY_NOT_REPORTED
      ? feature.mainInnovation
      : transferPaths[0]
        ? `该研究最值得延展的创新点在于其"${transferPaths[0].label}"潜力，即该技术路线有机会跨体系迁移或转化为更强的后续应用。`
        : `该研究的创新点主要体现为在${organism}中搭建了${editingTool}相关技术路线。`;

  const evidenceChain = uniqueNonReported([
    hasMultiplexSignal ? "多基因 / 多位点编辑策略设计" : "编辑策略与构建设计",
    feature.editingEfficiency !== DISPLAY_NOT_REPORTED ? "多靶点效率与编辑结果验证" : "编辑结果与分子层面验证",
    hasTraitQuantification ? "目标性状或代谢物定量检测" : "",
    feature.phenotypeValidation !== DISPLAY_NOT_REPORTED ? "表型或功能验证" : "",
    hasTradeoffCheck ? "生长、果实品质或 trade-off 评估" : "",
    hasHeritabilitySignal ? "稳定遗传或后代一致性验证" : "",
    feature.offTargetAnalysis !== DISPLAY_NOT_REPORTED ? "脱靶或副产物分析" : "",
  ]);

  const limitations = uniqueNonReported([
    ...splitInsightList(feature.limitations),
    ...(feature.editingEfficiency === DISPLAY_NOT_REPORTED ? ["编辑效率的定量结果未报道。"] : []),
    ...(feature.offTargetAnalysis === DISPLAY_NOT_REPORTED ? ["脱靶或特异性评估仍需补充。"] : []),
    ...(feature.phenotypeValidation === DISPLAY_NOT_REPORTED ? ["表型或功能验证仍需进一步强化。"] : []),
    ...(isPlantPaper && !hasHeritabilitySignal ? ["稳定遗传或后代一致性证据仍需进一步补齐。"] : []),
    ...(isToolPaper ? ["若缺少与既有编辑器版本的系统 head-to-head 比较，工具升级幅度仍可能被低估。"] : []),
    ...(transferPaths.length === 0 ? ["当前尚未形成明确的跨体系技术迁移路线。"] : []),
  ]);

  return {
    overallStrategy,
    whyPublishable,
    coreInnovation,
    evidenceChain: evidenceChain.length > 0 ? evidenceChain : [DISPLAY_NOT_REPORTED],
    limitations: limitations.length > 0 ? limitations : [DISPLAY_NOT_REPORTED],
  };
}

export function selectJournalTierFromScores(
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

export function mapTransferPathToIdeaType(path: TechnologyTransferPath) {
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

export function buildPlantTransferTargetText(seedPaper: IdeaSeedPaper) {
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

export function buildRelatedCropTransferTarget(seedPaper: IdeaSeedPaper) {
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

export function buildTransferPathIdeaDraft(
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
        riskWarnings: ["若表型终点不够清晰，论文会重新退回到\u201C仅技术验证\u201D的评价。"],
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
        feasibilityRationale: "特异性优化与比较通常能与原体系直接衔接，且对审稿人来说是最容易理解的\u201C必要补全\u201D方向。",
        minimumExperimentPackage: [
          "加入至少 1–2 组特异性优化设计，例如 guide scaffold、表达窗口或 editor 版本调整。",
          "同时报告在靶编辑、旁观者编辑与脱靶对照结果。",
          "在第二个独立位点或第二种体系中复现特异性收益。",
        ],
        riskWarnings: ["若缺少对照编辑器版本，特异性改进很难被说服性接受。"],
      };
  }
}

export function applyPriorityAdjustments(
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
      feasibilityRisk: genericRiskWarnings[0] ?? DISPLAY_NOT_REPORTED,
      feasibilityRationale: draft.feasibilityRationale,
      minimumExperimentalPackage: draft.minimumExperimentPackage,
      minimumExperimentPackage: draft.minimumExperimentPackage, // backward-compat alias
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

// ---------- LLM 洞察 → 现有结构装配（打分仍走规则，保证口径一致） ----------

export function buildLlmTransferPathSummaries(insights: PaperInsightsLlm): TechnologyTransferPathSummary[] {
  const seen = new Set<TechnologyTransferPath>();
  const summaries: TechnologyTransferPathSummary[] = [];

  for (const item of insights.transferPaths) {
    if (seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    summaries.push({
      path: item.path,
      label: transferPathLabelMap[item.path],
      rationale: item.rationale,
      priority: item.priority,
      reliabilityLabel: "规则解析",
    });
  }

  return summaries.slice(0, DEFAULT_PAPER_IDEA_LIMIT);
}

export function buildLlmPaperStrategySummary(insights: PaperInsightsLlm): PaperStrategySummary {
  const { strategySummary } = insights;
  const evidenceChain = uniqueNonReported(strategySummary.evidenceChain);
  const limitations = uniqueNonReported(strategySummary.limitations);

  return {
    overallStrategy: strategySummary.overallStrategy || DISPLAY_NOT_REPORTED,
    whyPublishable: strategySummary.whyPublishable || DISPLAY_NOT_REPORTED,
    coreInnovation: strategySummary.coreInnovation || DISPLAY_NOT_REPORTED,
    evidenceChain: evidenceChain.length > 0 ? evidenceChain : [DISPLAY_NOT_REPORTED],
    limitations: limitations.length > 0 ? limitations : [DISPLAY_NOT_REPORTED],
  };
}

export function buildLlmPaperModeIdeas(
  seedPaper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
  insights: PaperInsightsLlm,
): AnalyzeIdea[] {
  const priorityByPath = new Map<TechnologyTransferPath, "高" | "中" | "低">(
    insights.transferPaths.map((item) => [item.path, item.priority]),
  );

  const ideas = insights.ideas.map((draft, index) => {
    const ideaType = mapTransferPathToIdeaType(draft.path);
    const priority = priorityByPath.get(draft.path) ?? "中";
    const evaluation = evaluateGeneEditingIdea({
      title: draft.title,
      summary: draft.innovationLogic,
      suggestedIdeaType: ideaType,
      sourcePaperContext: { paper: seedPaper, extraction },
    });
    const localizedEvaluation = getLocalizedEvaluationCopy(evaluation, toSyntheticRadarPaper(seedPaper));
    const adjustedScores = applyPriorityAdjustments(evaluation, priority, draft.title);
    const suggestedJournalTier = toZhJournalTier(
      selectJournalTierFromScores(
        adjustedScores.novelty,
        adjustedScores.feasibility,
        adjustedScores.publicationPotential,
        adjustedScores.competitionRisk,
      ),
    );
    const minimumExperimentPackage =
      draft.minimumExperimentPackage.length > 0
        ? uniqueNonReported(draft.minimumExperimentPackage)
        : localizedEvaluation.minimumExperimentalPackage;
    const riskWarnings = uniqueNonReported([
      ...(priority === "低" ? ["当前方向更接近技术验证，需避免仅重复原论文场景。"] : []),
      ...draft.riskWarnings,
      ...(evaluation.isIncremental ? ["若只完成单靶点验证，容易被评价为低创新增量研究。"] : []),
    ]);

    return {
      id: `paper-mode-idea-llm-${index + 1}-${slugify(draft.path)}`,
      name: draft.title,
      innovationType: toZhIdeaType(ideaType),
      transferPath: transferPathLabelMap[draft.path],
      priority,
      basedOnPapers: [seedPaper.title],
      innovationLogic: draft.innovationLogic,
      feasibilityRisk: riskWarnings[0] ?? DISPLAY_NOT_REPORTED,
      feasibilityRationale: draft.feasibilityRationale || DISPLAY_NOT_REPORTED,
      minimumExperimentalPackage: minimumExperimentPackage,
      minimumExperimentPackage,
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
      riskWarnings,
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
