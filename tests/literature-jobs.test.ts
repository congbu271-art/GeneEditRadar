import assert from "node:assert/strict";
import test from "node:test";

import {
  runDigestMarkJob,
  runLiteratureCollectionJob,
  runRssCollectionJob,
  runSubscriptionMatchJob,
} from "@/lib/literature-jobs";

test("literature jobs safely skip when DATABASE_URL is not configured", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";

  try {
    const collection = await runLiteratureCollectionJob();
    const rssCollection = await runRssCollectionJob();
    const matching = await runSubscriptionMatchJob();
    const digest = await runDigestMarkJob();

    assert.equal(collection.skipped, true);
    assert.equal(rssCollection.skipped, true);
    assert.equal(matching.skipped, true);
    assert.equal(digest.skipped, true);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});
