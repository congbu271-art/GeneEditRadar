import type { Metadata } from "next";
import { BellRing, Mail, Newspaper, Rss, Send, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "文献通知",
  description: "订阅命中通知与文献摘要投递配置。",
};

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const notificationSources = [
  { label: "PubMed", detail: "6 小时同步" },
  { label: "Europe PMC", detail: "6 小时同步" },
  { label: "Crossref", detail: "6 小时同步" },
  { label: "期刊 RSS / AOP", detail: "每小时同步" },
];

const cadenceOptions = ["每日汇总", "每周汇总", "双周汇总"];

export default function NotificationsPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="文献通知"
        title="订阅关键词、PI 与期刊来源的新文献提醒。"
        description="通知入口会对接后台定时采集、订阅匹配与邮件 digest 去重记录；当前页面提供可展示的规则草案界面。"
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>通知规则</Badge>
              <Badge variant="secondary">草案</Badge>
            </div>
            <CardTitle className="text-3xl">订阅文献通知</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <div className="grid gap-3">
                <label htmlFor="notification-email" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  接收邮箱
                </label>
                <Input id="notification-email" placeholder="researcher@example.com" type="email" />
              </div>

              <div className="grid gap-3">
                <label htmlFor="notification-keywords" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BellRing className="h-4 w-4 text-primary" />
                  关键词 / 检索式
                </label>
                <Textarea
                  id="notification-keywords"
                  className="min-h-28"
                  defaultValue={"prime editing rice\nbase editor wheat\nCas12a plant genome editing"}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-3">
                  <label htmlFor="notification-pi" className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    PI / 作者姓名
                  </label>
                  <Input id="notification-pi" defaultValue="David Liu; Caixia Gao" />
                </div>
                <div className="grid gap-3">
                  <label htmlFor="notification-journals" className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Newspaper className="h-4 w-4 text-primary" />
                    期刊 / RSS 来源
                  </label>
                  <Input id="notification-journals" defaultValue="Nature Biotechnology; Nature Methods" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
              <p className="text-sm font-medium text-foreground">推送频率</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {cadenceOptions.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-[24px] border px-4 py-4 text-left text-sm transition-colors ${
                      index === 0
                        ? "border-primary/30 bg-primary/10 text-white shadow-glow"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full justify-between">
              保存通知规则草案
              <Send className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <Badge variant="secondary">采集来源</Badge>
            <CardTitle className="text-3xl">最新文献进入通知队列的路径</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notificationSources.map((source) => (
              <div key={source.label} className="flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                    <Rss className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-display text-xl">{source.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{source.detail}</p>
                  </div>
                </div>
                <Badge variant="success">已接入</Badge>
              </div>
            ))}

            <div className="rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-7 text-amber-100">
              启用真实邮件通知需要在 Netlify 配置外部 Postgres `DATABASE_URL`，并接入 Resend 或 SendGrid。演示模式下规则不会写入数据库。
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
