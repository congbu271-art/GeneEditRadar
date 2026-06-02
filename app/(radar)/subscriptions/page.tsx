import { BellRing, Layers3, Sparkles } from "lucide-react";

import { getSubscriptionIntelligence } from "@/lib/literature";
import { PageHeader } from "@/components/page-header";
import { SubscriptionCard } from "@/components/subscription-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toZhSourceName } from "@/lib/ui-zh";

export default async function SubscriptionsPage() {
  const { subscriptionOverviews, sourceStatuses, usedFallback } = await getSubscriptionIntelligence();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="订阅匹配"
        title="为需要持续关注的方向建立订阅规则。"
        description="当前订阅会基于关键词、作者、期刊、研究物种与编辑类型对收集到的文献进行匹配；当外部数据源不可用时，将自动回退到内置模拟数据。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <BellRing className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.2em]">模拟编辑器</span>
            </div>
            <CardTitle className="text-3xl">新订阅草案</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input defaultValue="眼科递送监测" aria-label="订阅名称" />
            <Input defaultValue="每周频率 · 评分阈值 84+" aria-label="订阅频率与阈值" />
            <Textarea defaultValue="重点跟踪局部递送、低炎症负担，以及任何有助于降低视网膜项目转化风险的研究信号。" />
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">匹配引擎</Badge>
            <CardTitle className="text-3xl">当前文献匹配如何运行</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-slate-300">
            <div className="flex items-start gap-3 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <Layers3 className="mt-1 h-4 w-4 flex-none text-primary" />
              <p>复合筛选器会同时读取自由关键词、指定作者、期刊名称、研究物种标签与编辑类型。</p>
            </div>
            <div className="flex items-start gap-3 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <Sparkles className="mt-1 h-4 w-4 flex-none text-primary" />
              <p>
                数据源状态：
                {" "}
                {sourceStatuses.map((status) => `${toZhSourceName(status.source)} ${status.ok ? `正常（${status.count}）` : "回退"}`).join(" · ")}
                {usedFallback ? " · 当前已启用内置模拟回退" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {subscriptionOverviews.map((subscription) => (
          <SubscriptionCard key={subscription.id} subscription={subscription} />
        ))}
      </section>
    </div>
  );
}
