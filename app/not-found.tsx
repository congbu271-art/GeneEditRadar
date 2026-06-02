import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel max-w-xl rounded-[34px] border border-white/10 p-8 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-primary">未找到记录</p>
        <h1 className="mt-4 font-display text-4xl">该文献当前不在雷达范围内。</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          当前请求的记录不在内置模拟种子数据集中。你可以返回文献雷达首页，或继续浏览文献列表。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">文献雷达</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/papers">最新文献</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
