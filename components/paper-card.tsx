import type { Route } from "next";
import Link from "next/link";
import { ArrowUpRight, Microscope, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBars } from "@/components/score-bars";
import { enrichedPapers } from "@/lib/radar-data";
import { toZhDiseaseArea, toZhModality, toZhPaperStage, toZhPaperStatus } from "@/lib/ui-zh";
import { formatDate } from "@/lib/utils";

type EnrichedPaper = (typeof enrichedPapers)[number];

export function PaperCard({ paper }: { paper: EnrichedPaper }) {
  return (
    <Card className="glass-panel h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{toZhPaperStatus(paper.status)}</Badge>
          <Badge variant="secondary">{toZhModality(paper.modality)}</Badge>
          <Badge variant="warning">{toZhDiseaseArea(paper.diseaseArea)}</Badge>
        </div>
        <CardTitle className="text-2xl leading-tight">{paper.title}</CardTitle>
        <CardDescription>
          {paper.journal.name} · {formatDate(paper.publishedAt)} · 综合评分 {paper.compositeScore}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-7 text-slate-300">{paper.keyTakeaway}</p>
        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Microscope className="h-4 w-4 text-primary" />
              临床信号
            </span>
            <span className="text-white">{toZhPaperStage(paper.stage)}</span>
          </div>
          <p className="text-sm text-slate-300">{paper.clinicalSignal}</p>
        </div>
        <ScoreBars
          compact
          scores={[
            { label: "新颖性", value: paper.noveltyScore },
            { label: "热度", value: paper.momentumScore },
            { label: "转化潜力", value: paper.translationalScore },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            被引 {paper.citationCount} 次 · {paper.geneSymbols.join(", ")}
          </div>
          <Button asChild variant="outline">
            <Link href={`/paper/${paper.id}` as Route}>
              查看文献
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
