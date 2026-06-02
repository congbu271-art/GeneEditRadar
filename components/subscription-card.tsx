import { BellRing, Filter, Radar } from "lucide-react";

import type { SubscriptionOverview } from "@/lib/literature";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toZhCadence, toZhFilterItem } from "@/lib/ui-zh";

export function SubscriptionCard({ subscription }: { subscription: SubscriptionOverview }) {
  return (
    <Card className="glass-panel h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={subscription.isActive ? "success" : "secondary"}>
            {subscription.isActive ? "启用中" : "已暂停"}
          </Badge>
          <span className="text-sm text-muted-foreground">{toZhCadence(subscription.cadence)}</span>
        </div>
        <CardTitle className="text-2xl">{subscription.label}</CardTitle>
        <p className="text-sm leading-7 text-slate-300">{subscription.notes}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            阈值要求：信号评分 {subscription.signalThreshold}+
          </div>
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            当前匹配文献 {subscription.matchingPaperCount} 篇
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            最高匹配分 {subscription.bestMatchScore}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {subscription.filterSummary.map((item) => (
            <Badge key={item} variant="secondary">
              {toZhFilterItem(item)}
            </Badge>
          ))}
        </div>
        {subscription.matchedPaperTitles.length > 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">优先匹配文献</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              {subscription.matchedPaperTitles.map((title) => (
                <p key={title}>{title}</p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
