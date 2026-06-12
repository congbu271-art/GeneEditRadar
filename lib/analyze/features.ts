import { journals, papers, type RadarPaper } from "@/lib/mock-data";
import { NOT_REPORTED } from "@/lib/paper-extraction";
import type { CollectedPaper } from "@/lib/literature";
import type { IdeaSeedPaper } from "@/lib/research-ideas";
import type { AnalyzePaper, GeneEditingFeature } from "@/lib/analyze-types";
import { toZhSourceName } from "@/lib/ui-zh";
import { canonicalizeJournal, DISPLAY_NOT_REPORTED, normalizeTitle, uniqueStrings } from "@/lib/shared-utils";
import type { GeneEditingExtraction } from "@/lib/paper-extraction";
import { localizeReportedValue, slugify } from "./helpers";

export function toAnalyzePaper(paper: CollectedPaper): AnalyzePaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract || DISPLAY_NOT_REPORTED,
    journal: paper.journal || DISPLAY_NOT_REPORTED,
    authors: paper.authors.length > 0 ? paper.authors : [DISPLAY_NOT_REPORTED],
    doi: paper.doi ?? DISPLAY_NOT_REPORTED,
    pmid: paper.pmid ?? DISPLAY_NOT_REPORTED,
    publishedAt: paper.publishedAt ?? DISPLAY_NOT_REPORTED,
    url: paper.url,
    source: uniqueStrings(paper.sources.map(toZhSourceName)).join(" / "),
    signalScore: paper.signalScore,
    reliabilityLabel: "元数据",
  };
}

export function toStructuredFeature(paper: CollectedPaper, extraction: GeneEditingExtraction): GeneEditingFeature {
  return {
    paperId: paper.id,
    paperTitle: paper.title,
    editingTool: localizeReportedValue(extraction.editingTool),
    editorVariant: localizeReportedValue(extraction.editorVariant),
    editingType: localizeReportedValue(extraction.editingType),
    organism: localizeReportedValue(extraction.organism),
    deliveryMethod: localizeReportedValue(extraction.deliveryMethod),
    targetGene: localizeReportedValue(extraction.targetGene),
    targetTrait: localizeReportedValue(extraction.targetTrait),
    editingEfficiency: localizeReportedValue(extraction.editingEfficiency),
    offTargetAnalysis: localizeReportedValue(extraction.offTargetAnalysis),
    phenotypeValidation: localizeReportedValue(extraction.phenotypeValidation),
    mainInnovation: localizeReportedValue(extraction.mainInnovation),
    limitations: localizeReportedValue(extraction.limitations),
    paperType: localizeReportedValue(extraction.paperType),
    followUpOpportunities: localizeReportedValue(extraction.followUpOpportunities),
    reliabilityLabel: "规则解析",
  };
}

export function inferDiseaseAreaFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  const text = normalizeTitle(
    [paper.title, paper.abstract, extraction.targetTrait, extraction.targetGene, ...paper.keywords].join(" "),
  );

  if (/\b(pcsk9|ldl|cardio|metabolic)\b/.test(text)) {
    return "Cardiometabolic";
  }

  if (/\b(tumor|tumour|oncology|cancer|synthetic lethal)\b/.test(text)) {
    return "Oncology";
  }

  if (/\b(rpe65|retina|retinal|blindness|ocular|ophthalm)\b/.test(text)) {
    return "Ophthalmology";
  }

  if (/\b(thalassemia|hemoglobin|rare disease|monogenic)\b/.test(text)) {
    return "Rare disease";
  }

  if (/\b(rice|wheat|maize|arabidopsis|plant)\b/.test(text)) {
    return "Plant biotechnology";
  }

  return extraction.targetTrait !== NOT_REPORTED ? extraction.targetTrait : "Gene editing";
}

