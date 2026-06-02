import { JournalCard } from "@/components/journal-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedJournals } from "@/lib/radar-data";

export default function JournalsPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="期刊匹配"
        title="判断哪些期刊值得持续跟踪。"
        description="期刊视图综合质量、审稿速度、开放程度与专题密度，帮助用户在有限阅读时间内完成优先级排序。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">筛选逻辑</Badge>
            <CardTitle className="text-3xl">这些期刊为何被纳入视野</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-slate-300">
            <p>覆盖评分主要反映期刊与递送、编辑化学、细胞治疗和罕见病等主题的契合度。</p>
            <p>审稿速度有助于估计该期刊对平台型增量进展的显化速度。</p>
            <p>录用率与开放获取属性，则为判断论文来源广度提供背景信息。</p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">快速比较</Badge>
            <CardTitle className="text-3xl">期刊雷达一览</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {enrichedJournals.map((journal) => (
              <div key={journal.slug} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <p className="font-display text-xl">{journal.name}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div>
                    <p>覆盖评分</p>
                    <p className="mt-2 font-display text-2xl text-white">{journal.coverageScore}</p>
                  </div>
                  <div>
                    <p>热点文献数</p>
                    <p className="mt-2 font-display text-2xl text-white">{journal.trendCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {enrichedJournals.map((journal) => (
          <JournalCard key={journal.slug} journal={journal} />
        ))}
      </section>
    </div>
  );
}
