import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        <p className="text-sm font-medium">正在加载研究工作台…</p>
      </div>
    </div>
  );
}
