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

export function JournalsPanel({ result }: { result: AnalyzeResponse }) {
  return (
    <section className="grid gap-6">
      <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
        期刊建议为启发式判断，不代表投稿保证；实际投稿需结合完整数据质量、期刊 scope 和审稿偏好。
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {result.journalSuggestions.map((suggestion) => (
          <Card key={suggestion.journalTier} className="glass-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ReliabilityBadge label={suggestion.reliabilityLabel} />
                <Badge variant="secondary">期刊层级建议</Badge>
              </div>
              <CardTitle className="text-2xl">{suggestion.journalTier}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm leading-7 text-slate-300">{suggestion.rationale}</p>
              <div className="grid gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">示例期刊</p>
                <div className="flex flex-wrap gap-2">
                  {suggestion.exampleJournals.length > 0 ? (
                    suggestion.exampleJournals.map((journal) => (
                      <Badge key={journal} variant="secondary">
                        {journal}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">{NOT_REPORTED}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
