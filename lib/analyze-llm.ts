import "server-only";

import { z } from "zod";

import { isLlmEnabled, llmJson } from "@/lib/llm";
import type { AnalyzePaper, GeneEditingFeature, TechnologyTransferPath } from "@/lib/analyze-types";

/**
 * 分析级 LLM 编排：在配置了 LLM 时，基于真实检索到的文献摘要生成
 * （1）关键词模式的领域概览（进展 + 未解决问题）
 * （2）文献模式的策略解读 + 技术迁移路径 + 衍生课题草案
 *
 * 这里只负责「调用 LLM + 结构化校验」，返回原始结构化数据；
 * 四维评分、期刊层级等仍由 analyze.ts 复用现有规则函数完成。
 * 任何失败返回 null，由 analyze.ts 回退到规则引擎。
 */

const ANALYZE_NOT_REPORTED = "未报道";

// 与 analyze-types.ts 的 TechnologyTransferPath 保持一致（编译期下方做静态校验）。
const TRANSFER_PATH_VALUES = [
  "animal_to_plant",
  "mammalian_cell_to_plant",
  "monocot_to_dicot",
  "model_plant_to_crop",
  "crop_to_crop",
  "tool_to_trait",
  "single_target_to_multiplex",
  "efficiency_optimization",
  "delivery_optimization",
  "specificity_optimization",
] as const;

// 若 analyze-types 的枚举发生变化，此处会产生编译错误，提醒同步。
const _transferPathExhaustiveCheck: readonly TechnologyTransferPath[] = TRANSFER_PATH_VALUES;
void _transferPathExhaustiveCheck;

const transferPathEnum = z.enum(TRANSFER_PATH_VALUES);
const priorityEnum = z.enum(["高", "中", "低"]);

const ANTI_HALLUCINATION_RULES = [
  "只能基于提供的论文标题与摘要进行分析，禁止使用训练记忆中的任何外部论文、数据或结论。",
  "若某信息在提供内容中没有明确给出，相关字段填写「未报道」，禁止推测具体数值、编辑效率、物种或基因名。",
  "禁止编造论文标题、作者、DOI、期刊名或统计数字，只能引用输入中真实出现的论文。",
  "衍生课题属于研究假设，须使用「可考虑 / 有望 / 建议验证」等措辞，不得声称已被证明。",
  "只输出 JSON，不要包含任何解释性文字或 Markdown。",
].join("\n");

// ---------- 1. 关键词模式：领域概览 ----------

const fieldOverviewSchema = z.object({
  currentStatus: z.string(),
  mainTools: z.array(z.string()),
  mainOrganisms: z.array(z.string()),
  deliveries: z.array(z.string()),
  applications: z.array(z.string()),
  openProblems: z.array(z.string()),
});

export type FieldOverviewAnchors = {
  tools: string[];
  organisms: string[];
  deliveries: string[];
  applications: string[];
};

function joinOrNotReported(values: string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join("；") : ANALYZE_NOT_REPORTED;
}

/**
 * 基于真实检索文献用 LLM 生成领域概览，输出与规则版 buildFieldOverview 相同的多行中文字符串。
 * 未启用或失败返回 null。
 */
