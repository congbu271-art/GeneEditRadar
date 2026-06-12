import { average, formatDate as formatUtilDate } from "@/lib/utils";
import { isLlmEnabled, llmJson } from "@/lib/llm";
import { z } from "zod";
import type { SemanticScholarCitation } from "@/lib/semantic-scholar";
import { geneTargets, journals, papers, topics, type RadarPaper } from "@/lib/mock-data";
import {
  NOT_REPORTED,
  buildExtractionSourceFromRadarPaper,
  extractGeneEditingDetailsRuleBased,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";

export const RESEARCH_IDEA_TYPES = [
  "tool transfer",
  "organism transfer",
  "delivery optimization",
  "editor optimization",
  "trait application",
  "off-target reduction",
] as const;

export type ResearchIdeaType = (typeof RESEARCH_IDEA_TYPES)[number];

export type EvolutionAnalysis = {
  establishedPaths: string[];
  identifiedGaps: string[];
  innovationPathSummary: string;
};

export type GeneratedResearchIdea = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  customer: string;
  wedge: string;
  moat: string;
  risk: string;
  stage: "High priority" | "Promising" | "Speculative";
  score: number;
  paperId: string;
  topicSlug?: string;
  ideaType: ResearchIdeaType;
  articleTypeHint: string;
  journalTierHint: string;
  minimumExperimentalPackage: string[];
  additionalExperiments: string[];
  classification: string;
  evolutionAnalysis?: EvolutionAnalysis;
};

export type IdeaSeedPaper = {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  publishedAt?: string;
  doi?: string;
  modality: string;
  diseaseArea: string;
  stage: "Preclinical" | "Clinical" | "Platform";
  compositeScore?: number;
  journalSlug: string;
  geneSymbols: string[];
  topicSlugs: string[];
  organisms: string[];
  editorTypes: string[];
};

export type IdeaSourceContext = {
  paper: IdeaSeedPaper;
  extraction: GeneEditingExtraction;
};

export type GeneEditingIdeaSubmission = {
  title: string;
  summary: string;
  sourcePaperId?: string;
  suggestedIdeaType?: ResearchIdeaType;
  sourcePaperContext?: IdeaSourceContext;
};

export type GeneEditingIdeaEvaluation = {
  primaryIdeaType: ResearchIdeaType;
  classification: string;
  novelty: number;
  feasibility: number;
  publicationPotential: number;
  competitionRisk: number;
  overallScore: number;
  articleType: string;
  minimumExperimentalPackage: string[];
  additionalExperiments: string[];
  journalTier: string;
  isIncremental: boolean;
  warning?: string;
  rationale: string[];
};

const researchIdeaWithEvolutionSchema = z.object({
  evolutionAnalysis: z.object({
    establishedPaths: z.array(z.string()),
    identifiedGaps: z.array(z.string()),
    innovationPathSummary: z.string(),
  }),
  ideas: z.array(z.object({
    title: z.string(),
    thesis: z.string(),
    ideaType: z.enum(RESEARCH_IDEA_TYPES),
    score: z.number().min(0).max(100),
    articleTypeHint: z.string(),
    journalTierHint: z.string(),
    minimumExperimentalPackage: z.array(z.string()),
    additionalExperiments: z.array(z.string()),
    customer: z.string(),
    risk: z.string(),
    moat: z.string(),
  }))
});

/**
 * 基于引文演进生成科研课题
 */
