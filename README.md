# GeneEditRadar MVP

GeneEditRadar is a polished MVP frontend for tracking gene-editing papers, turning them into venture-style insights, and pressure-testing startup ideas. It now includes live literature collection from PubMed, Europe PMC, and Crossref with a mock fallback mode when external APIs fail.

## What is included

- Next.js App Router structure with a shared route-group layout
- Tailwind CSS styling and shadcn/ui-style component setup
- Prisma schema for papers, journals, topics, gene targets, subscriptions, ideas, and evaluations
- Literature collection via PubMed E-utilities, Europe PMC, and Crossref
- Paper normalization plus deduplication by DOI, PMID, and normalized title
- Subscription matching by keywords, authors, journals, organisms, and editor types
- Netlify Scheduled Functions for persisted literature collection, RSS/TOC feed monitoring, subscription matching, and digest delivery bookkeeping when `DATABASE_URL` is configured
- Gene-editing-specific extraction for editing tool, editor variant, editing type, organism, delivery method, target gene, target trait, editing efficiency, off-target analysis, phenotype validation, main innovation, limitations, paper type, and follow-up opportunities
- Optional OpenAI-backed extraction refinement when `OPENAI_API_KEY` is set, with Zod validation and `"not reported"` fallback behavior for missing fields
- Rule-based follow-up idea generation with 3-5 research ideas per seed paper across tool transfer, organism transfer, delivery optimization, editor optimization, trait application, and off-target reduction
- Rule-based research idea evaluation for novelty, feasibility, publication potential, competition risk, article type, minimum experimental package, additional experiments, journal tier, and incremental-risk warnings
- Seeded mock gene-editing data reused across both the UI and the Prisma seed script as a fallback dataset
- MVP pages for `/dashboard`, `/papers`, `/paper/[id]`, `/subscriptions`, `/ideas`, `/evaluate`, and `/journals`
- Basic Node test runner coverage for mock data, UI rendering, deduplication, matching, and extraction
- Additional tests for idea generation, idea classification, and evaluation scoring

## Stack

- Next.js
- React
- Tailwind CSS
- shadcn/ui conventions
- Prisma
- Postgres for persisted subscription jobs
- Node test runner + `tsx`

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Generate the Prisma client and initialize the configured database schema:

```bash
pnpm prisma:generate
pnpm db:init
```

4. Seed the mock data:

```bash
pnpm prisma:seed
```

5. Start the app:

```bash
pnpm dev
```

6. Run tests:

```bash
pnpm test
```

## Project shape

```text
app/
  (radar)/
    dashboard/
    papers/
    paper/[id]/
    subscriptions/
    ideas/
    evaluate/
    journals/
components/
  ui/
lib/
prisma/
tests/
```

## Notes

- The UI currently reads from `lib/mock-data.ts` and derived selectors in `lib/radar-data.ts`.
- Live literature collection and subscription intelligence live in `lib/literature.ts`.
- Structured rule-based extraction lives in `lib/paper-extraction.ts`, and it can optionally refine missing fields with an LLM (see below) when an API key is present.
- Follow-up idea generation and user-submitted idea evaluation live in `lib/research-ideas.ts`.
- If the external APIs fail or return no usable records, the dashboard falls back to the seeded mock literature set.
- Extraction never fabricates absent fields; missing values are normalized to `"not reported"` even when optional LLM refinement is enabled.
- Research idea scoring is rule-based for now and intentionally conservative about calling an idea differentiated.
- Prisma is ready for local persistence and Netlify background jobs; the public pages still read runtime/mock data so the demo remains usable without a database.
- `pnpm db:init` uses `prisma db push` against the configured `DATABASE_URL`; skip it when running the database-optional demo.
- `npm` scripts are also present in `package.json`, but this repo is pinned to `pnpm@11.4.0` for reproducible local verification.

## Netlify 文献订阅后台

The repository includes Netlify scheduled functions under `netlify/functions/`:

- `collect-literature`: runs every 6 hours, collects PubMed / Europe PMC / Crossref records, and stores them in `LiteraturePaper`.
- `collect-rss`: runs hourly, checks high-priority journal RSS / AOP feeds, and stores gene-editing records.
- `match-subscriptions`: runs hourly, reuses `matchPaperToSubscription` to write `SubscriptionMatch` rows.
- `send-digest`: runs daily and records email delivery de-duplication rows in `DeliveredNotification`.

If `DATABASE_URL` is absent, these jobs safely skip and the app remains in demo mode. For production subscription delivery on Netlify, use an external database such as Neon or Supabase Postgres; Netlify Functions should not rely on a local SQLite file for persistent state.

The default RSS seed list currently includes Nature Biotechnology, Nature Methods, and Nature Genetics AOP feeds. Add more feed URLs with `LITERATURE_RSS_FEEDS` as a comma- or newline-separated environment variable.

Recommended next data sources for timely gene-editing literature tracking:

1. bioRxiv / medRxiv
2. OpenAlex
3. Semantic Scholar
4. Unpaywall for open-access full-text links

## 智能分析（LLM）

`/analyze` 的两类分析支持由大模型驱动，采用 **OpenAI 兼容的 Chat Completions 接口**，可自由切换供应商。

- **双模式**：未配置 API key 时整站使用规则引擎，照常可用；配置后自动启用 LLM。
- **统一客户端** `lib/llm.ts`：`isLlmEnabled()` / `llmChat()` / `llmJson()`（结构化 + zod 校验 + 超时/重试/失败回退 null，仅服务端运行，key 不暴露前端）。
- **分析级编排** `lib/analyze-llm.ts`：
  - 关键词模式 → `buildFieldOverviewWithLlm`，基于真实检索文献生成领域进展与未解决问题。
  - 文献模式 → `buildPaperInsightsWithLlm`，生成策略解读、技术迁移路径与衍生课题（如植物应用 / 医学应用）。
- **打分仍走规则**：四维评分（新颖性/可行性/发表潜力/竞争风险）继续由 `lib/research-ideas.ts` 的 `evaluateGeneEditingIdea` 给出，保证口径一致。
- **防幻觉**：prompt 约束模型只基于提供的摘要、缺失即填「未报道」、衍生课题标注为「AI生成假设」。
- **摘要回填**：PubMed 的 esummary 不返回摘要，启用 LLM 时通过 efetch 为入选论文补摘要（`lib/analyze.ts` 的 `backfillPubMedAbstracts`）。

### 配置

复制 `.env.example` 为 `.env` 并填写：

```bash
LLM_API_KEY="<你的 key>"                 # 留空 = 纯规则模式
LLM_BASE_URL="https://api.deepseek.com/v1"  # 默认 DeepSeek；OpenAI 用 https://api.openai.com/v1
LLM_MODEL="deepseek-chat"                # OpenAI 可用 gpt-4o-mini 等
```

旧变量 `OPENAI_API_KEY` / `OPENAI_EXTRACTION_MODEL` 仍作为回退被识别。
