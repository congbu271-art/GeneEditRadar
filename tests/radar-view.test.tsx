import assert from "node:assert/strict";
import test from "node:test";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "../components/app-shell";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

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
  assert.match(html, /glass-panel|bg-white/);
  assert.match(html, /rounded-2xl|rounded-\[2\.5rem\]/);
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
      <PathnameContext.Provider value="/dashboard">
        <AppShell>
          <div>主体内容</div>
        </AppShell>
      </PathnameContext.Provider>,
    );

    assert.match(html, /GeneRadar|基因编辑雷达/);
    assert.match(html, /研究工作台/);
    assert.match(html, /演示版/);
    assert.match(html, /规则引擎|混合智能/);
    assert.match(html, /主体内容/);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});
