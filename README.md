# GeneEditRadar MVP

GeneEditRadar is a polished MVP frontend for tracking gene-editing papers, turning them into venture-style insights, and pressure-testing startup ideas. It now includes live literature collection from PubMed, Europe PMC, and Crossref with a mock fallback mode when external APIs fail.

## What is included

- Next.js App Router structure with a shared route-group layout
- Tailwind CSS styling and shadcn/ui-style component setup
- Prisma schema for papers, journals, topics, gene targets, subscriptions, ideas, and evaluations
- Literature collection via PubMed E-utilities, Europe PMC, and Crossref
- Paper normalization plus deduplication by DOI, PMID, and normalized title
- Subscription matching by keywords, authors, journals, organisms, and editor types
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
- SQLite for local development
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

3. Generate the Prisma client and initialize the local SQLite schema:

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
- Structured rule-based extraction lives in `lib/paper-extraction.ts`, and it can optionally refine missing fields with the OpenAI Responses API when `OPENAI_API_KEY` is present.
- Follow-up idea generation and user-submitted idea evaluation live in `lib/research-ideas.ts`.
- If the external APIs fail or return no usable records, the dashboard falls back to the seeded mock literature set.
- Extraction never fabricates absent fields; missing values are normalized to `"not reported"` even when optional LLM refinement is enabled.
- Research idea scoring is rule-based for now and intentionally conservative about calling an idea differentiated.
- Prisma is ready for local persistence, but the pages are still reading runtime data directly rather than querying the database.
- `pnpm db:init` uses the Prisma schema as the source of truth and materializes the local SQLite file through a generated SQL diff, which is the verified path for this workspace.
- `npm` scripts are also present in `package.json`, but this repo is pinned to `pnpm@11.4.0` for reproducible local verification.
