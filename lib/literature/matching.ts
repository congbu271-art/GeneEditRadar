import {
  journals,
  topics,
  subscriptions,
  type RadarSubscription,
} from "@/lib/mock-data";
import {
  calculateSignalScore,
  canonicalizeJournal,
  uniqueStrings,
} from "@/lib/shared-utils";
import {
  type CollectedPaper,
  type LiteratureSource,
  type MatchedCollectedPaper,
  type PaperMatch,
  type ResolvedSubscription,
  type SubscriptionOverview,
  normalizeKeyword,
  normalizePersonName,
  MATCH_WEIGHTS,
} from "./types";

export function resolveSubscription(subscription: RadarSubscription): ResolvedSubscription {
  const journalName = subscription.journalSlug
    ? journals.find((journal) => journal.slug === subscription.journalSlug)?.name
    : undefined;
  const topicLabel = subscription.topicSlug
    ? topics.find((topic) => topic.slug === subscription.topicSlug)?.label
    : undefined;

  return {
    ...subscription,
    allKeywords: uniqueStrings([
      ...subscription.keywords,
      ...(subscription.geneSymbol ? [subscription.geneSymbol] : []),
      ...(topicLabel ? [topicLabel] : []),
    ]),
    allAuthorNames: uniqueStrings(subscription.authorNames),
    allAuthorOrcids: uniqueStrings(subscription.authorOrcids ?? []),
    allJournalNames: uniqueStrings([...subscription.journalNames, ...(journalName ? [journalName] : [])]),
    allOrganisms: uniqueStrings(subscription.organisms),
    allEditorTypes: uniqueStrings(subscription.editorTypes),
  };
}

export function phraseIncluded(haystack: string, needle: string) {
  const normalizedNeedle = normalizeKeyword(needle);
  return normalizedNeedle.length > 0 && haystack.includes(normalizedNeedle);
}

export function matchPaperToSubscription(paper: CollectedPaper, rawSubscription: RadarSubscription): PaperMatch {
  const subscription = resolveSubscription(rawSubscription);
  const searchText = normalizeKeyword(
    [paper.title, paper.abstract, paper.journal, ...paper.authors, ...paper.keywords, ...paper.editorTypes, ...paper.organisms].join(" "),
  );
  const normalizedAuthors = paper.authors.map(normalizePersonName);
  const normalizedJournal = canonicalizeJournal(paper.journal);
  const normalizedOrganisms = paper.organisms.map(normalizeKeyword);
  const normalizedEditorTypes = paper.editorTypes.map(normalizeKeyword);

  const matchedKeywords = subscription.allKeywords.filter((keyword) => phraseIncluded(searchText, keyword));
  
  const matchedAuthors = subscription.allAuthorNames.filter((authorName) => {
    const normalizedAuthor = normalizePersonName(authorName);
    return normalizedAuthors.some(
      (candidate) => candidate.includes(normalizedAuthor) || normalizedAuthor.includes(candidate),
    );
  });
  
  const matchedAuthorOrcids = subscription.allAuthorOrcids.filter((orcid) => {
    return paper.authorOrcids?.some((paperOrcid) => paperOrcid === orcid) ?? false;
  });
  
  const allMatchedAuthors = uniqueStrings([...matchedAuthors, ...matchedAuthorOrcids.map(() => "ORCID匹配")]);
  
  const matchedJournals = subscription.allJournalNames.filter((journalName) => {
    const normalizedMatch = canonicalizeJournal(journalName);
    return normalizedJournal.length > 0 && (normalizedJournal.includes(normalizedMatch) || normalizedMatch.includes(normalizedJournal));
  });
  const matchedOrganisms = subscription.allOrganisms.filter((organism) =>
    normalizedOrganisms.includes(normalizeKeyword(organism)),
  );
  const matchedEditorTypes = subscription.allEditorTypes.filter((editorType) => {
    const normalizedEditorType = normalizeKeyword(editorType);
    return normalizedEditorTypes.includes(normalizedEditorType) || phraseIncluded(searchText, editorType);
  });

  const activeWeight =
    (subscription.allKeywords.length ? MATCH_WEIGHTS.keywords : 0) +
    (subscription.allAuthorNames.length + subscription.allAuthorOrcids.length ? MATCH_WEIGHTS.authors : 0) +
    (subscription.allJournalNames.length ? MATCH_WEIGHTS.journals : 0) +
    (subscription.allOrganisms.length ? MATCH_WEIGHTS.organisms : 0) +
    (subscription.allEditorTypes.length ? MATCH_WEIGHTS.editorTypes : 0);

  const earnedWeight =
    (subscription.allKeywords.length ? (matchedKeywords.length / subscription.allKeywords.length) * MATCH_WEIGHTS.keywords : 0) +
    ((subscription.allAuthorNames.length + subscription.allAuthorOrcids.length) 
      ? ((matchedAuthors.length + matchedAuthorOrcids.length) / (subscription.allAuthorNames.length + subscription.allAuthorOrcids.length)) * MATCH_WEIGHTS.authors 
      : 0) +
    (subscription.allJournalNames.length ? (matchedJournals.length / subscription.allJournalNames.length) * MATCH_WEIGHTS.journals : 0) +
    (subscription.allOrganisms.length ? (matchedOrganisms.length / subscription.allOrganisms.length) * MATCH_WEIGHTS.organisms : 0) +
    (subscription.allEditorTypes.length ? (matchedEditorTypes.length / subscription.allEditorTypes.length) * MATCH_WEIGHTS.editorTypes : 0);

  const matchScore = activeWeight === 0 ? 0 : Math.round((earnedWeight / activeWeight) * 100);
  const isMatch = matchScore >= 55 && paper.signalScore >= subscription.signalThreshold;

  return {
    subscriptionId: subscription.id,
    subscriptionLabel: subscription.label,
    matchScore,
    threshold: subscription.signalThreshold,
    isMatch,
    matchedKeywords,
    matchedAuthors: allMatchedAuthors,
    matchedJournals,
    matchedOrganisms,
    matchedEditorTypes,
    reasons: uniqueStrings([
      ...matchedKeywords.map((item) => `Keyword: ${item}`),
      ...allMatchedAuthors.map((item) => `Author: ${item}`),
      ...matchedJournals.map((item) => `Journal: ${item}`),
      ...matchedOrganisms.map((item) => `Organism: ${item}`),
      ...matchedEditorTypes.map((item) => `Editor: ${item}`),
    ]),
  };
}