export async function generateResearchIdeasWithCitations(
  paper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
  citations: SemanticScholarCitation[]
): Promise<GeneratedResearchIdea[]> {
  if (!isLlmEnabled()) {
    // 如果 LLM 未启用，回退到规则生成
    return generateIdeasForSeedPaper(paper, extraction);
  }

  const citationContext = citations.map((c, i) => 
    `[引用 ${i+1}] 标题: ${c.title}\n年份: ${c.year}\n影响力: ${c.isInfluential ? '高' : '一般'}\n摘要: ${c.abstract}`
  ).join("\n\n");

  const systemPrompt = `你是一个资深的“风险科学家”和基因编辑技术情报专家。
你的任务是根据一篇 [种子文献] 及其 [后续引用文献列表]，分析该技术的演进路线，并推演未来的蓝海科研方向。

**核心演进与迁移法则 (严格遵守)：**
1. **跨界法则：** 基因编辑技术（如 PE、BE、靶向递送等）通常首先在动物/哺乳动物细胞中验证。随后会向植物（尤其是模式植物如水稻、拟南芥）迁移。极少有技术从植物反向迁移回动物。
2. **植物界内法则：** 在植物中，技术验证通常遵循：模式植物（水稻、拟南芥） -> 易转化作物（番茄） -> 难转化/重要经济作物（大豆、高粱、玉米、丹参等）。
3. **推演逻辑：** 衍生选题应该顺应这个迁移方向，例如：如果文献在水稻中做了 PE，下一步应该是去大豆或高粱中做；如果文献在动物中做了新工具，下一步是向水稻等模式植物迁移。

第一步：技术演进分析 (Evolution Analysis)
- 识别出同行已经在哪些方向（Paths）进行了深度探索（如：物种迁移、载体优化等）。
- 识别出目前的文献网络中尚未覆盖或提到但未解决的空白点（Gaps），特别是尚未跨越的物种壁垒。

第二步：课题推演 (Idea Generation)
- 基于识别出的空白点，生成 3 个具有高学术价值和转化潜力的衍生研究课题。
- 确保课题顺应上述的“核心演进与迁移法则”，是合乎逻辑的“下一跳”。

**格式要求：**
- 所有的文字输出（包括 title, thesis, customer, risk, moat，实验包等）**必须完全使用中文**。
- 请输出 JSON 格式。`;

  const userPrompt = `[种子文献]:
标题: ${paper.title}
摘要: ${paper.abstract}
工具: ${extraction.editingTool}
物种: ${extraction.organism}

[后续引用文献列表]:
${citationContext || "暂无引用数据，请基于种子文献本身的局限性进行推演。"}

请基于以上数据，完成演进分析并生成 3 个新颖课题。务必全部使用中文输出。`;

  const parsed = await llmJson({
    system: systemPrompt,
    user: userPrompt,
    schema: researchIdeaWithEvolutionSchema,
    maxTokens: 3000,
    timeoutMs: 30000,
  });

  if (!parsed) {
    return generateIdeasForSeedPaper(paper, extraction);
  }

  return parsed.ideas.map((item: any, index: number) => {
    const slug = slugify(`${paper.slug}-${item.ideaType}-${index}`);
    return {
      id: `idea-evolution-${slug}`,
      slug,
      ...item,
      paperId: paper.id,
      stage: item.score >= 84 ? "High priority" : item.score >= 72 ? "Promising" : "Speculative",
      classification: formatIdeaTypeLabel(item.ideaType),
      evolutionAnalysis: parsed.evolutionAnalysis,
      wedge: item.minimumExperimentalPackage[0],
    };
  });
}

const DEFAULT_IDEA_TYPE_PRIORITY: ResearchIdeaType[] = [
  "tool transfer",
  "delivery optimization",
  "editor optimization",
  "trait application",
  "organism transfer",
  "off-target reduction",
];

const paperById = new Map(papers.map((paper) => [paper.id, paper]));
const paperExtractionById = new Map<string, GeneEditingExtraction>(
  papers.map((paper) => [paper.id, extractGeneEditingDetailsRuleBased(buildExtractionSourceFromRadarPaper(paper))]),
);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function countMatches(text: string, values: string[]) {
  return values.reduce((count, value) => count + (text.includes(value) ? 1 : 0), 0);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNegatedMention(text: string, value: string) {
  const pattern = new RegExp(`(?:without|no)\\s+(?:[a-z]+\\s+){0,5}${escapeRegex(value)}`);
  return pattern.test(text);
}

function containsPositiveAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value) && !isNegatedMention(text, value));
}

function countPositiveMatches(text: string, values: string[]) {
  return values.reduce((count, value) => count + (text.includes(value) && !isNegatedMention(text, value) ? 1 : 0), 0);
}

function formatIdeaTypeLabel(value: ResearchIdeaType) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSourcePaperContext(sourcePaperId?: string, explicitContext?: IdeaSourceContext) {
  if (explicitContext) {
    return explicitContext;
  }

  if (!sourcePaperId) {
    return undefined;
  }

  const paper = paperById.get(sourcePaperId);
  const extraction = paperExtractionById.get(sourcePaperId);

  if (!paper || !extraction) {
    return undefined;
  }

  return { paper, extraction };
}

