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
    <Card className="h-full overflow-hidden glass-panel glass-panel-hover border-none shadow-soft">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-100/50 shadow-none px-2 py-0">
            {toZhPaperStatus(paper.status)}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200/50 shadow-none px-2 py-0">
            {toZhModality(paper.modality)}
          </Badge>
        </div>
        <CardTitle className="text-xl font-display font-semibold tracking-tight text-slate-900 leading-snug">
          {paper.title}
        </CardTitle>
        <CardDescription className="text-xs font-medium text-slate-400 mt-1" suppressHydrationWarning>
          {paper.journal.name} <span className="mx-1.5 opacity-30">•</span> {formatDate(paper.publishedAt)} <span className="mx-1.5 opacity-30">•</span> 综合评分 <span className="text-cyan-600">{paper.compositeScore}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        <p className="text-sm leading-relaxed text-slate-600/90">{paper.keyTakeaway}</p>
        
        <div className="grid gap-3 rounded-2xl bg-bio-gradient p-4 border border-cyan-50/50">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-cyan-700/70">
            <span className="flex items-center gap-2">
              <Microscope className="h-3.5 w-3.5" />
              临床信号
            </span>
            <span className="text-cyan-800">{toZhPaperStage(paper.stage)}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{paper.clinicalSignal}</p>
        </div>

        <ScoreBars
          compact
          scores={[
            { label: "新颖性", value: paper.noveltyScore },
            { label: "热度", value: paper.momentumScore },
            { label: "转化潜力", value: paper.translationalScore },
          ]}
        />
        
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100/50">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-600" />
              被引 {paper.citationCount}
            </span>
            <span>{paper.geneSymbols.slice(0, 3).join(", ")}</span>
          </div>
          <Button asChild variant="ghost" className="h-9 rounded-xl hover:bg-cyan-50 hover:text-cyan-700 transition-all text-xs font-semibold">
            <Link href={`/paper/${paper.id}` as Route}>
              阅读详情
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
