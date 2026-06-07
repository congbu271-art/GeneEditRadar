# GeneEditRadar Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert GeneEditRadar into a brighter, modern, technology-forward research workbench while preserving demo-mode behavior and `/analyze` stability.

**Architecture:** Implement the redesign through shared tokens and primitives first, then update shell, dashboard, and analyze layouts with focused route-level changes. Keep data fetching and analysis logic unchanged; protect behavior through render and analysis tests.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, lucide-react, Node test runner with `tsx`.

---

## File Structure

Files to modify:

- `app/globals.css`: light workbench color tokens, body background, panel utilities.
- `components/ui/card.tsx`: compact light panel default.
- `components/ui/badge.tsx`: compact modern status chips.
- `components/ui/button.tsx`: restrained modern controls.
- `components/ui/input.tsx`: light input surface.
- `components/ui/textarea.tsx`: light textarea surface.
- `components/page-header.tsx`: compact workbench header.
- `components/metric-card.tsx`: dense metric tile.
- `components/app-shell.tsx`: brighter research-console shell and operational status area.
- `app/(radar)/dashboard/page.tsx`: command-center first screen.
- `components/analysis-workbench.tsx`: brighter two-column workbench layout and result panel polish.
- `tests/radar-view.test.tsx`: UI render regression tests.
- `tests/analyze.test.ts`: keep or extend `/analyze` section-order tests.

Files to avoid changing unless tests expose a real need:

- `lib/analyze.ts`
- `lib/analyze-types.ts`
- `lib/research-ideas.ts`
- `lib/literature.ts`
- `app/api/analyze/route.ts`

## Task 1: Add Shared UI Regression Tests

**Files:**

- Modify: `tests/radar-view.test.tsx`

- [ ] **Step 1: Write failing tests for the light workbench primitives**

Replace `tests/radar-view.test.tsx` with:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "../components/app-shell";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

test("renders a modern light primary UI action", () => {
  const html = renderToStaticMarkup(<Button>查看文献</Button>);

  assert.match(html, /查看文献/);
  assert.match(html, /bg-slate-950/);
  assert.match(html, /rounded-xl/);
  assert.doesNotMatch(html, /rounded-full/);
});

test("renders a crisp light workbench card", () => {
  const html = renderToStaticMarkup(<Card>控制台面板</Card>);

  assert.match(html, /控制台面板/);
  assert.match(html, /bg-white/);
  assert.match(html, /rounded-2xl/);
  assert.doesNotMatch(html, /border-white\/10/);
});

test("renders status chips for bright workbench surfaces", () => {
  const html = renderToStaticMarkup(
    <div>
      <Badge>规则解析</Badge>
      <Badge variant="warning">回退</Badge>
      <Badge variant="success">在线</Badge>
    </div>,
  );

  assert.match(html, /规则解析/);
  assert.match(html, /回退/);
  assert.match(html, /在线/);
  assert.match(html, /border-cyan-200/);
  assert.match(html, /border-amber-200/);
  assert.match(html, /border-emerald-200/);
});

test("renders compact workbench page headers", () => {
  const html = renderToStaticMarkup(
    <PageHeader eyebrow="文献雷达" title="今日研究队列" description="追踪高信号文献、订阅命中与分析入口。" />,
  );

  assert.match(html, /文献雷达/);
  assert.match(html, /今日研究队列/);
  assert.match(html, /bg-white/);
  assert.match(html, /rounded-2xl/);
});

test("renders dense metric cards", () => {
  const html = renderToStaticMarkup(<MetricCard label="高信号文献" value="8" detail="综合评分高于 88。" />);

  assert.match(html, /高信号文献/);
  assert.match(html, /综合评分高于 88/);
  assert.match(html, /text-3xl/);
});