function getPaperTopicSlug(paper: IdeaSeedPaper) {
  return paper.topicSlugs[0];
}

function getPaperJournalName(paper: IdeaSeedPaper) {
  return journals.find((journal) => journal.slug === paper.journalSlug)?.name ?? paper.journalSlug;
}

function getOrganismTransferTarget(paper: IdeaSeedPaper) {
  if (paper.organisms.includes("Primate")) {
    return "human hepatocyte organoids and repeat-dose liver models";
  }

  if (paper.organisms.includes("Human")) {
    return "non-human primate and humanized validation models";
  }

  if (paper.organisms.includes("Canine") || paper.organisms.includes("Rodent")) {
    return "large-animal ocular models with surgical dosing realism";
  }

  if (paper.organisms.includes("Mouse")) {
    return "humanized or patient-derived follow-up systems";
  }

  return "a new translational organism context";
}

function getAdjacentTrait(paper: IdeaSeedPaper) {
  if (paper.geneSymbols.includes("PCSK9")) {
    return "adjacent liver-secreted cardiometabolic targets";
  }

  if (paper.geneSymbols.includes("HBB")) {
    return "other hemoglobinopathy correction programs";
  }

  if (paper.geneSymbols.includes("TRAC")) {
    return "other persistence-limited solid-tumor cell therapies";
  }

  if (paper.geneSymbols.includes("RPE65")) {
    return "other inherited retinal degeneration traits";
  }

  if (paper.geneSymbols.includes("TP53")) {
    return "new oncology synthetic-lethal target hypotheses";
  }

  return `adjacent ${paper.diseaseArea.toLowerCase()} traits`;
}

function getDeliveryOptimizationFocus(deliveryMethod: string, paper: IdeaSeedPaper) {
  if (/lnp/i.test(deliveryMethod)) {
    return "repeat-dosing tolerance and extrahepatic selectivity";
  }

  if (/aav/i.test(deliveryMethod)) {
    return "capsid dose-sparing and localized biodistribution";
  }

  if (/subretinal/i.test(deliveryMethod)) {
    return "surgical dosing consistency and retinal spread control";
  }

  if (/ex vivo/i.test(deliveryMethod)) {
    return "manufacturing speed and cell-state preservation";
  }

  if (/in vivo/i.test(deliveryMethod)) {
    return "tissue-selective exposure and durability";
  }

  return `${paper.diseaseArea.toLowerCase()}-relevant delivery tuning`;
}

function getEditorOptimizationFocus(editingTool: string, paper: IdeaSeedPaper) {
  if (/prime/i.test(editingTool)) {
    return "pegRNA architecture and payload compaction";
  }

  if (/adenine/i.test(editingTool) || /base/i.test(editingTool)) {
    return "editing-window control and specificity";
  }

  if (/screen/i.test(editingTool)) {
    return "library design precision and perturbation depth";
  }

  if (/crispr/i.test(editingTool)) {
    return "guide architecture and expression timing";
  }

  return `${paper.diseaseArea.toLowerCase()}-fit editor performance`;
}

function getArticleTypeForIdeaType(ideaType: ResearchIdeaType) {
  switch (ideaType) {
    case "tool transfer":
      return "proof-of-concept transfer article";
    case "organism transfer":
      return "translational organism-transfer study";
    case "delivery optimization":
      return "delivery optimization article";
    case "editor optimization":
      return "editor engineering or methods paper";
    case "trait application":
      return "disease-application research article";
    case "off-target reduction":
      return "safety and specificity methods article";
  }
}

