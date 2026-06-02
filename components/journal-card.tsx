import { Clock3, Globe2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedJournals } from "@/lib/radar-data";
import { toZhOpenAccessBadge, toZhRegion } from "@/lib/ui-zh";
import { formatPercent } from "@/lib/utils";

type EnrichedJournal = (typeof enrichedJournals)[number];

export function JournalCard({ journal }: { journal: EnrichedJournal }) {
  return (
    <Card className="glass-panel h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={journal.openAccess ? "success" : "secondary"}>{toZhOpenAccessBadge(journal.openAccess)}</Badge>
          <span className="text-sm text-muted-foreground">覆盖评分 {journal.coverageScore}</span>
        </div>
        <CardTitle className="text-2xl">{journal.name}</CardTitle>
        <p className="text-sm leading-7 text-slate-300">{journal.summary}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">平均评分</p>
            <p className="mt-2 font-display text-2xl">{journal.averageScore}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">影响因子</p>
            <p className="mt-2 font-display text-2xl">{journal.impactFactor}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">录用率</p>
            <p className="mt-2 font-display text-2xl">{formatPercent(journal.acceptanceRate)}</p>
          </div>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            审稿周期约 {journal.reviewSpeedDays} 天
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            热点文献 {journal.trendCount} 篇
          </div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" />
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
