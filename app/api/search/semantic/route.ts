import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { llmEmbedding, llmChat } from "@/lib/llm";

/**
 * 语义搜索与 RAG (检索增强生成) API
 * 
 * 1. 将用户查询向量化
 * 2. 在数据库中进行向量相似度搜索 (pgvector)
 * 3. 将最相关的文献摘要作为上下文，调用 LLM 生成回答
 */
export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "查询内容不能为空" }, { status: 400 });
    }

    // 1. 向量化用户查询
    const queryVector = await llmEmbedding(query);
    if (!queryVector) {
      return NextResponse.json({ 
        error: "无法生成查询向量，请检查 LLM 配置",
        answer: "抱歉，由于无法生成查询向量，目前无法进行语义搜索。请检查 LLM API 配置。"
      }, { status: 500 });
    }

    // 2. 执行向量检索 (pgvector)
    // 注意：Prisma 不原生支持 vector 类型查询，必须使用原始 SQL
    const papers: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        id, title, abstract, journal, "authorsText", "publishedAt", "sourceUrl", "signalScore",
        1 - (embedding <=> $1::vector) AS similarity
      FROM "LiteraturePaper"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 8
    `, queryVector);

    // 3. 构建 RAG 回答
    let answer = null;
    if (papers.length > 0) {
      const context = papers
        .map((p, i) => `[文献 ${i + 1}] 标题: ${p.title}\n摘要: ${p.abstract}`)
        .join("\n\n");

      const systemPrompt = `你是一个资深的基因编辑研究助手。
请根据提供的 [文献上下文] 回答用户的 [问题]。

要求：
1. 仅依据提供的上下文回答，不要编造事实。
2. 如果上下文中没有相关信息，请明确告知。
3. 在回答中使用 [1], [2] 这种形式进行文献引用。
4. 使用中文回答，保持专业、准确的语气。`;

      const userPrompt = `[问题]: ${query}\n\n[文献上下文]:\n${context}`;

      answer = await llmChat({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.3,
      });
    } else {
      answer = "在当前数据库中未找到相关的基因编辑文献。你可以尝试调整关键词或等待系统抓取更多最新文献。";
    }

    return NextResponse.json({
      papers: papers.map(p => ({
        ...p,
        // 将 similarity 转换为 0-100 的分数
        relevanceScore: Math.round(p.similarity * 100)
      })),
      answer
    });

  } catch (error) {
    console.error("[Semantic Search API Error]:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
