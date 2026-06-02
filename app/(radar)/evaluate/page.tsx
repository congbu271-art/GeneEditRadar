import { EvaluationWorkbench } from "@/components/evaluation-workbench";
import { PageHeader } from "@/components/page-header";

export default function EvaluatePage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="选题评估"
        title="用一致的评分框架检验衍生研究方向。"
        description="输入一个基因编辑研究设想，系统将自动判别其方向类型，并给出新颖性、可行性、发表潜力、竞争风险与最低实验数据包建议。"
      />
      <EvaluationWorkbench />
    </div>
  );
}
