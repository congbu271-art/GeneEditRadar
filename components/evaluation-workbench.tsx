"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { enrichedIdeas, enrichedPapers } from "@/lib/radar-data";
import { evaluateGeneEditingIdea, getTargetHintForIdeaSummary } from "@/lib/research-ideas";
import {
  getLocalizedEvaluationCopy,
  getLocalizedIdeaCopy,
  toZhIncrementalBadge,
  toZhIdeaType,
  toZhModality,
} from "@/lib/ui-zh";
import { cn } from "@/lib/utils";

export function EvaluationWorkbench() {
  const initialIdea = enrichedIdeas[0];
  const initialIdeaCopy = initialIdea ? getLocalizedIdeaCopy(initialIdea) : undefined;
  const [selectedIdeaSlug, setSelectedIdeaSlug] = useState(initialIdea?.slug ?? "");
  const [ideaTitle, setIdeaTitle] = useState(initialIdeaCopy?.title ?? "");
  const [ideaSummary, setIdeaSummary] = useState(initialIdeaCopy?.thesis ?? "");
  const [sourcePaperId, setSourcePaperId] = useState(initialIdea?.paperId ?? enrichedPapers[0]?.id ?? "");
  const [ideaTypeHint, setIdeaTypeHint] = useState(initialIdea?.ideaType);

  const selectedIdea = useMemo(
    () => enrichedIdeas.find((idea) => idea.slug === selectedIdeaSlug) ?? enrichedIdeas[0],
    [selectedIdeaSlug],
  );
  const deferredTitle = useDeferredValue(ideaTitle);
  const deferredSummary = useDeferredValue(ideaSummary);

  const evaluation = useMemo(
    () =>
      evaluateGeneEditingIdea({
        title: deferredTitle,
        summary: deferredSummary,
        sourcePaperId,
        suggestedIdeaType: ideaTypeHint,
      }),
    [deferredSummary, deferredTitle, ideaTypeHint, sourcePaperId],
  );

  const targetHint = getTargetHintForIdeaSummary(`${deferredTitle} ${deferredSummary}`);
  const selectedSourcePaper = enrichedPapers.find((paper) => paper.id === sourcePaperId);

  if (!selectedIdea || !selectedSourcePaper) {
    return null;
  }

  const localizedEvaluation = getLocalizedEvaluationCopy(evaluation, selectedSourcePaper);

  const scores = [
    { label: "新颖性评分", value: evaluation.novelty, detail: "衡量方案相对锚定论文的差异化程度。" },
    { label: "可行性评分", value: evaluation.feasibility, detail: "衡量最小研究设计是否能够被清晰执行。" },
    {
      label: "发表潜力评分",
      value: evaluation.publicationPotential,
      detail: "衡量当前方案是否足以支撑可信的论文数据包。",
    },
    {
      label: "竞争风险",
      value: evaluation.competitionRisk,
      detail: "分值越高，说明该方向越可能已拥挤或偏同质化。",
    },
  ];

  const loadSuggestion = (slug: string) => {
    const idea = enrichedIdeas.find((item) => item.slug === slug);
    if (!idea) {
      return;
    }

    startTransition(() => {
      setSelectedIdeaSlug(idea.slug);
      const localized = getLocalizedIdeaCopy(idea);
      setIdeaTitle(localized.title);
      setIdeaSummary(localized.thesis);
      setSourcePaperId(idea.paperId);
      setIdeaTypeHint(idea.ideaType);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="glass-panel">
        <CardHeader>
          <Badge>评估工作台</Badge>
          <CardTitle className="text-3xl">选题评估面板</CardTitle>
          <p className="text-sm leading-7 text-slate-300">
            提交一个基因编辑衍生选题，将其锚定到来源论文，并获得规则评分、最低实验数据包与初步发表建议。
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
            <div className="grid gap-3">
              <label htmlFor="idea-title" className="text-sm font-medium text-foreground">
                选题标题
              </label>
              <Input
                id="idea-title"
                value={ideaTitle}
                onChange={(event) => setIdeaTitle(event.target.value)}
                placeholder="示例：优化用于肝脏 prime editing 的 LNP 重复给药策略"
              />
            </div>
            <div className="grid gap-3">
              <label htmlFor="idea-summary" className="text-sm font-medium text-foreground">
                选题摘要
              </label>
              <Textarea
                id="idea-summary"
                value={ideaSummary}
                onChange={(event) => setIdeaSummary(event.target.value)}
                className="min-h-32"
                placeholder="请概述编辑方式、递送策略、靶点、模型体系，以及哪些数据将使该研究具备发表潜力。"
              />
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-medium text-foreground">锚定论文</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {enrichedPapers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => setSourcePaperId(paper.id)}
                    className={cn(
                      "rounded-[24px] border px-4 py-4 text-left transition-all",
                      sourcePaperId === paper.id
                        ? "border-primary/30 bg-primary/10 shadow-glow"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                    )}
                  >
                    <p className="font-display text-lg">{paper.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {paper.journal.name} · {toZhModality(paper.modality)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{localizedEvaluation.classification}</Badge>
                  <Badge variant={evaluation.isIncremental ? "warning" : "success"}>{toZhIncrementalBadge(evaluation.isIncremental)}</Badge>
                  {targetHint ? <Badge>{targetHint}</Badge> : null}
                </div>
                <p className="mt-3 font-display text-2xl">{deferredTitle || "未命名选题"}</p>
                <p className="mt-2 text-sm text-slate-300">{selectedSourcePaper.title}</p>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-primary/10 px-5 py-4 text-center">
                <p className="font-display text-4xl text-primary">{evaluation.overallScore}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">综合匹配度</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {scores.map((score) => (
                <div key={score.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{score.label}</p>
                  <p className="mt-3 font-display text-3xl">{score.value}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{score.detail}</p>
                </div>
              ))}
            </div>
            {evaluation.warning ? (
              <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
                {localizedEvaluation.warning}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <Badge variant="secondary">结果建议</Badge>
          <CardTitle className="text-3xl">下一步实验与投稿方向</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">文章类型建议</p>
              <p className="mt-2 text-white">{localizedEvaluation.articleType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">推荐期刊层级</p>
              <p className="mt-2 text-white">{localizedEvaluation.journalTier}</p>
            </div>
          </div>
          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-300">
            <p className="font-display text-xl text-white">最低实验数据包</p>
            <div className="grid gap-3">
              {localizedEvaluation.minimumExperimentalPackage.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-300">
            <p className="font-display text-xl text-white">建议补充实验</p>
            <div className="grid gap-3">
              {localizedEvaluation.additionalExperiments.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-300">
            <p className="font-display text-xl text-white">评分依据说明</p>
            <div className="grid gap-3">
              {localizedEvaluation.rationale.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-xl text-white">载入系统生成选题</p>
              <Button type="button" variant="outline" onClick={() => loadSuggestion(selectedIdea.slug)}>
                重新载入当前选题
              </Button>
            </div>
            <div className="grid gap-3">
              {enrichedIdeas.slice(0, 6).map((idea) => {
                const localized = getLocalizedIdeaCopy(idea);

                return (
                <button
                  key={idea.slug}
                  type="button"
                  onClick={() => loadSuggestion(idea.slug)}
                  className={cn(
                    "rounded-[24px] border px-4 py-4 text-left transition-all",
                    selectedIdeaSlug === idea.slug
                      ? "border-primary/30 bg-primary/10 shadow-glow"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-lg text-white">{localized.title}</p>
                    <Badge variant="secondary">{toZhIdeaType(idea.ideaType)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{idea.paper?.title}</p>
                </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
