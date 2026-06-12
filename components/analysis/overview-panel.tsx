"use client";

import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyzeResponse } from "@/lib/analyze-types";
import { NOT_REPORTED } from "@/lib/analyze-ui-helpers";
import { cn } from "@/lib/utils";

const ReliabilityBadge = memo(function ReliabilityBadge({ label }: { label: string }) {
  const variant =
    label === "元数据" ? "secondary" : label === "规则解析" ? "default" : label === "启发式评分" ? "warning" : "success";
  return <Badge variant={variant}>{label}</Badge>;
});

export function OverviewPanel({
  result,
  overviewTools,
  overviewOrganisms,
}: {
  result: AnalyzeResponse;
  overviewTools: string[];
  overviewOrganisms: string[];
}) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReliabilityBadge label="规则解析" />
          <Badge variant="secondary">领域概览</Badge>
        </div>
        <CardTitle className="text-3xl">当前方向的结构化概览</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">主要编辑工具</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overviewTools.length > 0 ? (
                overviewTools.map((tool) => (
                  <Badge key={tool} variant="secondary">
                    {tool}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">{NOT_REPORTED}</Badge>
              )}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">主要研究物种</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overviewOrganisms.length > 0 ? (
                overviewOrganisms.map((organism) => (
                  <Badge key={organism} variant="secondary">
                    {organism}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">{NOT_REPORTED}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5 text-sm leading-8 text-slate-300 whitespace-pre-line">
          {result.fieldOverview}
        </div>
      </CardContent>
    </Card>
  );
}
