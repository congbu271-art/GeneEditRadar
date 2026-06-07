import type { ReactNode } from "react";
import {
  Activity,
  Beaker,
  BookOpenText,
  BrainCircuit,
  BellRing,
  FolderKanban,
  type LucideIcon,
  Newspaper,
  Rss,
  ScanSearch,
} from "lucide-react";

import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui/badge";
import { navigationItems } from "@/lib/radar-data";

const iconMap: Record<string, LucideIcon> = {
  "/dashboard": Activity,
  "/papers": Newspaper,
  "/subscriptions": Rss,
  "/notifications": BellRing,
  "/analyze": ScanSearch,
  "/ideas": BrainCircuit,
  "/evaluate": Beaker,
  "/journals": BookOpenText,
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const isDemoMode = !process.env.DATABASE_URL;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:56px_56px] opacity-[0.08]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full rounded-[28px] border border-slate-200 bg-white/90 p-5 text-slate-950 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[300px] lg:flex-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-cyan-700">研究工作台</p>
              <p className="font-display text-xl font-semibold text-slate-950">基因编辑雷达</p>
              <p className="mt-1 text-sm text-slate-500">文献监测 · 智能分析 · 选题评估</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-700">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">运行状态</span>
              <Badge variant={isDemoMode ? "warning" : "success"}>{isDemoMode ? "演示版" : "生产数据"}</Badge>
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>分析引擎</span>
                <span className="font-medium text-slate-950">规则引擎</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>文献来源</span>
                <span className="font-medium text-slate-950">{isDemoMode ? "示例数据 + 回退" : "外部来源 + 数据库"}</span>
              </div>
            </div>
          </div>

          {isDemoMode ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
              当前为演示版，部分结果基于示例数据和规则分析生成。
            </div>
          ) : null}

          <nav className="mt-5 grid gap-1.5">
            {navigationItems.map((item) => {
              const Icon = iconMap[item.href];

              return (
                <div
                  key={item.href}
                  className="group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100"
                >
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors group-hover:border-cyan-200 group-hover:text-cyan-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <NavLink href={item.href} label={item.label} />
                </div>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-950">
              <Activity className="h-4 w-4 text-cyan-700" />
              使用建议
            </div>
            <p>先在“最新文献”页完成初筛，再到“选题机会”页发散方向，最后用“选题评估”页快速判断研究价值。</p>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
