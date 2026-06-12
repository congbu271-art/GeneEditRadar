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
  Radar,
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
    <div className="relative min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-8 px-4 py-6 lg:flex-row lg:px-10 lg:py-10">
        <aside className="w-full glass-panel border-none shadow-soft rounded-[3rem] p-8 text-slate-950 lg:sticky lg:top-10 lg:h-[calc(100vh-5rem)] lg:w-[340px] lg:flex-none flex flex-col">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-600/20 text-white shrink-0">
              <Radar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700/70 mb-0.5">研究工作台</p>
              <p className="font-display text-2xl font-bold tracking-tight text-slate-900">
                <span className="text-gradient">GeneRadar</span>
              </p>
            </div>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-hide">
            <div className="rounded-3xl bg-bio-gradient p-5 border border-cyan-50/50 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">系统引擎</span>
                <Badge className="bg-white/80 text-cyan-700 border-none shadow-none text-[10px] px-2 py-0" suppressHydrationWarning>
                  {isDemoMode ? "演示版" : "生产级"}
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-400">分析能力</span>
                  <span className="text-slate-700">混合智能 (Rule+LLM)</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-400">语义检索</span>
                  <span className="text-cyan-700">已激活 (RAG)</span>
                </div>
              </div>
            </div>

            <nav className="grid gap-2">
              {navigationItems.map((item) => {
                const Icon = iconMap[item.href];

                return (
                  <div
                    key={item.href}
                    className="group relative flex items-center gap-4 rounded-2xl px-4 py-3 transition-all hover:bg-slate-50"
                  >
                    <div className="relative z-10 flex items-center justify-center h-5 w-5 text-cyan-500/20 group-hover:text-cyan-600 transition-colors">
                      <Icon className="h-full w-full" />
                    </div>
                    <NavLink href={item.href} label={item.label} className="relative z-10 font-medium text-sm text-slate-500 group-hover:text-slate-900 transition-colors" />
                    <div className="absolute inset-0 bg-white shadow-soft rounded-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none border border-slate-100/50" />
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100/50">
            <div className="rounded-3xl bg-cyan-50/50 p-6 text-slate-950 shadow-sm border border-cyan-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.08] pointer-events-none">
                <Activity className="h-12 w-12 text-cyan-600" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Activity className="h-4 w-4 text-cyan-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700/70">使用建议</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed relative z-10 font-medium">
                先在“最新文献”页完成初筛，再到“选题机会”页发散方向，最后用“选题评估”快速判断研究价值。
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