function chooseBestString(values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => (right?.length ?? 0) - (left?.length ?? 0))[0];
}

export function dedupePapers(input: CollectedPaper[]) {
  const byTitle = new Map<string, CollectedPaper>();

  for (const paper of input) {
    const key = paper.normalizedTitle;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, paper);
      continue;
    }

    const ordered = [existing, paper].sort((left, right) => {
      const leftHasAbstract = left.abstract.length > right.abstract.length ? 1 : 0;
      const rightHasAbstract = right.abstract.length > left.abstract.length ? 1 : 0;
      return rightHasAbstract - leftHasAbstract || left.sources.length - right.sources.length;
    });

    const base = ordered[0];
    const mergedWithoutScore = {
      ...base,
      doi: base.doi ?? ordered[1]?.doi,
      pmid: base.pmid ?? ordered[1]?.pmid,
      abstract: base.abstract.length > ordered[1]?.abstract.length ? base.abstract : ordered[1]?.abstract ?? base.abstract,
      journal: base.journal || ordered[1]?.journal,
      authors: uniqueStrings([...base.authors, ...(ordered[1]?.authors ?? [])]),
      keywords: uniqueStrings([...base.keywords, ...(ordered[1]?.keywords ?? [])]),
      organisms: uniqueStrings([...base.organisms, ...(ordered[1]?.organisms ?? [])]),
      editorTypes: uniqueStrings([...base.editorTypes, ...(ordered[1]?.editorTypes ?? [])]),
      sourceIds: { ...base.sourceIds, ...ordered[1]?.sourceIds },
      sources: uniqueStrings(ordered.flatMap((paper) => paper.sources)) as LiteratureSource[],
      primarySource: base.primarySource,
      appPaperId: chooseBestString(ordered.map((paper) => paper.appPaperId)) ?? undefined,
      id: base.id,
    };

    byTitle.set(key, {
      ...mergedWithoutScore,
      signalScore: calculateSignalScore(mergedWithoutScore),
    });
  }

  return byTitle.values().toArray();
}

export function buildSubscriptionOverview(papers: MatchedCollectedPaper[], subscription: RadarSubscription): SubscriptionOverview {
  const matches = papers.filter((paper) =>
    paper.matches.some((match) => match.subscriptionId === subscription.id),
  );

  const matchedPaperTitles = matches.map((paper) => paper.title);
  const bestMatchScore = matches.length > 0
    ? Math.max(...matches.map((paper) => paper.matches.find((m) => m.subscriptionId === subscription.id)?.matchScore ?? 0))
    : 0;

  const filterSummary = [
    ...subscription.keywords.map((k) => `关键词: ${k}`),
    ...subscription.authorNames.map((a) => `作者: ${a}`),
    ...subscription.journalNames.map((j) => `期刊: ${j}`),
    ...subscription.organisms.map((o) => `物种: ${o}`),
    ...subscription.editorTypes.map((e) => `编辑类型: ${e}`),
  ];

  return {
    ...subscription,
    matchingPaperCount: matches.length,
    bestMatchScore,
    matchedPaperTitles,
    filterSummary,
  };
}
