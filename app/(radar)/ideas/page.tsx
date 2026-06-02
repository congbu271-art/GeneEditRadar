import { IdeaCard } from "@/components/idea-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedIdeas } from "@/lib/radar-data";
import { getResearchIdeasPerPaper, getResearchIdeaTypeSummary } from "@/lib/research-ideas";
import { toZhIdeaType } from "@/lib/ui-zh";

export default function IdeasPage() {
  const ideaTypeSummary = getResearchIdeaTypeSummary();
  const ideasPerPaper = getResearchIdeasPerPaper();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="选题机会"
        title="把每篇论文转化为可继续推进的选题地图。"
        description="每篇种子论文都会生成一组规则驱动的衍生选题，覆盖迁移、优化、应用与安全性方向，并附带初步评分与发表定位。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">工作流框架</Badge>
            <CardTitle className="text-3xl">衍生选题的基础流程</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-slate-300">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              先把论文中的编辑工具、研究物种、递送方式与表型信号解析为结构化字段。
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              再围绕工具迁移、物种迁移、递送优化、编辑器优化、性状应用与脱靶控制，为每篇论文生成 3-5 个衍生方向。
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              在投入实验资源之前，对每个方向进行新颖性、可行性、发表潜力与竞争风险的初步评估。
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">生成覆盖范围</Badge>
            <CardTitle className="text-3xl">当前规则集正在产出什么</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {ideaTypeSummary.map((item) => (
              <div key={item.ideaType} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{toZhIdeaType(item.ideaType)}</p>
                <p className="mt-3 font-display text-3xl text-primary">{item.count}</p>
                <p className="mt-2 text-sm text-slate-300">该类别当前生成的选题数</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {ideasPerPaper.map((item) => (
          <div key={item.paperId} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">按论文统计</p>
            <p className="mt-3 font-display text-3xl text-primary">{item.count}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.paperTitle}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {enrichedIdeas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </section>
    </div>
  );
}
