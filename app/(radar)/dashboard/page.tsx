import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Beaker, BrainCircuit, ChevronRight, ExternalLink, FlaskConical, Radar, Sparkles } from "lucide-react";

import { getSubscriptionIntelligence } from "@/lib/literature";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PaperCard } from "@/components/paper-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardMetrics, enrichedIdeas, enrichedJournals, enrichedPapers, signalWindows, topicSignalMap } from "@/lib/radar-data";
import {
  getLocalizedIdeaCopy,
  getZhPaperAbstract,
  toZhArticleType,
  toZhExtractionValue,
  toZhFilterItem,
  toZhIdeaType,
  toZhMatchReason,
  toZhSourceError,
  toZhSourceName,
} from "@/lib/ui-zh";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const spotlightPaper = enrichedPapers[0];
  const { papers: matchedPapers, sourceStatuses, usedFallback } = await getSubscriptionIntelligence();
  const topMatchedPapers = matchedPapers.slice(0, 4);
  const topIdeas = enrichedIdeas.slice(0, 4);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="文献雷达"
        title="查看哪些论文正在改变当前研究判断。"
        description="这个最小可用版将内置模拟基因编辑文献组织成一套可用的发现流程：高信号初筛、订阅监测、选题捕捉与轻量级评估。"
        actions={
          <>
            <Button asChild>
              <Link href="/papers">
                查看文献
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/ideas">
                查看选题
                <BrainCircuit className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="高信号文献"
          value={dashboardMetrics.highSignalPapers.toString()}
          detail="综合评分高于 88，兼顾新颖性、热度、证据与转化潜力。"
        />
        <MetricCard
          label="启用中订阅"
          value={dashboardMetrics.activeSubscriptions.toString()}
          detail="覆盖基因、期刊与专题簇的已保存监测规则。"
        />
        <MetricCard
          label="跟踪期刊"
          value={dashboardMetrics.trackedJournals.toString()}
          detail="在持续雷达回顾中具有足够信号密度的期刊窗口。"
        />
        <MetricCard
          label="文献平均分"
          value={dashboardMetrics.averageCompositeScore.toString()}
          detail="用于衡量当前种子文献整体质量的快速基准。"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">文献收集</Badge>
            <CardTitle className="text-3xl">外部检索状态</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {sourceStatuses.map((status) => (
              <div key={status.source} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl">{toZhSourceName(status.source)}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {status.ok ? `已收集并标准化 ${status.count} 条记录` : toZhSourceError(status.error)}
                    </p>
                  </div>
                  <Badge variant={status.ok ? "success" : "warning"}>{status.ok ? "在线" : "回退"}</Badge>
                </div>
              </div>
            ))}
            <div className="rounded-[28px] border border-primary/20 bg-primary/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">回退模式</p>
              <p className="mt-3 font-display text-2xl text-primary">{usedFallback ? "已启用" : "待命"}</p>
              <p className="mt-2 text-sm text-slate-200">
                {usedFallback
                  ? "由于外部 API 未返回可用记录，当前仪表盘正在使用内置模拟文献集。"
                  : "在线文献已在展示前完成标准化、去重与订阅匹配。"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">订阅匹配</Badge>
            <CardTitle className="text-3xl">当前最值得优先查看的文献</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {topMatchedPapers.length > 0 ? (
              topMatchedPapers.map((paper) => (
                <div key={paper.id} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{paper.matches[0]?.subscriptionLabel ?? "已匹配"}</Badge>
                        <Badge variant="secondary">{toZhSourceName(paper.primarySource)}</Badge>
                        <Badge variant="warning">信号 {paper.signalScore}</Badge>
                      </div>
                      <p className="mt-3 font-display text-2xl">{paper.title}</p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {getZhPaperAbstract(paper.appPaperId, paper.abstract) || "该数据源未提供摘要。"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                      <p className="font-display text-3xl text-primary">{paper.topMatchScore}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-primary/80">匹配分</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">期刊</p>
                      <p className="mt-2 text-white">{paper.journal || "未指定"}</p>
                      <p className="mt-2 text-muted-foreground">{paper.publishedAt ? formatDate(paper.publishedAt) : "日期缺失"}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">匹配原因</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {paper.matches[0]?.reasons.slice(0, 4).map((reason) => (
                          <Badge key={reason} variant="secondary">
                            {toZhMatchReason(reason)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">生物学维度</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[...paper.organisms, ...paper.editorTypes].slice(0, 5).map((item) => (
                          <Badge key={item} variant="secondary">
                            {toZhFilterItem(item)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 text-sm text-slate-200">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary/80">编辑工具</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.editingTool)}</p>
                    </div>
                    <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 text-sm text-slate-200">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary/80">递送方式</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.deliveryMethod)}</p>
                    </div>
                    <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 text-sm text-slate-200">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary/80">靶基因</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.targetGene)}</p>
                    </div>
                    <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 text-sm text-slate-200">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary/80">解析方式</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.extractionMethod)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">编辑效率</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.editingEfficiency)}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">表型验证</p>
                      <p className="mt-2">{toZhExtractionValue(paper.extraction.phenotypeValidation)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Radar className="h-4 w-4 text-primary" />
                      匹配订阅 {paper.matches.length} 条 · {paper.authors.slice(0, 3).join(", ") || "作者信息缺失"}
                    </div>
                    {paper.appPaperId ? (
                      <Button asChild variant="outline">
                        <Link href={`/paper/${paper.appPaperId}` as Route}>
                          打开种子文献
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : paper.url ? (
                      <Button asChild variant="outline">
                        <a href={paper.url} target="_blank" rel="noreferrer">
                          打开原始来源
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <Badge variant="secondary">来源链接缺失</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
                当前暂无文献达到订阅匹配阈值。
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <PaperCard paper={spotlightPaper} />
        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">为何值得关注</Badge>
            <CardTitle className="text-3xl">当前雷达信号</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {signalWindows.map((signal) => (
              <div key={signal.label} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{signal.label}</p>
                <p className="mt-3 font-display text-4xl">{signal.value}</p>
                <p className="mt-2 text-sm text-slate-300">{signal.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">专题分布</Badge>
            <CardTitle className="text-3xl">高质量文献主要聚集在哪里</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {topicSignalMap.map((topic) => (
              <div key={topic.slug} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xl">{topic.label}</p>
                    <p className="mt-2 text-sm text-slate-300">{topic.description}</p>
                  </div>
                  <div className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                    <p className="font-display text-2xl text-primary">{topic.averageScore}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary/80">平均分</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>种子集文献 {topic.paperCount} 篇</span>
                  <Link href="/papers" className="flex items-center gap-1 text-primary">
                    打开列表
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">衍生选题机会</Badge>
            <CardTitle className="text-3xl">论文正在衍生出的规则型研究机会</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {topIdeas.map((idea) => {
              const localized = getLocalizedIdeaCopy(idea);

              return (
                <div key={idea.id} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm uppercase tracking-[0.2em]">{toZhIdeaType(idea.ideaType)}</span>
                    </div>
                    <p className="mt-3 font-display text-2xl">{localized.title}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{localized.thesis}</p>
                  </div>
                  <div className="rounded-3xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                    <p className="font-display text-3xl text-primary">{idea.score}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary/80">评分</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    {toZhArticleType(idea.articleTypeHint)}
                  </div>
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    {idea.topic?.label ?? toZhIdeaType(idea.ideaType)}
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    {idea.paper?.title ?? "人工录入"}
                  </div>
                </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {enrichedJournals.slice(0, 2).map((journal) => (
          <Card key={journal.slug} className="glass-panel">
            <CardHeader>
              <Badge variant="secondary">{journal.name}</Badge>
              <CardTitle className="text-3xl">期刊脉冲</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-7 text-slate-300">{journal.summary}</p>
              <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <p>影响因子</p>
                  <p className="mt-2 font-display text-2xl text-white">{journal.impactFactor}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <p>平均文献分</p>
                  <p className="mt-2 font-display text-2xl text-white">{journal.averageScore}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <p>热点数量</p>
                  <p className="mt-2 font-display text-2xl text-white">{journal.trendCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
