import { Clock3, Globe2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedJournals } from "@/lib/radar-data";
import { toZhOpenAccessBadge, toZhRegion } from "@/lib/ui-zh";
import { formatPercent } from "@/lib/utils";

type EnrichedJournal = (typeof enrichedJournals)[number];

export function JournalCard({ journal }: { journal: EnrichedJournal }) {
  return (
    <Card className="h-full overflow-hidden border-slate-200/80 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={journal.openAccess ? "success" : "secondary"}>{toZhOpenAccessBadge(journal.openAccess)}</Badge>
          <span className="text-sm text-slate-500">覆盖评分 {journal.coverageScore}</span>
        </div>
        <CardTitle className="text-2xl text-slate-950">{journal.name}</CardTitle>
        <p className="text-sm leading-7 text-slate-600">{journal.summary}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">平均评分</p>
            <p className="mt-2 font-display text-2xl text-slate-950">{journal.averageScore}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">影响因子</p>
            <p className="mt-2 font-display text-2xl text-slate-950">{journal.impactFactor}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">录用率</p>
            <p className="mt-2 font-display text-2xl text-slate-950">{formatPercent(journal.acceptanceRate)}</p>
          </div>
        </div>
        <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-cyan-700" />
            审稿周期约 {journal.reviewSpeedDays} 天
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-700" />
            热点文献 {journal.trendCount} 篇
          </div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-cyan-700" />
            {toZhRegion(journal.region)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {journal.topics.map((topic) => (
            <Badge key={topic.slug} variant="secondary">
              {topic.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
