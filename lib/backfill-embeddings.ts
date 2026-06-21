import "server-only";

import { prisma } from "@/lib/prisma";
import { llmEmbedding } from "@/lib/llm";

/**
 * 为数据库中所有缺失向量的文献补全 Embedding。
 * 建议通过一个临时的 API Route 或脚本调用。
 */
export async function backfillEmbeddings() {
  console.log("Starting backfill for embeddings...");

  // Since embedding is an Unsupported type in Prisma, we query for papers needing it via raw SQL
  const papers: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, title, abstract 
    FROM "LiteraturePaper" 
    WHERE embedding IS NULL AND abstract != '' 
    LIMIT 50
  `);

  console.log(`Found ${papers.length} papers to process.`);

  let successCount = 0;

  for (const paper of papers) {
    const text = `${paper.title}\n${paper.abstract}`.slice(0, 8000);
    const vector = await llmEmbedding(text);

    if (vector) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "LiteraturePaper" SET embedding = $1::vector WHERE id = $2`,
          vector,
          paper.id
        );
        successCount++;
        console.log(`Successfully embedded paper: ${paper.id}`);
      } catch (e) {
        console.error(`Failed to update embedding for ${paper.id}:`, e);
      }
    }
    
    // 稍微停顿，避免触发 Embedding API 的 Rate Limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    processed: papers.length,
    success: successCount
  };
}