test("renders the research-console shell with demo status", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";

  try {
    const html = renderToStaticMarkup(
      <AppShell>
        <div>主体内容</div>
      </AppShell>,
    );

    assert.match(html, /基因编辑雷达/);
    assert.match(html, /研究工作台/);
    assert.match(html, /当前为演示版，部分结果基于示例数据和规则分析生成。/);
    assert.match(html, /规则引擎/);
    assert.match(html, /主体内容/);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: FAIL with assertions for `bg-slate-950`, `rounded-xl`, `bg-white`, `rounded-2xl`, or `研究工作台`, because the current UI still uses dark glass and rounded-full controls.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/radar-view.test.tsx
git commit -m "test: capture workbench visual contract"
```

## Task 2: Convert Shared Tokens And UI Primitives

**Files:**

- Modify: `app/globals.css`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/badge.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/textarea.tsx`
- Modify: `components/page-header.tsx`
- Modify: `components/metric-card.tsx`

- [ ] **Step 1: Update global tokens and panel utilities**

In `app/globals.css`, replace the `:root`, `body`, `::selection`, `.glass-panel`, and `.metric-grid` blocks with:

```css
:root {
  --font-display: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
  --font-body: "Avenir Next", "Helvetica Neue", "Segoe UI", sans-serif;
  --background: 210 40% 98%;
  --foreground: 218 33% 16%;
  --card: 0 0% 100%;
  --card-foreground: 218 33% 16%;
  --primary: 188 86% 38%;
  --primary-foreground: 0 0% 100%;
  --secondary: 206 38% 94%;
  --secondary-foreground: 218 33% 16%;
  --muted: 211 32% 92%;
  --muted-foreground: 215 16% 45%;
  --accent: 161 64% 38%;
  --accent-foreground: 0 0% 100%;
  --border: 214 30% 86%;
  --input: 214 30% 86%;
  --ring: 188 86% 38%;
  --radius: 0.875rem;
}

body {
  min-height: 100vh;
  background:
    linear-gradient(120deg, rgba(236, 254, 255, 0.92), rgba(248, 250, 252, 0.98) 38%, rgba(239, 246, 255, 0.94)),
    linear-gradient(180deg, #f8fafc 0%, #eef6fb 100%);
  color: hsl(var(--foreground));
  font-family: var(--font-body), sans-serif;
}

::selection {
  background: rgba(8, 145, 178, 0.18);
}

.glass-panel {
  background: rgba(255, 255, 255, 0.84);
  border-color: rgba(148, 163, 184, 0.28);
  box-shadow: 0 18px 60px -42px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(18px);
}

.metric-grid {
  background-image:
    linear-gradient(rgba(14, 116, 144, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 116, 144, 0.08) 1px, transparent 1px);
  background-size: 22px 22px;
}
```

- [ ] **Step 2: Update `Card` default styling**

In `components/ui/card.tsx`, set the `Card` default class to:

```tsx
"rounded-2xl border border-slate-200/80 bg-white text-card-foreground shadow-[0_18px_60px_-44px_rgba(15,23,42,0.55)]"
```

Keep `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` APIs unchanged.

- [ ] **Step 3: Update badge variants**

In `components/ui/badge.tsx`, replace `badgeVariants` with:

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-cyan-200 bg-cyan-50 text-cyan-800",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
```

- [ ] **Step 4: Update button variants**

In `components/ui/button.tsx`, replace the base class and variant classes with:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-slate-950 text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.9)] hover:bg-slate-800",
        secondary: "bg-cyan-50 text-cyan-800 hover:bg-cyan-100",
        outline: "border border-slate-200 bg-white text-slate-800 hover:border-cyan-200 hover:bg-cyan-50",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

- [ ] **Step 5: Update inputs and textareas**

In `components/ui/input.tsx`, use:

```tsx
"flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-950 shadow-inner shadow-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

In `components/ui/textarea.tsx`, use:

```tsx
"flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-inner shadow-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

- [ ] **Step 6: Update `PageHeader` to a compact workbench header**

In `components/page-header.tsx`, change the section classes to:

```tsx
<section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.55)] md:p-6">
  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500" />
  <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
    <div className="max-w-3xl">
      <Badge>{eyebrow}</Badge>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{description}</p>
    </div>
    {actions ? <div className="relative flex flex-wrap gap-3">{actions}</div> : null}
  </div>
