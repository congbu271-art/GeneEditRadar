import type { MetadataRoute } from "next";

import { navigationItems } from "@/lib/radar-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://geneeditradar.vercel.app";
  const lastChange = new Date();

  return navigationItems.map((item) => ({
    url: `${siteUrl}${item.href}`,
    lastModified: lastChange,
    changeFrequency: "weekly",
    priority: item.href === "/dashboard" ? 1 : 0.8,
  }));
}