export async function buildFieldOverviewWithLlm(
  papers: AnalyzePaper[],
  _features: GeneEditingFeature[],
  anchors: FieldOverviewAnchors,
): Promise<string | null> {
  if (!isLlmEnabled() || papers.length === 0) {
    return null;
  }

  const corpus = papers.slice(0, 8).map((paper) => ({
    title: paper.title,
    journal: paper.journal,
    publishedAt: paper.publishedAt,
    abstract: paper.abstract && paper.abstract !== ANALYZE_NOT_REPORTED ? paper.abstract : "",
  }));

  const userPayload = JSON.stringify(
    {
      task: "总结该基因编辑研究方向的当前进展与尚未解决的问题。",
      ruleBasedAnchors: anchors, // 规则统计结果，作为锚点降低幻觉
      papers: corpus,
    },
    null,
    2,
  );

  const parsed = await llmJson({
    system:
      "你是基因编辑领域的资深综述专家。" +
      ANTI_HALLUCINATION_RULES +
      "\n输出 JSON，字段：currentStatus(字符串，概述当前研究状态), mainTools, mainOrganisms, deliveries, applications, openProblems(均为字符串数组)。" +
      "openProblems 必须由提供摘要中明确写到的局限或 future work 支撑，每条不超过 40 字。",
    user: userPayload,
    schema: fieldOverviewSchema,
    maxTokens: 900,
    timeoutMs: 25_000,
  });

  if (!parsed) {
    return null;
  }

  const lines = [
    `当前研究状态：${parsed.currentStatus.trim() || ANALYZE_NOT_REPORTED}`,
    `主要编辑工具：${joinOrNotReported(parsed.mainTools)}。`,
    `主要研究物种：${joinOrNotReported(parsed.mainOrganisms)}。`,
    `常见递送方式：${joinOrNotReported(parsed.deliveries)}。`,
    `已报道应用方向：${joinOrNotReported(parsed.applications)}。`,
    `潜在研究空白：${joinOrNotReported(parsed.openProblems)}。`,
  ];

  if (papers.length < 3) {
    lines.push(`提示：当前仅检索到 ${papers.length} 篇相关文献，领域概览稳定性有限。`);
  }

  return lines.join("\n");
}

// ---------- 2. 文献模式：策略解读 + 迁移路径 + 衍生课题 ----------

const paperInsightsSchema = z.object({
  strategySummary: z.object({
    overallStrategy: z.string(),
    whyPublishable: z.string(),
    coreInnovation: z.string(),
    evidenceChain: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  transferPaths: z
    .array(
      z.object({
        path: transferPathEnum,
        rationale: z.string(),
        priority: priorityEnum,
      }),
    )
    .min(1),
  ideas: z
    .array(
      z.object({
        path: transferPathEnum,
        title: z.string(),
        innovationLogic: z.string(),
        feasibilityRationale: z.string(),
        minimumExperimentPackage: z.array(z.string()),
        riskWarnings: z.array(z.string()),
      }),
    )
    .min(1),
});

export type PaperInsightsLlm = z.infer<typeof paperInsightsSchema>;

export type PaperInsightsInput = {
  seed: {
    title: string;
    abstract: string;
    journal: string;
    organisms: string[];
    editorTypes: string[];
  };
  extraction: Record<string, string>;
  relatedPapers: Array<{ title: string; abstract: string }>;
};

/**
 * 基于种子论文 + 抽取字段 + 相关文献，用 LLM 一次性产出策略解读、迁移路径与衍生课题草案。
 * path 受 enum 强约束，防止 LLM 造出前端无法识别的枚举。未启用或失败返回 null。
 */
export async function buildPaperInsightsWithLlm(input: PaperInsightsInput): Promise<PaperInsightsLlm | null> {
  if (!isLlmEnabled()) {
    return null;
  }

  const allowedPaths = TRANSFER_PATH_VALUES.join(", ");
  const userPayload = JSON.stringify(
    {
      task: "为这篇基因编辑论文判断最佳的衍生研究方向（例如把新技术迁移到植物应用或医学应用），并解读其策略。",
      seedPaper: input.seed,
      ruleBasedExtraction: input.extraction,
      relatedPapers: input.relatedPapers.slice(0, 6),
    },
    null,
    2,
  );

  return llmJson({
    system:
      "你是基因编辑领域的资深课题规划专家。" +
      ANTI_HALLUCINATION_RULES +
      `\ntransferPaths[].path 与 ideas[].path 只能取以下枚举之一：${allowedPaths}。` +
      "\n输出 JSON：strategySummary{overallStrategy, whyPublishable, coreInnovation, evidenceChain[], limitations[]}；" +
      "transferPaths[]{path, rationale, priority(高/中/低)}；" +
      "ideas[]{path, title, innovationLogic, feasibilityRationale, minimumExperimentPackage[], riskWarnings[]}。" +
      "至多给出 5 条 transferPaths 和 5 条 ideas，按优先级从高到低排列，优先考虑植物应用与医学应用等高价值跨体系迁移方向。",
    user: userPayload,
    schema: paperInsightsSchema,
    maxTokens: 2_000,
    timeoutMs: 30_000,
  });
}