</section>
```

- [ ] **Step 7: Update `MetricCard` density**

In `components/metric-card.tsx`, keep the API and change the classes so the title uses `text-3xl`, body text uses `text-slate-500`, and the icon container uses:

```tsx
"rounded-xl border border-cyan-200 bg-cyan-50 p-2 text-cyan-700"
```

- [ ] **Step 8: Run UI tests to verify shared UI passes**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: PASS for all tests in `tests/radar-view.test.tsx`.

- [ ] **Step 9: Commit shared UI changes**

```bash
git add app/globals.css components/ui/card.tsx components/ui/badge.tsx components/ui/button.tsx components/ui/input.tsx components/ui/textarea.tsx components/page-header.tsx components/metric-card.tsx tests/radar-view.test.tsx
git commit -m "style: introduce bright workbench primitives"
```

## Task 3: Redesign The App Shell

**Files:**

- Modify: `components/app-shell.tsx`
- Test: `tests/radar-view.test.tsx`

- [ ] **Step 1: Run shell regression test before implementation**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: If Task 2 did not include shell changes, the shell test still fails on `研究工作台` or `规则引擎`.

- [ ] **Step 2: Replace the promo block with operational status**

In `components/app-shell.tsx`, keep imports and `iconMap`, then update the shell markup so it includes these visible strings:

```tsx
<p className="text-xs font-semibold text-cyan-700">研究工作台</p>
<p className="font-display text-xl font-semibold text-slate-950">基因编辑雷达</p>
<p className="mt-1 text-sm text-slate-500">文献监测 · 智能分析 · 选题评估</p>
```

Use this operational status area:

```tsx
<div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm font-medium text-slate-700">运行状态</span>
    <Badge variant={isDemoMode ? "warning" : "success"}>{isDemoMode ? "演示版" : "生产数据"}</Badge>
  </div>
  <div className="grid gap-2 text-sm text-slate-600">
    <div className="flex items-center justify-between gap-3">
      <span>分析引擎</span>
      <span className="font-medium text-slate-950">规则引擎</span>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span>文献来源</span>
      <span className="font-medium text-slate-950">{isDemoMode ? "示例数据 + 回退" : "外部来源 + 数据库"}</span>
    </div>
  </div>
</div>
```

Keep the exact demo label block when `isDemoMode` is true.

- [ ] **Step 3: Restyle the navigation**

Use light navigation rows with icon containers:

```tsx
<nav className="mt-5 grid gap-1.5">
  {navigationItems.map((item) => {
    const Icon = iconMap[item.href];

    return (
      <div key={item.href} className="group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100">
        <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors group-hover:border-cyan-200 group-hover:text-cyan-700">
          <Icon className="h-4 w-4" />
        </div>
        <NavLink href={item.href} label={item.label} />
      </div>
    );
  })}
