import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Beaker,
  BookOpenText,
  BrainCircuit,
  FolderKanban,
  type LucideIcon,
  Newspaper,
  Rss,
  ScanSearch,
} from "lucide-react";

import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { navigationItems } from "@/lib/radar-data";

const iconMap: Record<string, LucideIcon> = {
  "/dashboard": Activity,
  "/papers": Newspaper,
  "/subscriptions": Rss,
  "/analyze": ScanSearch,
  "/ideas": BrainCircuit,
  "/evaluate": Beaker,
  "/journals": BookOpenText,
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const isDemoMode = !process.env.DATABASE_URL;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:56px_56px] opacity-[0.04]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="glass-panel w-full rounded-[32px] border border-white/10 p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[290px] lg:flex-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl font-semibold">基因编辑雷达</p>
              <p className="mt-1 text-sm text-muted-foreground">面向基因编辑文献的信号化筛选界面。</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
            <Badge variant="success" className="mb-3">
              最小可用版
            </Badge>
            <p className="font-display text-lg">优先追踪值得二次精读的文献。</p>
            <p className="mt-2 text-sm text-muted-foreground">
              当前仍以内置模拟数据为主，但整体结构已为后续接入 Prisma 数据流预留好接口。
            </p>
            <Button asChild className="mt-4 w-full justify-between">
              <Link href="/dashboard">
                打开文献雷达
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isDemoMode ? (
            <div className="mt-4 rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
              当前为演示版，部分结果基于示例数据和规则分析生成。
            </div>
          ) : null}

          <nav className="mt-6 grid gap-2">
            {navigationItems.map((item) => {
              const Icon = iconMap[item.href];

              return (
                <div key={item.href} className="group flex items-center gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <NavLink href={item.href} label={item.label} />
                </div>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/30 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-primary" />
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
