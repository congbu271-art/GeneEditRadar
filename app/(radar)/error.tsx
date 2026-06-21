"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-6 rounded-[2rem] glass-panel border-none shadow-soft p-10 text-center max-w-md">
        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-display font-bold text-slate-900">加载出错</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            当前页面数据加载失败，可能是外部文献源暂时不可用。可以重试，或稍后再试。
          </p>
        </div>
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          重试
        </Button>
      </div>
    </div>
  );
}
