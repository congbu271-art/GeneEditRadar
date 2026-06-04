export type LiteratureRssFeed = {
  label: string;
  url: string;
  publisher: string;
  priority: "high" | "medium";
};

export const defaultGeneEditingRssFeeds: LiteratureRssFeed[] = [
  {
    label: "Nature Biotechnology AOP",
    url: "https://www.nature.com/nbt/journal/vaop/ncurrent/rss.rdf",
    publisher: "Springer Nature",
    priority: "high",
  },
  {
    label: "Nature Methods AOP",
    url: "https://www.nature.com/nmeth/journal/vaop/ncurrent/rss.rdf",
    publisher: "Springer Nature",
    priority: "high",
  },
  {
    label: "Nature Genetics AOP",
    url: "https://www.nature.com/ng/journal/vaop/ncurrent/rss.rdf",
    publisher: "Springer Nature",
    priority: "medium",
  },
];

export function getConfiguredRssFeeds() {
  const raw = process.env.LITERATURE_RSS_FEEDS?.trim();

  if (!raw) {
    return defaultGeneEditingRssFeeds;
  }

  const configuredFeeds = raw
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean)
    .map<LiteratureRssFeed>((url) => ({
      label: url,
      url,
      publisher: "Configured RSS",
      priority: "medium",
    }));

  return [...defaultGeneEditingRssFeeds, ...configuredFeeds];
}