export function inferTopicSlugsFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction, query: string) {
  const text = normalizeTitle([paper.title, paper.abstract, extraction.editingType, extraction.deliveryMethod, query].join(" "));
  const result: string[] = [];

  if (/\b(base|adenine|cytosine|prime)\b/.test(text)) {
    result.push("base-editing");
  }

  if (/\b(lnp|aav|delivery|subretinal|electroporation)\b/.test(text)) {
    result.push("delivery");
  }

  if (/\b(t cell|cell therapy|allogeneic|trac)\b/.test(text)) {
    result.push("cell-therapy");
  }

  if (/\b(rare disease|thalassemia|blindness|retina|rpe65)\b/.test(text)) {
    result.push("rare-disease");
  }

  if (/\b(screen|screening|synthetic lethal|perturbation)\b/.test(text)) {
    result.push("screening");
  }

  return result.length > 0 ? uniqueStrings(result) : ["delivery"];
}

export function inferModalityFromExtraction(paper: CollectedPaper, extraction: GeneEditingExtraction) {
  const editingType = extraction.editingType !== NOT_REPORTED ? extraction.editingType : (paper.editorTypes[0] ?? "Gene editing");
  const delivery = extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : undefined;

  return delivery ? `${editingType} + ${delivery}` : editingType;
}

export function inferStageFromPaper(paper: CollectedPaper, extraction: GeneEditingExtraction): IdeaSeedPaper["stage"] {
  const paperType = extraction.paperType.toLowerCase();
  const text = normalizeTitle([paper.title, paper.abstract, extraction.paperType].join(" "));

  if (paperType.includes("clinical") || /\b(patient|patients|clinical)\b/.test(text)) {
    return "Clinical";
  }

  if (paperType.includes("platform") || /\b(screen|screening|atlas|perturbation)\b/.test(text)) {
    return "Platform";
  }

  return "Preclinical";
}

export function toSyntheticRadarPaper(seedPaper: IdeaSeedPaper): RadarPaper {
  return {
    id: seedPaper.id,
    slug: seedPaper.slug,
    title: seedPaper.title,
    abstract: seedPaper.abstract,
    publishedAt: seedPaper.publishedAt ?? "",
    doi: seedPaper.doi ?? "",
    pmid: undefined,
    modality: seedPaper.modality,
    diseaseArea: seedPaper.diseaseArea,
    stage: seedPaper.stage,
    status: "Watchlist",
    noveltyScore: seedPaper.compositeScore ?? 75,
    momentumScore: seedPaper.compositeScore ?? 75,
    translationalScore: seedPaper.compositeScore ?? 75,
    evidenceScore: seedPaper.compositeScore ?? 75,
    compositeScore: seedPaper.compositeScore ?? 75,
    citationCount: 0,
    clinicalSignal: "",
    keyTakeaway: "",
    marketSignal: "",
    journalSlug: seedPaper.journalSlug,
    authorIds: [],
    geneSymbols: seedPaper.geneSymbols,
    topicSlugs: seedPaper.topicSlugs,
    organisms: seedPaper.organisms,
    editorTypes: seedPaper.editorTypes,
  };
}

export function buildIdeaSeedPaper(paper: CollectedPaper, extraction: GeneEditingExtraction, query: string): IdeaSeedPaper {
  return {
    id: paper.appPaperId ?? paper.id,
    slug: slugify(paper.title).slice(0, 64),
    title: paper.title,
    abstract: paper.abstract,
    publishedAt: paper.publishedAt,
    doi: paper.doi,
    modality: inferModalityFromExtraction(paper, extraction),
    diseaseArea: inferDiseaseAreaFromPaper(paper, extraction),
    stage: inferStageFromPaper(paper, extraction),
    compositeScore: paper.appPaperId
      ? papers.find((item) => item.id === paper.appPaperId)?.compositeScore ?? paper.signalScore
      : paper.signalScore,
    journalSlug: journals.find((journal) => canonicalizeJournal(journal.name) === canonicalizeJournal(paper.journal))?.slug ?? paper.journal,
    geneSymbols:
      extraction.targetGene !== NOT_REPORTED
        ? uniqueStrings(
            extraction.targetGene
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        : uniqueStrings(paper.keywords.filter((item) => /\b[A-Z0-9-]{3,8}\b/.test(item))).slice(0, 3),
    topicSlugs: inferTopicSlugsFromPaper(paper, extraction, query),
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
  };
}
