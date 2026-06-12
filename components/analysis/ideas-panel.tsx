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

const DetailPanel = memo(function DetailPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-white">{value}</p>
    </div>
  );
});

export function IdeasPanel({ result }: { result: AnalyzeResponse }) {
  return (
    <section className="grid gap-6">
      {result.ideas.map((idea) => (
        <Card key={idea.id} className="glass-panel">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <ReliabilityBadge label={idea.reliabilityLabel} />
                  <Badge variant="secondary">{idea.innovationType}</Badge>
                  <Badge variant="secondary">{idea.recommendedJournalTier}</Badge>
                </div>
                <CardTitle className="mt-4 text-2xl">{idea.name}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">基于文献：{idea.basedOnPapers.join("；")}</p>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                <p className="font-display text-3xl text-primary">{idea.publicationPotential}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">发表潜力</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailPanel label="创新类型" value={idea.innovationType} />
              <DetailPanel label="衍生路径" value={idea.transferPath} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailPanel label="优先级" value={idea.priority} />
              <DetailPanel label="推荐期刊层级" value={idea.suggestedJournalTier} />
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">创新逻辑</p>
              <p className="mt-2">{idea.innovationLogic}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">可行性风险</p>
              <p className="mt-2">{idea.feasibilityRisk}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">可行性依据</p>
              <p className="mt-2">{idea.feasibilityRationale}</p>
            </div>
            <ScoreBars
              scores={[
                { label: "新颖性", value: idea.noveltyScore },
                { label: "可行性", value: idea.feasibilityScore },
                { label: "发表潜力", value: idea.publicationPotentialScore },
                { label: "竞争风险", value: idea.competitionRisk },
              ]}
            />
            <div className="grid gap-3">
              <p className="font-display text-xl text-white">最低实验数据包</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {idea.minimumExperimentPackage.map((item) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {idea.riskWarnings.length > 0 ? (
              <div className="grid gap-3">
                <p className="font-display text-xl text-white">风险提示</p>
                {idea.riskWarnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
            {idea.warning ? (
              <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
                {idea.warning}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
