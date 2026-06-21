import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://geneeditradar.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "基因编辑雷达 GeneRadar",
    template: "%s · 基因编辑雷达",
  },
  description: "面向基因编辑方向研究生与博士生的文献雷达、选题评估与智能分析工作台。",
  keywords: ["基因编辑", "CRISPR", "碱基编辑", "先导编辑", "文献雷达", "选题评估", "研究工作台"],
  authors: [{ name: "GeneEditRadar" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    siteName: "基因编辑雷达",
    title: "基因编辑雷达 GeneRadar",
    description: "面向基因编辑方向研究生与博士生的文献雷达、选题评估与智能分析工作台。",
  },
  twitter: {
    card: "summary_large_image",
    title: "基因编辑雷达 GeneRadar",
    description: "面向基因编辑方向研究生与博士生的文献雷达、选题评估与智能分析工作台。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#06b6d4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
