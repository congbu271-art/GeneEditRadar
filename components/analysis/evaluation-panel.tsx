"use client";

import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBars } from "@/components/score-bars";
import type { AnalyzeResponse } from "@/lib/analyze-types";
import { cn } from "@/lib/utils";

const ReliabilityBadge = memo(function ReliabilityBadge({ label }: { label: string }) {
  const variant =
    label === "元数据" ? "secondary" : label === "规则解析" ? "default" : label === "启发式评分" ? "warning" : "success";
  return <Badge variant={variant}>{label}</Badge>;
});

const ScorePanel = memo(function ScorePanel({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-4",
        accent ? "border-primary/25 bg-primary/10" : "border-white/10 bg-slate-950/30",
      )}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 font-display text-3xl", accent ? "text-primary" : "text-white")}>{value}</p>
    </div>
  );
});

const DetailPanel = memo(function DetailPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-white">{value}</p>
    </div>
  );
});

export function EvaluationPanel({ result }: { result: AnalyzeResponse }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReliabilityBadge label={result.evaluation.reliabilityLabel} />
          <Badge variant="secondary">主选题评估</Badge>
        </div>
        <CardTitle className="text-3xl">{result.evaluation.targetIdeaName}</CardTitle>
        <p className="text-sm leading-7 text-slate-300">
          下列分数用于快速判断该方向是否值得继续投入实验设计与投稿准备，分数越高代表整体可推进性越强。
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScorePanel label="新颖性评分" value={result.evaluation.novelty} accent />
          <ScorePanel label="可行性评分" value={result.evaluation.feasibility} />
          <ScorePanel label="发表潜力评分" value={result.evaluation.publicationPotential} />
          <ScorePanel label="竞争风险" value={result.evaluation.competitionRisk} />
        </div>
        <ScoreBars
          scores={[
            { label: "新颖性评分", value: result.evaluation.novelty },
            { label: "可行性评分", value: result.evaluation.feasibility },
            { label: "发表潜力评分", value: result.evaluation.publicationPotential },
            { label: "竞争风险", value: result.evaluation.competitionRisk },
          ]}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <DetailPanel label="文章类型判断" value={result.evaluation.articleType} />
          <DetailPanel label="推荐期刊层级" value={result.evaluation.journalTier} />
        </div>
        {result.evaluation.warning ? (
          <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
            {result.evaluation.warning}
          </div>
        ) : null}
        {result.evaluation.lowNoveltyWarning ? (
          <div className="rounded-[24px] border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-7 text-rose-100">
            {result.evaluation.lowNoveltyWarning}
          </div>
        ) : null}
        <div className="grid gap-3">
          <p className="font-display text-xl text-white">建议补充实验</p>
          {result.evaluation.additionalExperiments.map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
              {item}
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <p className="font-display text-xl text-white">评分依据</p>
          {result.evaluation.rationale.map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