</nav>
```

Update `NavLink` only if current active/hover classes clash with the light shell; if modified, use `bg-cyan-50 text-cyan-800` for active and `text-slate-600 hover:bg-slate-100 hover:text-slate-950` for inactive.

- [ ] **Step 4: Run shell tests**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit shell changes**

```bash
git add components/app-shell.tsx components/nav-link.tsx tests/radar-view.test.tsx
git commit -m "style: redesign research console shell"
```

## Task 4: Restructure Dashboard First Screen

**Files:**

- Modify: `app/(radar)/dashboard/page.tsx`

- [ ] **Step 1: Add a render test for dashboard framing**

Add this test to `tests/radar-view.test.tsx`:

```tsx
test("dashboard framing uses research queue language", async () => {
  const DashboardPage = (await import("../app/(radar)/dashboard/page")).default;
  const element = await DashboardPage();
  const html = renderToStaticMarkup(element);

  assert.match(html, /今日研究队列/);
  assert.match(html, /快速分析/);
  assert.match(html, /外部检索状态/);
});
```

- [ ] **Step 2: Run the dashboard framing test to verify it fails**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: FAIL because current dashboard header does not include `今日研究队列` or `快速分析`.

- [ ] **Step 3: Update dashboard header and first-screen cards**

In `app/(radar)/dashboard/page.tsx`, update the `PageHeader` props:

```tsx
eyebrow="文献雷达"
title="今日研究队列"
description="把高信号论文、订阅命中、来源状态和智能分析入口放在同一个研究工作台中。"
```

Add a compact quick analysis card near the top of the main two-column section:

```tsx
<Card className="metric-grid border-cyan-200/70 bg-cyan-50/80">
  <CardHeader>
    <Badge>快速分析</Badge>
    <CardTitle className="text-2xl text-slate-950">从问题进入文献策略判断</CardTitle>
  </CardHeader>
  <CardContent className="grid gap-4">
    <p className="text-sm leading-7 text-slate-600">
      输入关键词、论文标题、DOI 或 PMID，优先查看策略摘要、技术迁移路径和衍生选题。
    </p>
    <Button asChild>
      <Link href="/analyze">
        打开智能分析
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  </CardContent>
</Card>
```

Keep existing source-status and subscription-match logic intact.

- [ ] **Step 4: Run dashboard framing test**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit dashboard changes**

```bash
git add app/'(radar)'/dashboard/page.tsx tests/radar-view.test.tsx
git commit -m "style: reshape dashboard as research queue"
```

## Task 5: Modernize Analyze Workbench Layout

**Files:**

- Modify: `components/analysis-workbench.tsx`
- Test: `tests/analyze.test.ts`
- Test: `tests/radar-view.test.tsx`

- [ ] **Step 1: Keep the existing section-order tests**

Run:

```bash
npm test -- tests/analyze.test.ts
```

Expected: PASS before visual work starts. If it fails, stop and fix the existing behavioral regression before changing layout.

- [ ] **Step 2: Add a render test for analyze workbench framing**

Add this test to `tests/radar-view.test.tsx`:

```tsx
test("analyze page uses workbench framing", () => {
  const { AnalysisWorkbench } = require("../components/analysis-workbench") as typeof import("../components/analysis-workbench");
  const html = renderToStaticMarkup(React.createElement(AnalysisWorkbench));

  assert.match(html, /智能分析/);
  assert.match(html, /研究问题/);
  assert.match(html, /可靠性标签/);
  assert.match(html, /策略优先/);
});
```

- [ ] **Step 3: Run the new analyze framing test to verify it fails**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: FAIL because current `/analyze` helper text does not include `研究问题`, `可靠性标签`, or `策略优先`.

- [ ] **Step 4: Update analyze header and helper panel copy**

In `components/analysis-workbench.tsx`, update the `PageHeader` description and the right-side helper card labels so the initial render includes:

```tsx
title="智能分析"
description="围绕一个研究问题或一篇种子文献，生成策略解读、技术迁移路径、衍生选题和可发表性评估。"
```

Use section labels:

```tsx
<Badge variant="secondary">可靠性标签</Badge>
<Badge>策略优先</Badge>
```

Use the input label:

```tsx
<label htmlFor="analysis-query" className="text-sm font-medium text-slate-800">研究问题</label>
```

- [ ] **Step 5: Restyle initial workbench panels**

In the initial input section, use:

```tsx
<section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
```

For mode option buttons, use light selected and inactive classes:

```tsx
className={cn(
  "rounded-2xl border p-4 text-left transition-all",
  mode === option.value
    ? "border-cyan-300 bg-cyan-50 shadow-[0_18px_45px_-35px_rgba(8,145,178,0.65)]"
    : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/60",
)}
```

For helper workflow cards, use:

```tsx
"rounded-2xl border border-slate-200 bg-white p-4"
```

Keep all result data normalization, fetch handling, mode switching, and result rendering logic unchanged.

- [ ] **Step 6: Run analyze and UI tests**

Run:

```bash
npm test -- tests/analyze.test.ts tests/radar-view.test.tsx
```

Expected: PASS. The existing `paper mode defaults to strategy-first and idea-first navigation` test must still pass.

- [ ] **Step 7: Commit analyze workbench changes**

```bash
git add components/analysis-workbench.tsx tests/analyze.test.ts tests/radar-view.test.tsx
git commit -m "style: modernize analyze workbench"
```

## Task 6: Apply Focused Polish To Repeated Cards

**Files:**

- Modify: `components/paper-card.tsx`
- Modify: `components/idea-card.tsx`
- Modify: `components/journal-card.tsx`
- Modify: `components/subscription-card.tsx`
- Modify: `components/score-bars.tsx`

- [ ] **Step 1: Run current UI tests**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: PASS before polish.

- [ ] **Step 2: Replace dark nested card classes**

In repeated card components, replace nested dark utility groups:

```tsx
"rounded-[24px] border border-white/10 bg-slate-950/30 p-4"
```

with:

```tsx
"rounded-2xl border border-slate-200 bg-slate-50 p-4"
```

Replace text classes:

```tsx
"text-slate-300"
```

with:

```tsx
"text-slate-600"
```

Replace primary nested panels:

```tsx
"border-primary/15 bg-primary/5"
```

with:

```tsx
"border-cyan-200 bg-cyan-50"
```

- [ ] **Step 3: Keep button and link behavior unchanged**

Do not change:

- `href` targets
- `asChild`
- route casts such as `as Route`
- score calculations
- paper/idea/journal data mapping

- [ ] **Step 4: Run focused UI tests**

Run:

```bash
npm test -- tests/radar-view.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit repeated-card polish**

