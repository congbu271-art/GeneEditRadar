import { Search, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PaperCard } from "@/components/paper-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enrichedPapers, topicSignalMap } from "@/lib/radar-data";

export default function PapersPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="最新文献"
        title="从基因编辑文献中完成可操作的初筛。"
        description="每篇文献都附带基础商业评分、临床信号摘要，以及后续构建订阅、选题与评估流程所需的基因与专题元数据。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Search className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.2em]">模拟检索</span>
            </div>
            <CardTitle className="text-3xl">快速筛选界面</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input defaultValue="prime editing, 递送, 罕见病" aria-label="文献模拟检索" />
            <div className="grid gap-3 md:grid-cols-2">
              {topicSignalMap.map((topic) => (
                <div key={topic.slug} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-lg">{topic.label}</p>
                    <Badge variant="secondary">{topic.paperCount} 篇</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{topic.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.2em]">模拟排序</span>
            </div>
            <CardTitle className="text-3xl">当前版本如何判断文献质量</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-slate-300">
            <p>新颖性反映该编辑设计相对于现有领域工作的差异化程度。</p>
            <p>热度综合考虑期刊质量、发表时间与该主题是否正在升温。</p>
            <p>转化潜力衡量这组结果是否会改变后续可构建、可资助或可推进临床验证的方向。</p>
            <p>证据强度用于校正模型质量与数据包说服力，避免只看概念亮点。</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {enrichedPapers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </section>
    </div>
  );
}
