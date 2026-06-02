import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "基因编辑雷达",
  description: "面向基因编辑方向研究生与博士生的文献雷达与选题评估界面。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
