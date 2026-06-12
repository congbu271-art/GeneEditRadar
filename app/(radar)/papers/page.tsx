import { Search, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PaperCard } from "@/components/paper-card";
import { SemanticSearch } from "@/components/semantic-search";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichedPapers, topicSignalMap } from "@/lib/radar-data";

export default function PapersPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="最新文献"
        title="从基因编辑文献中完成可操作的初筛。"
        description="每篇文献都附带基础商业评分、临床信号摘要，以及后续构建订阅、选题与评估流程所需的基因与专题元数据。"
      />

      <SemanticSearch />

      <section className="grid gap-6 lg:grid-cols-2">
        {enrichedPapers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </section>
    </div>
  );
}
