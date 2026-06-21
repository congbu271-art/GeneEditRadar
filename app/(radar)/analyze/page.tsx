import type { Metadata } from "next";

import { AnalysisWorkbench } from "@/components/analysis-workbench";

export const metadata: Metadata = {
  title: "智能分析",
  description: "输入关键词或论文信息，获取领域概览、技术迁移路径、衍生选题与评估建议。",
};

export default function AnalyzePage() {
  return <AnalysisWorkbench />;
}
