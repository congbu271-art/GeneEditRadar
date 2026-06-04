# AGENTS.md

## Project Overview

GeneEditRadar is a Chinese-first gene-editing literature analysis demo built with:

- Next.js App Router
- React 19
- Tailwind CSS
- shadcn/ui-style components
- Prisma schema retained for future persistence
- Mock and fallback literature data for demo mode

The current public deployment target is a **database-optional Vercel demo**.

## Current Product Priorities

When working in this repository, optimize for:

1. Keeping the app usable without `DATABASE_URL`
2. Preserving the Chinese UI
3. Keeping `/analyze` stable
4. Falling back to local mock data when external APIs fail
5. Avoiding fake metadata such as DOI, PMID, journal, exact date, or exact editing efficiency

If information is missing, use:

- Chinese UI: `未报道`
- Internal extraction fallback may still use `not reported`, then localize before rendering

## Routes That Matter Most

Primary demo routes:

- `/dashboard`
- `/papers`
- `/paper/[id]`
- `/subscriptions`
- `/ideas`
- `/evaluate`
- `/journals`
- `/analyze`

`/analyze` is the most sensitive route. Do not break:

- keyword mode
- paper mode
- paper strategy summary
- technology transfer paths
- idea generation and evaluation rendering

## Architecture Notes

### UI

- Shared shell: `components/app-shell.tsx`
- Analyze UI: `components/analysis-workbench.tsx`
- Evaluation UI: `components/evaluation-workbench.tsx`
- Shared display primitives: `components/ui/*`

### Analysis Logic

- Main analysis pipeline: `lib/analyze.ts`
- Shared analysis types: `lib/analyze-types.ts`
- Literature collection and fallback: `lib/literature.ts`
- Rule-based extraction: `lib/paper-extraction.ts`
- Research ideas and evaluation: `lib/research-ideas.ts`
- Chinese localization helpers: `lib/ui-zh.ts`

### Data

- Core mock/demo dataset: `lib/mock-data.ts`
- Route-facing derived data: `lib/radar-data.ts`
- Prisma client wrapper: `lib/prisma.ts`
- Prisma schema: `prisma/schema.prisma`

Important:

- The runtime app currently works primarily from mock and derived data
- Prisma exists, but the public demo must not depend on a live database

## Demo Mode Rules

Demo mode is active when `DATABASE_URL` is absent.

In demo mode:

- the app must still build
- the app must still render all main pages
- `/api/analyze` must still work
- `/analyze` must still work
- results may rely on local sample papers and rule-based analysis

Visible label required in demo mode:

- `当前为演示版，部分结果基于示例数据和规则分析生成。`

Do not add:

- login
- user accounts
- saved analysis history
- database-only runtime dependencies for public demo

## Coding Rules For This Repo

- Keep user-facing UI text primarily in Chinese
- Do not translate paper titles, journal names, DOI, PMID, or author names
- Do not redesign the whole UI unless explicitly requested
- Preserve the dark academic dashboard look
- Prefer minimal changes over broad refactors
- Reuse existing mock data and rule-based logic whenever possible

When touching paper-mode analysis:

- strategy summary must come before related-paper metadata in the user experience
- follow-up ideas should prioritize realistic technology transfer paths
- plant trait application papers should not collapse into generic metadata-only output

## Validation Commands

Use Node 24.x.

Preferred local commands:

```bash
npm install
npm run lint
npm test
npm run build
npx tsc --noEmit
```

Important:

- `npx tsc --noEmit` is most reliable **after** `npm run build`
- Next.js generates `.next/types`, and typecheck can fail if build artifacts are missing

## Environment Notes

Environment files must stay uncommitted:

- `.env`
- `.env.local`
- `.env.production`

Optional variables:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_EXTRACTION_MODEL`

If `OPENAI_API_KEY` is absent:

- extraction must remain rule-based
- the app must still function normally

## Safe Change Checklist

Before finishing meaningful app changes, verify:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npx tsc --noEmit`

If the change affects demo deployability, also verify:

1. app builds without `DATABASE_URL`
2. `/analyze` still works in demo mode
3. the demo label is visible

## Deployment Context

Public demo target:

- Vercel

Reference deployment notes:

- `DEPLOYMENT.md`

When making deployment-related changes, preserve:

- no required database for demo
- no login
- no saved user history
- stable mock fallback behavior
