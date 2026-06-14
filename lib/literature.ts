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
} from "./literature/types";

export {
  normalizeDoi,
  normalizePmid,
  SOURCE_PRIORITY,
  MATCH_WEIGHTS,
} from "./literature/types";

export {
  searchPubMed,
  searchEuropePmc,
  searchCrossref,
  searchPreprints,
  searchOpenAlex,
} from "./literature/sources";

export {
  matchPaperToSubscription,
  dedupePapers,
  resolveSubscription,
  phraseIncluded,
} from "./literature/matching";

export {
  normalizeMockPaper,
  fetchUnpaywallOA,
  fetchPmcFullText,
  enrichCollectedPaper,
} from "./literature/helpers";

export {
  collectExternalLiterature,
  getLiteratureCollection,
  getExtractedLiteratureCollection,
  getSubscriptionIntelligence,
} from "./literature/index";