function getPackageForIdeaType(
  ideaType: ResearchIdeaType,
  paper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
) {
  const gene = extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : paper.geneSymbols.join(", ");
  const journalName = getPaperJournalName(paper);

  switch (ideaType) {
    case "tool transfer":
      return {
        minimumExperimentalPackage: [
          `在 ${gene} 之外的第二个靶点上重建 ${extraction.editingType.toLowerCase()} 流程。`,
          `在新的迁移体系中展示一致的在靶编辑效率与相关功能读出。`,
          `以原 ${journalName} 论文条件为基准评估工具的可移植性。`,
        ],
        additionalExperiments: [
          "在至少两个时间点增加持久性测量。",
          "在新环境中进行脱靶或转录组安全性分析。",
          "与更简单的基线编辑器或递送系统比较迁移表现。",
        ],
      };
    case "organism transfer":
      return {
        minimumExperimentalPackage: [
          `在 ${getOrganismTransferTarget(paper)} 中复现核心的 ${paper.diseaseArea.toLowerCase()} 编辑。`,
          "在新的物种系统中测量编辑效率、表型恢复与体内暴露量。",
          "通过匹配的 guide 与剂量对照来跨越物种迁移的鸿沟。",
        ],
        additionalExperiments: [
          "如果新模型支持，增加重复给药或纵向随访。",
          "比较不同物种间的免疫激活或炎症负担。",
          "使用正交分子验证来确认任何表型信号的转移。",
        ],
      };
    case "delivery optimization":
      return {
        minimumExperimentalPackage: [
          `针对 ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)} 优化 ${extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : paper.modality} 递送。`,
          "同步量化生物分布、编辑效率与功能表型。",
          "以原论文给药条件为基准评估优化后的递送方案。",
        ],
        additionalExperiments: [
          "压力测试重复给药或二次给药的兼容性。",
          "增加有效载荷完整性与组织特异性表达测量。",
          "与临床常见的递送对照比较安全性指标。",
        ],
      };
    case "editor optimization":
      return {
        minimumExperimentalPackage: [
          `围绕 ${getEditorOptimizationFocus(extraction.editingTool, paper)} 重新设计 ${extraction.editingTool}。`,
          "在主要模型中测量编辑纯度、在靶效率与表型效应。",
          "将优化后的编辑器与原始配置进行直接 head-to-head 比较。",
        ],
        additionalExperiments: [
          "分析编辑窗口或旁观者编辑结果。",
          "增加表达动力学或载荷大小的测量。",
          "测试优化后的编辑器在较低剂量下是否能保持疗效。",
        ],
      };
    case "trait application":
      return {
        minimumExperimentalPackage: [
          `将同一平台应用于 ${getAdjacentTrait(paper)} 并明确界定表型终点。`,
          "展示在靶编辑以及与疾病相关的表型恢复或抑制读出。",
          "包含与原始性状背景或目标类别的直接对照。",
        ],
        additionalExperiments: [
          "围绕新性状增加剂量反应或 guide 筛选。",
          "在临床相关的情况下测量持久性与可逆性。",
          "进行针对新疾病背景的安全性分析。",
        ],
      };
    case "off-target reduction":
      return {
        minimumExperimentalPackage: [
          `通过 guide、载荷或表达时机控制，构建风险降低版的 ${extraction.editingTool} 流程。`,
          "同步测量在靶编辑与脱靶、炎症或生物分布读出。",
          "证明特异性的提升并没有抹杀表型信号。",
        ],
        additionalExperiments: [
          "增加正交脱靶确认（如靶向深度测序或无偏倚分析）。",
          "比较瞬时与持续的编辑器暴露差异。",
          "在第二个 guide 或靶点背景中测试特异性策略。",
        ],
      };
  }

}

function selectIdeaTypesForPaper(paper: IdeaSeedPaper, extraction: GeneEditingExtraction) {
  const selected: ResearchIdeaType[] = ["tool transfer"];

  if (extraction.organism !== NOT_REPORTED && !selected.includes("organism transfer")) {
    selected.push("organism transfer");
  }

  if (extraction.deliveryMethod !== NOT_REPORTED && !selected.includes("delivery optimization")) {
    selected.push("delivery optimization");
  }

  if (extraction.editingTool !== NOT_REPORTED && !selected.includes("editor optimization")) {
    selected.push("editor optimization");
  }

  if ((extraction.targetTrait !== NOT_REPORTED || paper.diseaseArea) && !selected.includes("trait application")) {
    selected.push("trait application");
  }

  if (
    (extraction.offTargetAnalysis !== NOT_REPORTED || /off-target|inflammation|biodistribution/i.test(paper.abstract)) &&
    !selected.includes("off-target reduction")
  ) {
    selected.push("off-target reduction");
  }

  for (const ideaType of DEFAULT_IDEA_TYPE_PRIORITY) {
    if (!selected.includes(ideaType)) {
      selected.push(ideaType);
    }

    if (selected.length >= 4) {
      break;
    }
  }

  return selected.slice(0, 5);
}

