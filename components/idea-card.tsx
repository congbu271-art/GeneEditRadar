import { Lightbulb, ShieldCheck, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedIdeas } from "@/lib/radar-data";
import { getLocalizedIdeaCopy, toZhIdeaStage, toZhIdeaType, toZhJournalTier } from "@/lib/ui-zh";

type EnrichedIdea = (typeof enrichedIdeas)[number];

export function IdeaCard({ idea }: { idea: EnrichedIdea }) {
  const localized = getLocalizedIdeaCopy(idea);

  return (
    <Card className="glass-panel h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{toZhIdeaStage(idea.stage)}</Badge>
            <Badge variant="secondary">{toZhIdeaType(idea.ideaType)}</Badge>
          </div>
          <span className="font-display text-2xl text-primary">{idea.score}</span>
        </div>
        <CardTitle className="text-2xl">{localized.title}</CardTitle>
        <p className="text-sm leading-7 text-slate-300">{localized.thesis}</p>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
          <Target className="mt-0.5 h-4 w-4 flex-none text-primary" />
          <div>
            <p className="text-foreground">优先适配团队</p>
            <p className="mt-1">{localized.customer}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-primary" />
          <div>
            <p className="text-foreground">最低实验数据包</p>
            <p className="mt-1">{localized.wedge}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-primary" />
          <div>
            <p className="text-foreground">发表价值与风险</p>
            <p className="mt-1">{localized.moat}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-amber-200/90">风险提示</p>
            <p className="mt-1">{localized.risk}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">推荐期刊层级</p>
            <p className="mt-1">{toZhJournalTier(idea.journalTierHint)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
