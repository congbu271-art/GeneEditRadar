# GeneEditRadar Workbench Redesign Design

Date: 2026-06-07

## Goal

Redesign GeneEditRadar into a brighter, modern, technology-forward research workbench for Chinese-speaking gene-editing researchers.

The redesign should make the product feel less like a dark demo dashboard and more like a daily-use literature analysis console. It must keep the current app functional without a database, preserve the Chinese UI, and protect the `/analyze` workflow.

## Selected Direction

Use the **Workbench Console** direction:

- Professional research workstation rather than marketing site.
- Brighter lab-console palette rather than the current deep glass dashboard.
- Higher information density with clearer hierarchy.
- `/analyze` remains the primary workflow.
- Existing routes and mock/fallback behavior remain intact.

## Visual Language

The new look should feel like a bright scientific SaaS console with AI analysis capabilities.

Palette:

- Page background: cool white, pale cyan, and light slate.
- Main text: graphite and deep blue-gray.
- Primary accent: cyan/teal for analysis and active states.
- Secondary accent: restrained blue or emerald for data-source and success states.
- Warning accent: amber, used only for demo mode, fallback, and incomplete data.
- Avoid a one-note blue or purple look.

Surface treatment:

- Replace heavy dark glass panels with light, crisp, layered panels.
- Use subtle borders, compact shadows, and precise spacing.
- Keep card radii mostly between 8px and 16px.
- Avoid decorative blobs, heavy gradients, and landing-page hero styling.

Typography:

- Keep the existing font stack unless a local design-system change is already available.
- Use smaller, tighter headings inside workbench panels.
- Reserve large type for page-level context only.
- Keep letter spacing at zero except existing small uppercase labels where they already fit the dashboard language.

## Information Architecture

Keep the existing public routes:

- `/dashboard`
- `/papers`
- `/paper/[id]`
- `/subscriptions`
- `/notifications`
- `/ideas`
- `/evaluate`
- `/journals`
- `/analyze`

Do not add:

- login
- user accounts
- saved analysis history
- database-only runtime dependencies
- a marketing landing page

## Global Shell

Update `components/app-shell.tsx` into a compact research-console shell.

Required changes:

- Keep the left navigation on desktop and top-stacked layout on mobile.
- Make the shell brighter, with a light sidebar and subtle module grouping.
- Replace the current large MVP promo card with operational status:
  - demo mode status
  - analysis engine mode
  - data-source/fallback note
- Keep the required demo label visible when `DATABASE_URL` is absent:
  - `当前为演示版，部分结果基于示例数据和规则分析生成。`
- Keep navigation labels in Chinese.
- Use lucide icons already available in the app.

The shell should communicate "research control room", not "product landing page".

## Shared UI System

Update shared primitives rather than restyling every page independently.

Targets:

- `app/globals.css`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/textarea.tsx`
- `components/page-header.tsx`
- `components/metric-card.tsx`

Expected effect:

- Light color tokens become the default.
- Cards become crisp workbench panels.
- Badges become compact status chips.
- Buttons become modern but restrained controls.
- Inputs and textareas feel like analysis-console fields.

Implementation should reuse existing component APIs so route pages require minimal changes.

## Dashboard

Redesign `/dashboard` as the command center for a research day.

First-screen priorities:

- "今日研究队列" or equivalent dashboard framing.
- High-signal literature summary.
- External source status and fallback state.
- Subscription matches.
- Fast entry into `/analyze`.

Expected layout:

- Dense metric strip at top.
- Main two-column section:
  - priority literature and subscription matches
  - source status and quick analysis entry
- Lower sections can retain current data cards but should adopt the new visual system.

The dashboard should favor scanning and comparison over large decorative cards.

## Analyze Page

`/analyze` is the most sensitive route and must remain stable.

Keep:

- keyword mode
- paper mode
- paper strategy summary
- technology transfer paths
- idea generation and evaluation rendering
- API contract used by `app/api/analyze/route.ts`

Visual redesign:

- Treat `/analyze` as the core workbench.
- Use a compact two-column input and status area:
  - left: mode selector, query input, example prompts, submit control
  - right: process status, source/reliability labels, output explanation
- Result order for paper mode must remain strategy-first:
  - strategy summary
  - technology transfer paths
  - generated ideas and evaluation
  - related-paper metadata
- Missing information still renders as `未报道`.
- Avoid making plant trait application papers collapse into generic metadata-only output.

## Other Routes

Apply the visual system consistently, but avoid broad route-specific rewrites unless needed for coherence.

Routes to lightly modernize:

- `/papers`: denser paper cards and clearer filtering/scanning feel.
- `/subscriptions`: monitoring rules should feel operational, not promotional.
- `/notifications`: keep as a draft notification workspace; make database/email limitations clear.
- `/ideas`: show generated ideas as research candidates with score, type, and experiment package.
- `/evaluate`: keep evaluation controls functional and readable.
- `/journals`: make journal matching look like a structured reference panel.

## Data And Content Rules

Keep all user-facing interface copy primarily Chinese.

Do not translate:

- paper titles
- journal names
- DOI
- PMID
- author names

Do not fabricate:

- DOI
- PMID
- journal
- exact publication date
- exact editing efficiency

Missing Chinese UI values should render as:

- `未报道`

Internal fallback may still use:

- `not reported`

## Responsiveness

Desktop:

- Dense workbench with sidebar and multi-column panels.
- No oversized hero sections.
- No nested cards unless they are repeated items or true framed tools.

Mobile:

- Navigation stacks cleanly.
- Key actions remain near the top.
- Text must not overflow buttons, cards, or status chips.
- Fixed-format UI elements should have stable dimensions to avoid layout jumps.

## Testing And Verification

Before claiming implementation complete, run:

```bash
npm run lint
npm test
npm run build
npx tsc --noEmit
```

Additional checks:

- Build works without `DATABASE_URL`.
- `/analyze` renders in demo mode.
- The demo label is visible when `DATABASE_URL` is absent.
- `/api/analyze` returns a valid keyword-mode response.
- Paper mode still returns and renders strategy summary before related-paper metadata.

## Non-Goals

This redesign will not:

- add persistence
- add authentication
- add saved history
- replace mock/fallback data
- switch deployment target
- rewrite the analysis engine
- introduce a new component library
- add a marketing landing page

## Implementation Boundaries

Prefer a small set of high-leverage UI changes:

1. Global design tokens and shared UI primitives.
2. App shell and page header.
3. Dashboard first-screen structure.
4. Analyze workbench visual layout.
5. Focused polish on repeated cards.

Avoid broad refactors in `lib/analyze.ts`, `lib/research-ideas.ts`, and data-fetching modules unless a visual change cannot be completed without a small type or mapping adjustment.

## Approval Criteria

The redesign is successful when:

- The app feels bright, modern, scientific, and technology-forward.
- The app reads as a research workbench, not a landing page.
- Existing demo-mode behavior remains intact.
- `/analyze` remains stable and visually clearer.
- Chinese copy remains primary.
- Validation commands pass.
