"use client";

import { memo } from "react";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyzeResponse, GeneEditingFeature } from "@/lib/analyze-types";
import {
  NOT_REPORTED,
  getMatchedReason,
} from "@/lib/analyze-ui-helpers";
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

export function PapersPanel({
  result,
  structuredFeatureMap,
}: {
  result: AnalyzeResponse;
  structuredFeatureMap: Map<string, GeneEditingFeature>;
}) {
  if (result.papers.length === 0) {
    return (
      <Card className="glass-panel">
        <CardContent className="flex min-h-48 items-center justify-center text-center text-sm leading-7 text-muted-foreground">
          未找到足够相关的文献，请尝试更具体的关键词
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-6">
      {result.papers.map((paper, index) => {
        const feature = structuredFeatureMap.get(paper.id);

        return (
          <Card key={paper.id} className="glass-panel">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReliabilityBadge label={paper.reliabilityLabel} />
                    <Badge variant="secondary">{paper.source}</Badge>
                    <Badge variant="secondary">信号分 {paper.signalScore}</Badge>
                  </div>
                  <CardTitle className="mt-4 text-2xl">{paper.title}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {paper.journal} · {paper.publishedAt}
                  </p>
                </div>
                {paper.url ? (
                  <Button asChild variant="outline">
                    <a href={paper.url} target="_blank" rel="noreferrer">
                      查看来源
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-sm leading-7 text-slate-100">
                <p className="font-medium text-white">命中原因</p>
                <p className="mt-2">
                  {getMatchedReason(result.mode, paper, feature, index, result.detectedQueryKind)}
                </p>
              </div>
              <p className="text-sm leading-7 text-slate-300">{paper.abstract}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailPanel label="来源" value={paper.source} />
                <DetailPanel label="期刊" value={paper.journal} />
                <DetailPanel label="发表日期" value={paper.publishedAt} />
                <DetailPanel label="DOI" value={paper.doi} />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailPanel label="PMID" value={paper.pmid} />
                <DetailPanel label="编辑工具" value={feature?.editingTool ?? NOT_REPORTED} />
                <DetailPanel label="研究物种" value={feature?.organism ?? NOT_REPORTED} />
                <DetailPanel label="编辑类型" value={feature?.editingType ?? NOT_REPORTED} />
              </div>
              <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ReliabilityBadge label={feature?.reliabilityLabel ?? "规则解析"} />
                  <Badge variant="secondary">{feature?.editingTool ?? NOT_REPORTED}</Badge>
                  <Badge variant="secondary">{feature?.organism ?? NOT_REPORTED}</Badge>
                  <Badge variant="secondary">{feature?.editingType ?? NOT_REPORTED}</Badge>
                </div>
                <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
                  <p className="font-medium text-white">作者</p>
                  <p className="mt-2">{paper.authors.join(", ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