```bash
git add components/paper-card.tsx components/idea-card.tsx components/journal-card.tsx components/subscription-card.tsx components/score-bars.tsx
git commit -m "style: polish repeated workbench cards"
```

## Task 7: Full Verification And Demo-Mode Check

**Files:**

- No source edits expected.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0 with no ESLint warnings or errors.

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass, including `tests/analyze.test.ts` and `tests/radar-view.test.tsx`.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: exit 0 and route table includes `/analyze` plus `/api/analyze`.

- [ ] **Step 4: Run typecheck after build**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Verify no-database build and demo label**

Run:

```bash
set -e
backup=".env.codex-demo-check.$$"
restore_env() {
  if [ -f "$backup" ]; then
    mv "$backup" .env
  fi
}
trap restore_env EXIT
if [ -f .env ]; then
  mv .env "$backup"
fi
npm run build >/tmp/geneeditradar-demo-build.log 2>&1
rg "当前为演示版，部分结果基于示例数据和规则分析生成。" .next/server/app/analyze.html .next/server/app/analyze.rsc
tail -n 24 /tmp/geneeditradar-demo-build.log
```

Expected: exit 0, `rg` finds the demo label in the `/analyze` build output, and the build route table includes `/analyze`.

- [ ] **Step 6: Verify `/api/analyze` in production server**

Run:

```bash
npm run start -- -p 3100
```

In a second terminal, run:

```bash
curl -sS -X POST http://localhost:3100/api/analyze \
  -H 'content-type: application/json' \
  --data '{"mode":"keyword","query":"prime editing rice"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s); console.log(JSON.stringify({mode:j.mode, query:j.query, ideas:j.ideas?.length, hasFieldOverview:Boolean(j.fieldOverview), hasError:Boolean(j.error)}, null, 2)); if (j.mode !== "keyword" || j.error) process.exit(1);})'
```

Expected JSON:

```json
{
  "mode": "keyword",
  "query": "prime editing rice",
  "ideas": 5,
  "hasFieldOverview": true,
  "hasError": false
}
```

Stop the server with `Ctrl+C`.

- [ ] **Step 7: Check final git state**

Run:

```bash
git status --short --branch
```

Expected: the working tree is clean after the planned task commits. If verification revealed a source problem, return to the task that introduced it, fix the specific file there, rerun that task's verification command, and amend that task's commit with `git commit --amend --no-edit`.

## Self-Review

Spec coverage:

- Bright modern technology-forward visual language: Tasks 2, 3, 4, 5, 6.
- Existing route structure preserved: all tasks avoid route additions.
- Demo mode and required label preserved: Tasks 1, 3, 7.
- `/analyze` stability and strategy-first behavior preserved: Tasks 5, 7.
- Chinese UI and no fabricated metadata: plan does not change extraction or metadata logic.
- No login, history, persistence, database dependency, or marketing page: listed as files to avoid and not included in tasks.

Completion scan:

- The plan contains no unresolved instructions and no generic file tokens.

Type consistency:

- Test imports use existing exported components and existing `getResultSectionSequence` behavior.
- No new production type is introduced.
