import { cache } from "react";

import {
  papers,
  subscriptions,
} from "@/lib/mock-data";
import {
  uniqueStrings,
} from "@/lib/shared-utils";
import {
  type CollectedPaper,
  type ExtractedCollectedPaper,
  type LiteratureCollectionResult,
  type LiteratureSourceStatus,
  type MatchedCollectedPaper,
  type SubscriptionIntelligence,
  type SubscriptionOverview,
} from "./types";
import {
  searchPubMed,
  searchEuropePmc,
  searchCrossref,
  searchPreprints,
  searchOpenAlex,
} from "./sources";
import {
  matchPaperToSubscription,
  dedupePapers,
  resolveSubscription,
} from "./matching";
import {
  normalizeMockPaper,
  enrichCollectedPaper,
} from "./helpers";

export type {
  LiteratureSource,
  CollectedPaper,
  ExtractedCollectedPaper,
  LiteratureSourceStatus,
  PaperMatch,
  MatchedCollectedPaper,
  SubscriptionOverview,
  LiteratureCollectionResult,
  SubscriptionIntelligence,
} from "./types";

export {
  normalizeDoi,
  normalizePmid,
  SOURCE_PRIORITY,
  MATCH_WEIGHTS,
} from "./types";

export {
  searchPubMed,
  searchEuropePmc,
  searchCrossref,
  searchPreprints,
  searchOpenAlex,
} from "./sources";

export {
  matchPaperToSubscription,
  dedupePapers,
  resolveSubscription,
  phraseIncluded,
} from "./matching";

export {
  normalizeMockPaper,
  fetchUnpaywallOA,
  fetchPmcFullText,
  enrichCollectedPaper,
} from "./helpers";

export async function collectExternalLiterature(): Promise<LiteratureCollectionResult> {
  const results = await Promise.all([
    searchPubMed(), 
    searchEuropePmc(), 
    searchCrossref(),
    searchPreprints("biorxiv"),
    searchPreprints("medrxiv"),
    searchOpenAlex(),
  ]);
  const collected = results.flatMap((result) => result.papers);
  const deduped = dedupePapers(collected);

  if (deduped.length > 0) {
    return {
      papers: deduped.sort((left, right) => {
        if (right.signalScore !== left.signalScore) {
          return right.signalScore - left.signalScore;
        }

        return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
      }),
      sourceStatuses: results.map((result) => result.status),
      usedFallback: false,
    };
  }

  return {
    papers: [],
    sourceStatuses: results.map((result) => result.status),
    usedFallback: false,
  };
}

async function collectLiterature(): Promise<LiteratureCollectionResult> {
  const externalCollection = await collectExternalLiterature();

  if (externalCollection.papers.length > 0) {
    return externalCollection;
  }

  return {
    papers: papers.map(normalizeMockPaper).sort((left, right) => right.signalScore - left.signalScore),
    sourceStatuses: externalCollection.sourceStatuses,
    usedFallback: true,
  };
}

export const getLiteratureCollection = cache(collectLiterature);

export const getExtractedLiteratureCollection = cache(async (): Promise<{
  papers: ExtractedCollectedPaper[];
  sourceStatuses: LiteratureSourceStatus[];
  usedFallback: boolean;
}> => {
  const collection = await getLiteratureCollection();

  return {
    papers: await Promise.all(collection.papers.map(enrichCollectedPaper)),
    sourceStatuses: collection.sourceStatuses,
    usedFallback: collection.usedFallback,
  };
});

export const getSubscriptionIntelligence = cache(async (): Promise<SubscriptionIntelligence> => {
  const collection = await getExtractedLiteratureCollection();

  const matchedPapers = collection.papers
    .map((paper) => {
      const matches = subscriptions
        .map((subscription) => matchPaperToSubscription(paper, subscription))
        .filter((match) => match.isMatch)
        .sort((left, right) => right.matchScore - left.matchScore);

      return {
        ...paper,
        matches,
        topMatchScore: matches[0]?.matchScore ?? 0,
      };
    })
    .filter((paper) => paper.matches.length > 0)
    .sort((left, right) => {
      if (right.topMatchScore !== left.topMatchScore) {
        return right.topMatchScore - left.topMatchScore;
      }

      if (right.signalScore !== left.signalScore) {
        return right.signalScore - left.signalScore;
      }

      return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
    });

  const subscriptionOverviews = subscriptions.map<SubscriptionOverview>((subscription) => {
    const subscriptionMatches = matchedPapers
      .flatMap((paper) =>
        paper.matches
          .filter((match) => match.subscriptionId === subscription.id)
          .map((match) => ({ paper, match })),
      )
      .sort((left, right) => right.match.matchScore - left.match.matchScore);

    const resolved = resolveSubscription(subscription);

    return {
      ...subscription,
      matchingPaperCount: subscriptionMatches.length,
      bestMatchScore: subscriptionMatches[0]?.match.matchScore ?? 0,
      matchedPaperTitles: subscriptionMatches.slice(0, 3).map((item) => item.paper.title),
      filterSummary: uniqueStrings([
        ...resolved.allKeywords,
        ...resolved.allAuthorNames,
        ...resolved.allJournalNames,
        ...resolved.allOrganisms,
        ...resolved.allEditorTypes,
      ]).slice(0, 6),
    };
  });

  return {
    papers: matchedPapers,
    sourceStatuses: collection.sourceStatuses,
    subscriptionOverviews,
    usedFallback: collection.usedFallback,
  };
});
