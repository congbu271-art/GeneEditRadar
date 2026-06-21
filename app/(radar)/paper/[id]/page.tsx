import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookCopy, Dna, FlaskConical, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ScoreBars } from "@/components/score-bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedIdeas, enrichedPapers } from "@/lib/radar-data";
import { buildExtractionSourceFromRadarPaper } from "@/lib/paper-extraction";
import { extractGeneEditingDetails } from "@/lib/paper-extraction-llm";
import {
  getZhPaperAbstract,
  toZhArticleType,
  getLocalizedIdeaCopy,
  toZhDiseaseArea,
  toZhExtractionValue,
  toZhIdeaType,
  toZhModality,
  toZhPaperStage,
  toZhPaperStatus,
} from "@/lib/ui-zh";
import { formatDate } from "@/lib/utils";

type PaperDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PaperDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const paper = enrichedPapers.find((item) => item.id === id || item.slug === id);

  if (!paper) {
    return { title: "文献未找到" };
  }

  return {
    title: paper.title,
    description: getZhPaperAbstract(paper.id, paper.abstract).slice(0, 160),
  };
}

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const { id } = await params;
  const paper = enrichedPapers.find((item) => item.id === id || item.slug === id);

  if (!paper) {
    notFound();
  }

  const linkedIdeas = enrichedIdeas.filter((idea) => idea.paperId === paper.id);
  const extraction = await extractGeneEditingDetails(buildExtractionSourceFromRadarPaper(paper));
  const extractionFields = [
    ["编辑工具", extraction.editingTool],
    ["编辑器变体", extraction.editorVariant],
    ["编辑类型", extraction.editingType],
    ["研究物种", extraction.organism],
    ["递送方式", extraction.deliveryMethod],
    ["靶基因", extraction.targetGene],
    ["目标性状", extraction.targetTrait],
    ["编辑效率", extraction.editingEfficiency],
    ["脱靶分析", extraction.offTargetAnalysis],
    ["表型验证", extraction.phenotypeValidation],
    ["主要创新点", extraction.mainInnovation],
    ["局限性", extraction.limitations],
    ["论文类型", extraction.paperType],
    ["衍生选题机会", extraction.followUpOpportunities],
  ] as const;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow={`${toZhPaperStatus(paper.status)} 文献`}
        title={paper.title}
        description={getZhPaperAbstract(paper.id, paper.abstract)}
        actions={
          paper.doi ? (
            <Button asChild variant="outline">
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">
                查看 DOI
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              DOI 未报道
            </Button>
          )
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{toZhModality(paper.modality)}</Badge>
              <Badge variant="secondary">{toZhDiseaseArea(paper.diseaseArea)}</Badge>
              <Badge variant="warning">{toZhPaperStage(paper.stage)}</Badge>
            </div>
            <CardTitle className="text-3xl">这篇论文为何值得重点阅读</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">核心结论</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{paper.keyTakeaway}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">临床信号</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{paper.clinicalSignal}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">研究与转化信号</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{paper.marketSignal}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">评分拆解</Badge>
            <CardTitle className="text-3xl">研究价值快照</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="rounded-[32px] border border-primary/20 bg-primary/10 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-primary/80">综合评分</p>
              <p className="mt-3 font-display text-6xl text-primary">{paper.compositeScore}</p>
            </div>
            <ScoreBars
              scores={[
                { label: "新颖性", value: paper.noveltyScore },
                { label: "热度", value: paper.momentumScore },
                { label: "转化潜力", value: paper.translationalScore },
                { label: "证据强度", value: paper.evidenceScore },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <Badge variant="secondary">元数据</Badge>
            <CardTitle className="text-3xl">研究画像</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <div className="flex items-center gap-2 text-primary">
                <BookCopy className="h-4 w-4" />
                <span className="text-sm uppercase tracking-[0.2em]">期刊</span>
              </div>
              <p className="mt-4 font-display text-2xl">{paper.journal.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{formatDate(paper.publishedAt)}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" />
                <span className="text-sm uppercase tracking-[0.2em]">作者</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                {paper.authors.map((author) => (
                  <p key={author.id}>
                    {author.name}
                    <span className="text-muted-foreground"> · {author.affiliation}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <div className="flex items-center gap-2 text-primary">
                <Dna className="h-4 w-4" />
                <span className="text-sm uppercase tracking-[0.2em]">靶点</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {paper.genes.map((gene) => (
                  <Badge key={gene.symbol} variant="secondary">
                    {gene.symbol}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {paper.topics.map((topic) => (
                  <Badge key={topic.slug}>{topic.label}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">相关选题</Badge>
            <CardTitle className="text-3xl">可继续推进的方向</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {linkedIdeas.length > 0 ? (
              linkedIdeas.map((idea) => {
                const localized = getLocalizedIdeaCopy(idea);

                return (
                  <div key={idea.id} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex items-center gap-2 text-primary">
                    <FlaskConical className="h-4 w-4" />
                    <span className="text-sm uppercase tracking-[0.2em]">{toZhIdeaType(idea.ideaType)}</span>
                  </div>
                  <p className="mt-3 font-display text-2xl">{localized.title}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{localized.thesis}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    评分 {idea.score} · {toZhArticleType(idea.articleTypeHint)}
                  </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
                当前这篇论文尚未关联衍生选题。
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">结构化解析</Badge>
              <Badge variant={extraction.extractionMethod === "rule-based+llm" ? "success" : "secondary"}>
                {toZhExtractionValue(extraction.extractionMethod)}
              </Badge>
            </div>
            <CardTitle className="text-3xl">基因编辑字段解析工作表</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {extractionFields.map(([label, value]) => (
              <div key={label} className="rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">{toZhExtractionValue(value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
