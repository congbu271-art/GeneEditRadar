import "server-only";

import { z } from "zod";

import { isLlmEnabled, llmJson } from "@/lib/llm";
import type { SemanticScholarCitation } from "@/lib/semantic-scholar";
import {
  RESEARCH_IDEA_TYPES,
  generateIdeasForSeedPaper,
  slugify,
  formatIdeaTypeLabel,
  type GeneratedResearchIdea,
  type IdeaSeedPaper,
} from "@/lib/research-ideas";
import type { GeneEditingExtraction } from "@/lib/paper-extraction";

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
    return generateIdeasForSeedPaper(paper, extraction);
  }

  const citationContext = citations.map((c, i) =>
    `[引用 ${i+1}] 标题: ${c.title}\n年份: ${c.year}\n影响力: ${c.isInfluential ? '高' : '一般'}\n摘要: ${c.abstract}`
  ).join("\n\n");

  const systemPrompt = `你是一个资深的"风险科学家"和基因编辑技术情报专家。
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
- 确保课题顺应上述的"核心演进与迁移法则"，是合乎逻辑的"下一跳"。

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

  return parsed.ideas.map((item: z.infer<typeof researchIdeaWithEvolutionSchema>["ideas"][number], index: number) => {
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
