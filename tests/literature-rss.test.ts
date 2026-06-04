import assert from "node:assert/strict";
import test from "node:test";

import { collectRssLiterature } from "@/lib/literature-rss";

test("collectRssLiterature parses RSS items and keeps gene-editing records", async () => {
  const originalFetch = globalThis.fetch;
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>Example Feed</title>
        <item>
          <title>Prime editing improves rice trait engineering</title>
          <link>https://example.org/articles/10.1234/example.2026.001</link>
          <description>Prime editing enables precise genome editing in rice.</description>
          <pubDate>Thu, 04 Jun 2026 00:00:00 GMT</pubDate>
          <dc:creator>Li Wang</dc:creator>
        </item>
        <item>
          <title>Unrelated protein structure report</title>
          <link>https://example.org/unrelated</link>
          <description>This record describes protein folding and crystallography.</description>
        </item>
      </channel>
    </rss>`;

  globalThis.fetch = async () =>
    new Response(xml, {
      status: 200,
      headers: { "content-type": "application/rss+xml" },
    });

  try {
    const result = await collectRssLiterature([
      {
        label: "Example AOP",
        url: "https://example.org/rss.xml",
        publisher: "Example",
        priority: "high",
      },
    ]);

    assert.equal(result.sourceStatuses[0]?.ok, true);
    assert.equal(result.papers.length, 1);
    assert.equal(result.papers[0]?.primarySource, "rss");
    assert.equal(result.papers[0]?.doi, "10.1234/example.2026.001");
    assert.match(result.papers[0]?.title ?? "", /Prime editing/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