function buildIdeaDraft(paper: IdeaSeedPaper, extraction: GeneEditingExtraction, ideaType: ResearchIdeaType) {
  const gene = extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : paper.geneSymbols.join(", ");
  const tool = extraction.editingTool !== NOT_REPORTED ? extraction.editingTool : extraction.editingType;
  const delivery = extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : paper.modality;
  const trait = extraction.targetTrait !== NOT_REPORTED ? extraction.targetTrait : paper.diseaseArea;
  const topic = topics.find((item) => item.slug === getPaperTopicSlug(paper));
  const articleTypeHint = getArticleTypeForIdeaType(ideaType);
  const packagePlan = getPackageForIdeaType(ideaType, paper, extraction);

  switch (ideaType) {
    case "tool transfer":
      return {
        title: `将 ${tool} 从 ${gene} 迁移至 ${getAdjacentTrait(paper)}`,
        thesis: `利用原论文的 ${delivery} 策略，测试同一 ${tool} 架构是否能在 ${getAdjacentTrait(paper)} 中解锁具有发表价值的编辑表现，而不是局限于 ${trait.toLowerCase()}。`,
        customer: "最匹配团队：拥有成熟的原型分析方法和相邻疾病模型的转化编辑实验室。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：可移植性将证明原论文的核心进展是一个可复用的平台级突破，而非单靶点的偶然发现。",
        risk: "主要风险：编辑效果可能更多地依赖于特定组织环境，而不是迁移后的编辑架构。",
        topicSlug: topic?.slug,
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "organism transfer":
      return {
        title: `将 ${gene} 编辑引入 ${getOrganismTransferTarget(paper)}`,
        thesis: `将该论文的编辑逻辑从 ${paper.organisms.join(", ").toLowerCase()} 模型迁移到 ${getOrganismTransferTarget(paper)}，以验证其生物学和递送逻辑能否承受更难的物种跨越。`,
        customer: "最匹配团队：已经掌握原始模型，并具备更高阶（如大动物/作物）验证体系的团队。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：物种迁移通常是将精妙的编辑化学转化为具有真正转化价值的论文的最清晰路径。",
        risk: "主要风险：在物种升级过程中，剂量、免疫反应或组织屏障可能导致编辑性能崩溃。",
        topicSlug: topic?.slug,
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "delivery optimization":
      return {
        title: `针对 ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)} 优化 ${delivery}`,
        thesis: `采用原论文的递送框架，通过改进 ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)} 同时保持相同的编辑与表型信号，使其成为一篇独立的方法学突破文章。`,
        customer: "最匹配团队：能够快速迭代配方、生物分布分析和表型读出的递送工程实验室。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：如果编辑信号与剂量、持久性或安全性直接相关，递送方案的改进往往能最快催生后续的高质量论文。",
        risk: "主要风险：更好的体内暴露指标未必能转化为实质性增强的表型结果。",
        topicSlug: topic?.slug ?? "delivery",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "editor optimization":
      return {
        title: `为 ${gene} 改造更敏锐的 ${tool}`,
        thesis: `围绕 ${getEditorOptimizationFocus(extraction.editingTool, paper)} 构建一篇编辑器优化论文，使该研究贡献一种性能更好的编辑化学反应，而不仅仅是重复原始表型。`,
        customer: "最匹配团队：具有快速载体构建周期并能直接访问原始表型分析的编辑器工程团队。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：如果特异性或有效载荷优势确凿，以编辑器为中心的改进可以推广到更多靶点。",
        risk: "主要风险：编辑器的性能提升可能太小或过于依赖特定背景，难以作为独立贡献通过同行评审。",
        topicSlug: topic?.slug ?? "base-editing",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "trait application":
      return {
        title: `将 ${tool} 应用于 ${getAdjacentTrait(paper)}`,
        thesis: `以该论文为起点，开展新的性状应用研究，保留核心编辑模式，但将实验终点转向 ${getAdjacentTrait(paper)} 和新的表型。`,
        customer: "最匹配团队：希望在相邻适应症中快速重用已验证编辑化学反应的疾病或农学实验室。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：强大的性状迁移论文无需发明全新的平台，即可在新的疾病/农艺方向上建立据点。",
        risk: "主要风险：除非表型或模型升级真正具有差异化，否则该思路容易被视为缺乏创新的 me-too 研究。",
        topicSlug: topic?.slug ?? "rare-disease",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "off-target reduction":
      return {
        title: `降低 ${tool} 在 ${gene} 编辑中的脱靶负担`,
        thesis: `通过重新设计围绕降低脱靶或炎症负担的工作流，同时保持主要的在靶编辑和表型信号完好无损，将原始论文转化为更强的安全性故事。`,
        customer: "最匹配团队：注重安全性的转化实验室，能够将编辑分析与正交的特异性评估相结合。",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "核心价值：可靠的特异性提升不仅能提高文章发表质量，还能同时创造实际的临床/田间应用理由。",
        risk: "主要风险：安全性的改善可能是以牺牲过多的编辑效率为代价，导致无法支撑一篇有说服力的文章。",
        topicSlug: topic?.slug ?? "delivery",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
  }
}

export function classifyGeneEditingIdea(
  submission: Pick<GeneEditingIdeaSubmission, "title" | "summary" | "suggestedIdeaType">,
): ResearchIdeaType {
  if (submission.suggestedIdeaType) {
    return submission.suggestedIdeaType;
  }

  const text = normalizeText(`${submission.title} ${submission.summary}`);

  if (
    containsAny(text, ["same model", "same delivery", "same editor", "benchmark"]) &&
    containsAny(text, ["optimize", "optimization", "improve", "improvement", "tune", "tuning"])
  ) {
    return containsAny(text, ["delivery", "lnp", "aav", "capsid", "tropism", "biodistribution"])
      ? "delivery optimization"
      : "editor optimization";
  }

  const scores = new Map<ResearchIdeaType, number>(
    RESEARCH_IDEA_TYPES.map((ideaType) => [ideaType, 0]),
  );

  scores.set(
    "off-target reduction",
    countPositiveMatches(text, ["off target", "specificity", "guide", "reduced risk", "inflammation", "biodistribution"]) * 3,
  );
  scores.set(
    "delivery optimization",
    countPositiveMatches(text, ["delivery", "lnp", "aav", "capsid", "tropism", "repeat dosing", "biodistribution"]) * 3,
  );
  scores.set(
    "organism transfer",
    countPositiveMatches(text, ["organism", "mouse", "mice", "primate", "canine", "humanized", "organoid", "large animal"]) * 3,
  );
  scores.set(
    "editor optimization",
    countPositiveMatches(text, ["editor", "peg", "deaminase", "base editor", "prime editor", "cas9", "cas12", "window"]) * 3,
  );
  scores.set(
    "trait application",
    countPositiveMatches(text, ["trait", "disease", "phenotype", "rescue", "tumor", "blindness", "anemia", "ldl"]) * 3,
  );
  scores.set(
    "tool transfer",
    countPositiveMatches(text, ["transfer", "port", "retarget", "apply to", "reuse", "translate", "cross tissue"]) * 3,
  );

  if (containsAny(text, ["transfer", "port", "reuse", "retarget"])) {
    scores.set("tool transfer", (scores.get("tool transfer") ?? 0) + 4);
  }

  if (containsAny(text, ["optimize", "optimization", "improve", "improvement", "tune", "tuning"])) {
    scores.set("delivery optimization", (scores.get("delivery optimization") ?? 0) + 2);
    scores.set("editor optimization", (scores.get("editor optimization") ?? 0) + 2);
  }

  return [...scores.entries()].sort((left, right) => right[1] - left[1] || RESEARCH_IDEA_TYPES.indexOf(left[0]) - RESEARCH_IDEA_TYPES.indexOf(right[0]))[0]?.[0] ?? "tool transfer";
}

function isIncrementalIdea(text: string, sourcePaper?: IdeaSeedPaper) {
  const incrementalMarkers = [
    "incremental",
    "minor",
    "slight",
    "benchmark",
    "replicate",
    "same model",
    "same editor",
    "same delivery",
  ];
  const noveltyMarkers = [
    "transfer",
    "port",
    "retarget",
    "new organism",
    "repeat dosing",
    "specificity",
    "off target",
    "humanized",
    "organoid",
    "durability",
    "biodistribution",
    "synthetic lethal",
  ];

  const sourceOverlap = sourcePaper
    ? [
        ...sourcePaper.geneSymbols.map((item) => item.toLowerCase()),
        ...sourcePaper.organisms.map((item) => item.toLowerCase()),
        ...sourcePaper.editorTypes.map((item) => item.toLowerCase()),
      ].filter((item) => text.includes(item)).length
    : 0;

  return (
    (containsAny(text, incrementalMarkers) && !containsPositiveAny(text, noveltyMarkers)) ||
    (sourceOverlap >= 3 && !containsPositiveAny(text, noveltyMarkers))
  );
}

function recommendJournalTier(
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

export function evaluateGeneEditingIdea(submission: GeneEditingIdeaSubmission): GeneEditingIdeaEvaluation {
  const text = normalizeText(`${submission.title} ${submission.summary}`);
  const sourceContext = getSourcePaperContext(submission.sourcePaperId, submission.sourcePaperContext);
  const primaryIdeaType = classifyGeneEditingIdea(submission);
  const sourcePaper = sourceContext?.paper;
  const sourceExtraction = sourceContext?.extraction;
  const incremental = isIncrementalIdea(text, sourcePaper);

  let novelty = 52;
  novelty +=
    {
      "tool transfer": 18,
      "organism transfer": 17,
      "delivery optimization": 10,
      "editor optimization": 12,
      "trait application": 11,
      "off-target reduction": 16,
    }[primaryIdeaType];
  novelty += countMatches(text, ["humanized", "organoid", "repeat dosing", "biodistribution", "durability", "specificity"]) * 4;
  novelty += containsAny(text, ["synthetic lethal", "solid tumor", "retina", "primate", "canine"]) ? 6 : 0;
  novelty -= incremental ? 22 : 0;

  let feasibility = 54;
  feasibility += sourcePaper ? 8 : 0;
  feasibility += containsAny(text, ["mouse", "rodent", "organoid", "ex vivo", "cell"]) ? 12 : 0;
  feasibility += containsAny(text, ["lnp", "aav", "subretinal", "electroporation"]) ? 8 : 0;
  feasibility +=
    primaryIdeaType === "delivery optimization" || primaryIdeaType === "editor optimization" || primaryIdeaType === "off-target reduction"
      ? 10
      : 0;
  feasibility -= containsAny(text, ["primate", "first in human", "clinical", "allogeneic", "multiplex"]) ? 8 : 0;
  feasibility -= primaryIdeaType === "organism transfer" ? 4 : 0;
  feasibility += incremental ? 4 : 0;

  let publicationPotential = 55;
  publicationPotential += containsAny(text, ["phenotype", "rescue", "durability", "tumor control", "visual function", "anemia", "ldl"]) ? 12 : 0;
  publicationPotential += containsAny(text, ["off target", "specificity", "biodistribution", "inflammation"]) ? 10 : 0;
  publicationPotential += containsAny(text, ["mouse", "primate", "canine", "large animal", "humanized", "organoid"]) ? 8 : 0;
  publicationPotential += sourcePaper?.compositeScore !== undefined && sourcePaper.compositeScore >= 88 ? 6 : 0;
  publicationPotential += primaryIdeaType === "organism transfer" || primaryIdeaType === "trait application" ? 6 : 0;
  publicationPotential -= incremental ? 14 : 0;

  let competitionRisk = 40;
  competitionRisk += countMatches(text, ["pcsk9", "hbb", "prime editing", "base editing", "lnp", "crispr"]) * 4;
  competitionRisk += primaryIdeaType === "delivery optimization" || primaryIdeaType === "trait application" ? 8 : 0;
  competitionRisk -= primaryIdeaType === "off-target reduction" || primaryIdeaType === "organism transfer" ? 6 : 0;
  competitionRisk -= containsAny(text, ["retina", "canine", "organoid", "synthetic lethal", "repeat dosing"]) ? 6 : 0;
  competitionRisk += incremental ? 18 : 0;

  const articleType = getArticleTypeForIdeaType(primaryIdeaType);
  const packagePlan =
    sourcePaper && sourceExtraction
      ? getPackageForIdeaType(primaryIdeaType, sourcePaper, sourceExtraction)
      : {
          minimumExperimentalPackage: [
            "Show on-target editing in a tractable primary model.",
            "Add one disease- or trait-relevant functional readout.",
            "Benchmark against a sensible baseline workflow.",
          ],
          additionalExperiments: [
            "Add orthogonal safety or off-target measurements.",
            "Measure durability or dose-response where relevant.",
            "Validate the finding in a second model or guide context.",
          ],
        };

  novelty = clamp(novelty);
  feasibility = clamp(feasibility);
  publicationPotential = clamp(publicationPotential);
  competitionRisk = clamp(competitionRisk);

  const overallScore = clamp(
    novelty * 0.3 + feasibility * 0.3 + publicationPotential * 0.25 + (100 - competitionRisk) * 0.15,
  );

  const rationale: string[] = [];

  if (sourcePaper) {
    rationale.push(`Anchored to ${sourcePaper.title}.`);
  }

  if (primaryIdeaType === "organism transfer" || primaryIdeaType === "tool transfer") {
    rationale.push("The proposal introduces a transfer step beyond the original paper context.");
  }

  if (containsAny(text, ["off target", "specificity", "biodistribution", "inflammation"])) {
    rationale.push("Safety or specificity language improves paperability and translational framing.");
  }

  if (containsAny(text, ["phenotype", "rescue", "durability", "tumor", "visual function", "anemia", "ldl"])) {
    rationale.push("A visible phenotype endpoint supports publication potential.");
  }

  if (incremental) {
    rationale.push("The idea still overlaps heavily with the source context and needs a sharper differentiator.");
  }

  const warning = incremental
    ? "Too incremental right now. Add a new organism, stronger safety angle, or a clearly different phenotype package."
    : overallScore < 65
      ? "The scope is still fuzzy. Tighten the experimental wedge before treating this as a strong paper concept."
      : undefined;

  return {
    primaryIdeaType,
    classification: formatIdeaTypeLabel(primaryIdeaType),
    novelty,
    feasibility,
    publicationPotential,
    competitionRisk,
    overallScore,
    articleType,
    minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
    additionalExperiments: packagePlan.additionalExperiments,
    journalTier: recommendJournalTier(novelty, feasibility, publicationPotential, competitionRisk),
    isIncremental: incremental,
    warning,
    rationale,
  };
}

export function generateIdeasForSeedPaper(paper: IdeaSeedPaper, extraction: GeneEditingExtraction): GeneratedResearchIdea[] {
  return selectIdeaTypesForPaper(paper, extraction).map((ideaType) => {
    const draft = buildIdeaDraft(paper, extraction, ideaType);
    const evaluation = evaluateGeneEditingIdea({
      title: draft.title,
      summary: draft.thesis,
      sourcePaperId: paper.id,
      sourcePaperContext: { paper, extraction },
      suggestedIdeaType: ideaType,
    });
    const slug = slugify(`${paper.slug}-${ideaType}`);

    return {
      id: `idea-${slug}`,
      slug,
      title: draft.title,
      thesis: draft.thesis,
      customer: draft.customer,
      wedge: draft.wedge,
      moat: draft.moat,
      risk: draft.risk,
      stage:
        evaluation.overallScore >= 84
          ? "High priority"
          : evaluation.overallScore >= 72
            ? "Promising"
            : "Speculative",
      score: evaluation.overallScore,
      paperId: paper.id,
      topicSlug: draft.topicSlug,
      ideaType,
      articleTypeHint: draft.articleTypeHint,
      journalTierHint: evaluation.journalTier,
      minimumExperimentalPackage: evaluation.minimumExperimentalPackage,
      additionalExperiments: evaluation.additionalExperiments,
      classification: evaluation.classification,
    };
  });
}

export function generateIdeasForPaper(paper: RadarPaper): GeneratedResearchIdea[] {
  const extraction = paperExtractionById.get(paper.id)!;

  return generateIdeasForSeedPaper(paper, extraction);
}

export function generateResearchIdeas(seedPapers: RadarPaper[] = papers) {
  return seedPapers
    .flatMap((paper) => generateIdeasForPaper(paper))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

export const generatedResearchIdeas = generateResearchIdeas();

export function getResearchIdeaTypeSummary() {
  return RESEARCH_IDEA_TYPES.map((ideaType) => ({
    ideaType,
    label: formatIdeaTypeLabel(ideaType),
    count: generatedResearchIdeas.filter((idea) => idea.ideaType === ideaType).length,
  }));
}

export function getResearchIdeasPerPaper() {
  return papers.map((paper) => ({
    paperId: paper.id,
    paperTitle: paper.title,
    count: generatedResearchIdeas.filter((idea) => idea.paperId === paper.id).length,
  }));
}

export function getTargetHintForIdeaSummary(summary: string) {
  const normalized = normalizeText(summary);
  return geneTargets.find((target) => normalized.includes(target.symbol.toLowerCase()))?.symbol;
}
