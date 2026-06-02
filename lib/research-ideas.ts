import { geneTargets, journals, papers, topics, type RadarPaper } from "@/lib/mock-data";
import {
  NOT_REPORTED,
  buildExtractionSourceFromRadarPaper,
  extractGeneEditingDetailsRuleBased,
  type GeneEditingExtraction,
} from "@/lib/paper-extraction";

export const RESEARCH_IDEA_TYPES = [
  "tool transfer",
  "organism transfer",
  "delivery optimization",
  "editor optimization",
  "trait application",
  "off-target reduction",
] as const;

export type ResearchIdeaType = (typeof RESEARCH_IDEA_TYPES)[number];

export type GeneratedResearchIdea = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  customer: string;
  wedge: string;
  moat: string;
  risk: string;
  stage: "High priority" | "Promising" | "Speculative";
  score: number;
  paperId: string;
  topicSlug?: string;
  ideaType: ResearchIdeaType;
  articleTypeHint: string;
  journalTierHint: string;
  minimumExperimentalPackage: string[];
  additionalExperiments: string[];
  classification: string;
};

export type IdeaSeedPaper = {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  publishedAt?: string;
  doi?: string;
  modality: string;
  diseaseArea: string;
  stage: "Preclinical" | "Clinical" | "Platform";
  compositeScore?: number;
  journalSlug: string;
  geneSymbols: string[];
  topicSlugs: string[];
  organisms: string[];
  editorTypes: string[];
};

export type IdeaSourceContext = {
  paper: IdeaSeedPaper;
  extraction: GeneEditingExtraction;
};

export type GeneEditingIdeaSubmission = {
  title: string;
  summary: string;
  sourcePaperId?: string;
  suggestedIdeaType?: ResearchIdeaType;
  sourcePaperContext?: IdeaSourceContext;
};

export type GeneEditingIdeaEvaluation = {
  primaryIdeaType: ResearchIdeaType;
  classification: string;
  novelty: number;
  feasibility: number;
  publicationPotential: number;
  competitionRisk: number;
  overallScore: number;
  articleType: string;
  minimumExperimentalPackage: string[];
  additionalExperiments: string[];
  journalTier: string;
  isIncremental: boolean;
  warning?: string;
  rationale: string[];
};

const DEFAULT_IDEA_TYPE_PRIORITY: ResearchIdeaType[] = [
  "tool transfer",
  "delivery optimization",
  "editor optimization",
  "trait application",
  "organism transfer",
  "off-target reduction",
];

const paperById = new Map(papers.map((paper) => [paper.id, paper]));
const paperExtractionById = new Map<string, GeneEditingExtraction>(
  papers.map((paper) => [paper.id, extractGeneEditingDetailsRuleBased(buildExtractionSourceFromRadarPaper(paper))]),
);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function countMatches(text: string, values: string[]) {
  return values.reduce((count, value) => count + (text.includes(value) ? 1 : 0), 0);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNegatedMention(text: string, value: string) {
  const pattern = new RegExp(`(?:without|no)\\s+(?:[a-z]+\\s+){0,5}${escapeRegex(value)}`);
  return pattern.test(text);
}

function containsPositiveAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value) && !isNegatedMention(text, value));
}

function countPositiveMatches(text: string, values: string[]) {
  return values.reduce((count, value) => count + (text.includes(value) && !isNegatedMention(text, value) ? 1 : 0), 0);
}

function formatIdeaTypeLabel(value: ResearchIdeaType) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSourcePaperContext(sourcePaperId?: string, explicitContext?: IdeaSourceContext) {
  if (explicitContext) {
    return explicitContext;
  }

  if (!sourcePaperId) {
    return undefined;
  }

  const paper = paperById.get(sourcePaperId);
  const extraction = paperExtractionById.get(sourcePaperId);

  if (!paper || !extraction) {
    return undefined;
  }

  return { paper, extraction };
}

function getPaperTopicSlug(paper: IdeaSeedPaper) {
  return paper.topicSlugs[0];
}

function getPaperJournalName(paper: IdeaSeedPaper) {
  return journals.find((journal) => journal.slug === paper.journalSlug)?.name ?? paper.journalSlug;
}

function getOrganismTransferTarget(paper: IdeaSeedPaper) {
  if (paper.organisms.includes("Primate")) {
    return "human hepatocyte organoids and repeat-dose liver models";
  }

  if (paper.organisms.includes("Human")) {
    return "non-human primate and humanized validation models";
  }

  if (paper.organisms.includes("Canine") || paper.organisms.includes("Rodent")) {
    return "large-animal ocular models with surgical dosing realism";
  }

  if (paper.organisms.includes("Mouse")) {
    return "humanized or patient-derived follow-up systems";
  }

  return "a new translational organism context";
}

function getAdjacentTrait(paper: IdeaSeedPaper) {
  if (paper.geneSymbols.includes("PCSK9")) {
    return "adjacent liver-secreted cardiometabolic targets";
  }

  if (paper.geneSymbols.includes("HBB")) {
    return "other hemoglobinopathy correction programs";
  }

  if (paper.geneSymbols.includes("TRAC")) {
    return "other persistence-limited solid-tumor cell therapies";
  }

  if (paper.geneSymbols.includes("RPE65")) {
    return "other inherited retinal degeneration traits";
  }

  if (paper.geneSymbols.includes("TP53")) {
    return "new oncology synthetic-lethal target hypotheses";
  }

  return `adjacent ${paper.diseaseArea.toLowerCase()} traits`;
}

function getDeliveryOptimizationFocus(deliveryMethod: string, paper: IdeaSeedPaper) {
  if (/lnp/i.test(deliveryMethod)) {
    return "repeat-dosing tolerance and extrahepatic selectivity";
  }

  if (/aav/i.test(deliveryMethod)) {
    return "capsid dose-sparing and localized biodistribution";
  }

  if (/subretinal/i.test(deliveryMethod)) {
    return "surgical dosing consistency and retinal spread control";
  }

  if (/ex vivo/i.test(deliveryMethod)) {
    return "manufacturing speed and cell-state preservation";
  }

  if (/in vivo/i.test(deliveryMethod)) {
    return "tissue-selective exposure and durability";
  }

  return `${paper.diseaseArea.toLowerCase()}-relevant delivery tuning`;
}

function getEditorOptimizationFocus(editingTool: string, paper: IdeaSeedPaper) {
  if (/prime/i.test(editingTool)) {
    return "pegRNA architecture and payload compaction";
  }

  if (/adenine/i.test(editingTool) || /base/i.test(editingTool)) {
    return "editing-window control and specificity";
  }

  if (/screen/i.test(editingTool)) {
    return "library design precision and perturbation depth";
  }

  if (/crispr/i.test(editingTool)) {
    return "guide architecture and expression timing";
  }

  return `${paper.diseaseArea.toLowerCase()}-fit editor performance`;
}

function getArticleTypeForIdeaType(ideaType: ResearchIdeaType) {
  switch (ideaType) {
    case "tool transfer":
      return "proof-of-concept transfer article";
    case "organism transfer":
      return "translational organism-transfer study";
    case "delivery optimization":
      return "delivery optimization article";
    case "editor optimization":
      return "editor engineering or methods paper";
    case "trait application":
      return "disease-application research article";
    case "off-target reduction":
      return "safety and specificity methods article";
  }
}

function getPackageForIdeaType(
  ideaType: ResearchIdeaType,
  paper: IdeaSeedPaper,
  extraction: GeneEditingExtraction,
) {
  const gene = extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : paper.geneSymbols.join(", ");
  const journalName = getPaperJournalName(paper);

  switch (ideaType) {
    case "tool transfer":
      return {
        minimumExperimentalPackage: [
          `Rebuild the ${extraction.editingType.toLowerCase()} workflow against a second target beyond ${gene}.`,
          `Show matched on-target editing and a trait-linked functional readout in the transfer setting.`,
          `Benchmark portability against the original ${journalName} source-paper conditions.`,
        ],
        additionalExperiments: [
          "Add durability measurements across at least two timepoints.",
          "Run off-target or transcriptomic safety profiling in the new context.",
          "Compare transfer performance against a simpler baseline editor or delivery setup.",
        ],
      };
    case "organism transfer":
      return {
        minimumExperimentalPackage: [
          `Replicate the core ${paper.diseaseArea.toLowerCase()} edit in ${getOrganismTransferTarget(paper)}.`,
          "Measure editing rate, phenotype rescue, and exposure in the new organism system.",
          "Bridge the organism shift with matched guide and dosing controls.",
        ],
        additionalExperiments: [
          "Add repeat-dose or longitudinal follow-up if the new model supports it.",
          "Compare immune activation or inflammatory burden across organisms.",
          "Use orthogonal molecular validation for any shifted phenotype signal.",
        ],
      };
    case "delivery optimization":
      return {
        minimumExperimentalPackage: [
          `Optimize ${extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : paper.modality} for ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)}.`,
          "Quantify biodistribution, editing rate, and functional phenotype together.",
          "Benchmark the optimized delivery against the source-paper dosing condition.",
        ],
        additionalExperiments: [
          "Stress-test repeat dosing or redosing compatibility.",
          "Add payload integrity and tissue-selective expression measurements.",
          "Compare safety markers against a clinically familiar delivery control.",
        ],
      };
    case "editor optimization":
      return {
        minimumExperimentalPackage: [
          `Engineer the ${extraction.editingTool} around ${getEditorOptimizationFocus(extraction.editingTool, paper)}.`,
          "Measure edit purity, on-target efficiency, and phenotype effect in the lead model.",
          "Compare the optimized editor head-to-head with the source configuration.",
        ],
        additionalExperiments: [
          "Profile editing window or bystander editing outcomes.",
          "Add expression kinetics or payload-size measurements.",
          "Test whether the optimized editor preserves efficacy under lower dose.",
        ],
      };
    case "trait application":
      return {
        minimumExperimentalPackage: [
          `Apply the same platform to ${getAdjacentTrait(paper)} with a clearly defined phenotype endpoint.`,
          "Show on-target editing together with a disease-relevant rescue or suppression readout.",
          "Include a direct comparator against the original trait context or target class.",
        ],
        additionalExperiments: [
          "Add dose-response or guide-selection screens around the new trait.",
          "Measure durability and reversibility where clinically relevant.",
          "Run safety profiling tailored to the new disease context.",
        ],
      };
    case "off-target reduction":
      return {
        minimumExperimentalPackage: [
          `Build a reduced-risk version of the ${extraction.editingTool} workflow using guide, payload, or expression-timing controls.`,
          "Measure on-target editing together with off-target, inflammation, or biodistribution readouts.",
          "Demonstrate that specificity gains do not erase the phenotype signal.",
        ],
        additionalExperiments: [
          "Add orthogonal off-target confirmation such as targeted sequencing or unbiased profiling.",
          "Compare transient versus persistent editor exposure.",
          "Test the specificity strategy in a second guide or target context.",
        ],
      };
  }
}

function selectIdeaTypesForPaper(paper: IdeaSeedPaper, extraction: GeneEditingExtraction) {
  const selected: ResearchIdeaType[] = ["tool transfer"];

  if (extraction.organism !== NOT_REPORTED && !selected.includes("organism transfer")) {
    selected.push("organism transfer");
  }

  if (extraction.deliveryMethod !== NOT_REPORTED && !selected.includes("delivery optimization")) {
    selected.push("delivery optimization");
  }

  if (extraction.editingTool !== NOT_REPORTED && !selected.includes("editor optimization")) {
    selected.push("editor optimization");
  }

  if ((extraction.targetTrait !== NOT_REPORTED || paper.diseaseArea) && !selected.includes("trait application")) {
    selected.push("trait application");
  }

  if (
    (extraction.offTargetAnalysis !== NOT_REPORTED || /off-target|inflammation|biodistribution/i.test(paper.abstract)) &&
    !selected.includes("off-target reduction")
  ) {
    selected.push("off-target reduction");
  }

  for (const ideaType of DEFAULT_IDEA_TYPE_PRIORITY) {
    if (!selected.includes(ideaType)) {
      selected.push(ideaType);
    }

    if (selected.length >= 4) {
      break;
    }
  }

  return selected.slice(0, 5);
}

function buildIdeaDraft(paper: IdeaSeedPaper, extraction: GeneEditingExtraction, ideaType: ResearchIdeaType) {
  const gene = extraction.targetGene !== NOT_REPORTED ? extraction.targetGene : paper.geneSymbols.join(", ");
  const tool = extraction.editingTool !== NOT_REPORTED ? extraction.editingTool : extraction.editingType;
  const delivery = extraction.deliveryMethod !== NOT_REPORTED ? extraction.deliveryMethod : paper.modality;
  const trait = extraction.targetTrait !== NOT_REPORTED ? extraction.targetTrait : paper.diseaseArea;
  const topic = topics.find((item) => item.slug === getPaperTopicSlug(paper));
  const articleTypeHint = getArticleTypeForIdeaType(ideaType);
  const packagePlan = getPackageForIdeaType(ideaType, paper, extraction);

  switch (ideaType) {
    case "tool transfer":
      return {
        title: `Transfer ${tool} from ${gene} into ${getAdjacentTrait(paper)}`,
        thesis: `Use the source paper's ${delivery} playbook to test whether the same ${tool} architecture can unlock publishable editing performance in ${getAdjacentTrait(paper)} instead of staying confined to ${trait.toLowerCase()}.`,
        customer: "Best first team: translational editing labs with a validated source-paper assay and one adjacent disease model.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: portability would show that the paper's core advance is a reusable platform move rather than a one-target anecdote.",
        risk: "Primary risk: the effect could depend more on tissue context than on the transferred editing architecture.",
        topicSlug: topic?.slug,
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "organism transfer":
      return {
        title: `Port ${gene} editing into ${getOrganismTransferTarget(paper)}`,
        thesis: `Translate the paper's editing logic from ${paper.organisms.join(", ").toLowerCase()} models into ${getOrganismTransferTarget(paper)} to show whether the biology and delivery logic survive a harder translational organism jump.`,
        customer: "Best first team: groups that already control the original model and one higher-fidelity validation organism.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: organism transfer is often the cleanest bridge from elegant editing chemistry to a paper with real translational weight.",
        risk: "Primary risk: dosing, immune tone, or tissue access can collapse performance during the organism step-up.",
        topicSlug: topic?.slug,
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "delivery optimization":
      return {
        title: `Optimize ${delivery} for ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)}`,
        thesis: `Take the source paper's delivery frame and make it publishable as a standalone advance by improving ${getDeliveryOptimizationFocus(extraction.deliveryMethod, paper)} while preserving the same edit and phenotype signal.`,
        customer: "Best first team: delivery engineering labs that can iterate formulations, biodistribution assays, and phenotype readouts quickly.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: delivery improvements often create the fastest follow-on paper if the signal ties directly to dose, durability, or safety.",
        risk: "Primary risk: better exposure metrics may not translate into a materially stronger phenotype package.",
        topicSlug: topic?.slug ?? "delivery",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "editor optimization":
      return {
        title: `Engineer a sharper ${tool} for ${gene}`,
        thesis: `Build an editor-optimization paper around ${getEditorOptimizationFocus(extraction.editingTool, paper)} so the study contributes a better-performing edit chemistry rather than only repeating the source phenotype.`,
        customer: "Best first team: editor engineering groups with fast construct-build cycles and direct access to the source assay.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: editor-focused improvements can generalize across targets if specificity or payload advantages are real.",
        risk: "Primary risk: editor gains may be too small or too context-specific to survive peer review as a distinct contribution.",
        topicSlug: topic?.slug ?? "base-editing",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "trait application":
      return {
        title: `Apply ${tool} to ${getAdjacentTrait(paper)}`,
        thesis: `Use the paper as a starting point for a new trait application study that keeps the core editing modality but retunes the experimental package toward ${getAdjacentTrait(paper)} and a new phenotype endpoint.`,
        customer: "Best first team: disease-focused labs looking for a faster way to reuse a proven editing chemistry in an adjacent indication.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: strong trait transfer papers can create a new disease wedge without requiring an entirely new platform invention.",
        risk: "Primary risk: the idea can look like a me-too application unless the phenotype or model upgrade is genuinely differentiated.",
        topicSlug: topic?.slug ?? "rare-disease",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
    case "off-target reduction":
      return {
        title: `Reduce off-target burden in ${tool} ${gene} editing`,
        thesis: `Turn the source paper into a stronger safety story by redesigning the workflow around lower off-target or inflammatory burden while keeping the headline edit and phenotype signal intact.`,
        customer: "Best first team: safety-focused translational labs that can combine editing assays with orthogonal specificity readouts.",
        wedge: packagePlan.minimumExperimentalPackage[0],
        moat: "Why it matters: a credible specificity gain can raise publication quality and create a practical adoption argument at the same time.",
        risk: "Primary risk: safety improvements may come at the cost of too much efficacy to support a compelling article.",
        topicSlug: topic?.slug ?? "delivery",
        articleTypeHint,
        minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
        additionalExperiments: packagePlan.additionalExperiments,
      };
  }
}

export function classifyGeneEditingIdea(
  submission: Pick<GeneEditingIdeaSubmission, "title" | "summary" | "suggestedIdeaType">,
): ResearchIdeaType {
  if (submission.suggestedIdeaType) {
    return submission.suggestedIdeaType;
  }

  const text = normalizeText(`${submission.title} ${submission.summary}`);

  if (
    containsAny(text, ["same model", "same delivery", "same editor", "benchmark"]) &&
    containsAny(text, ["optimize", "optimization", "improve", "improvement", "tune", "tuning"])
  ) {
    return containsAny(text, ["delivery", "lnp", "aav", "capsid", "tropism", "biodistribution"])
      ? "delivery optimization"
      : "editor optimization";
  }

  const scores = new Map<ResearchIdeaType, number>(
    RESEARCH_IDEA_TYPES.map((ideaType) => [ideaType, 0]),
  );

  scores.set(
    "off-target reduction",
    countPositiveMatches(text, ["off target", "specificity", "guide", "reduced risk", "inflammation", "biodistribution"]) * 3,
  );
  scores.set(
    "delivery optimization",
    countPositiveMatches(text, ["delivery", "lnp", "aav", "capsid", "tropism", "repeat dosing", "biodistribution"]) * 3,
  );
  scores.set(
    "organism transfer",
    countPositiveMatches(text, ["organism", "mouse", "mice", "primate", "canine", "humanized", "organoid", "large animal"]) * 3,
  );
  scores.set(
    "editor optimization",
    countPositiveMatches(text, ["editor", "peg", "deaminase", "base editor", "prime editor", "cas9", "cas12", "window"]) * 3,
  );
  scores.set(
    "trait application",
    countPositiveMatches(text, ["trait", "disease", "phenotype", "rescue", "tumor", "blindness", "anemia", "ldl"]) * 3,
  );
  scores.set(
    "tool transfer",
    countPositiveMatches(text, ["transfer", "port", "retarget", "apply to", "reuse", "translate", "cross tissue"]) * 3,
  );

  if (containsAny(text, ["transfer", "port", "reuse", "retarget"])) {
    scores.set("tool transfer", (scores.get("tool transfer") ?? 0) + 4);
  }

  if (containsAny(text, ["optimize", "optimization", "improve", "improvement", "tune", "tuning"])) {
    scores.set("delivery optimization", (scores.get("delivery optimization") ?? 0) + 2);
    scores.set("editor optimization", (scores.get("editor optimization") ?? 0) + 2);
  }

  return [...scores.entries()].sort((left, right) => right[1] - left[1] || RESEARCH_IDEA_TYPES.indexOf(left[0]) - RESEARCH_IDEA_TYPES.indexOf(right[0]))[0]?.[0] ?? "tool transfer";
}

function isIncrementalIdea(text: string, sourcePaper?: IdeaSeedPaper) {
  const incrementalMarkers = [
    "incremental",
    "minor",
    "slight",
    "benchmark",
    "replicate",
    "same model",
    "same editor",
    "same delivery",
  ];
  const noveltyMarkers = [
    "transfer",
    "port",
    "retarget",
    "new organism",
    "repeat dosing",
    "specificity",
    "off target",
    "humanized",
    "organoid",
    "durability",
    "biodistribution",
    "synthetic lethal",
  ];

  const sourceOverlap = sourcePaper
    ? [
        ...sourcePaper.geneSymbols.map((item) => item.toLowerCase()),
        ...sourcePaper.organisms.map((item) => item.toLowerCase()),
        ...sourcePaper.editorTypes.map((item) => item.toLowerCase()),
      ].filter((item) => text.includes(item)).length
    : 0;

  return (
    (containsAny(text, incrementalMarkers) && !containsPositiveAny(text, noveltyMarkers)) ||
    (sourceOverlap >= 3 && !containsPositiveAny(text, noveltyMarkers))
  );
}

function recommendJournalTier(
  novelty: number,
  feasibility: number,
  publicationPotential: number,
  competitionRisk: number,
) {
  const overallStrength = Math.round((novelty + feasibility + publicationPotential + (100 - competitionRisk)) / 4);

  if (overallStrength >= 86 && publicationPotential >= 82) {
    return "top-tier biotech or flagship translational journal";
  }

  if (overallStrength >= 76) {
    return "strong specialty translational journal";
  }

  if (overallStrength >= 66) {
    return "field-leading specialty journal";
  }

  return "focused application or methods journal";
}

export function evaluateGeneEditingIdea(submission: GeneEditingIdeaSubmission): GeneEditingIdeaEvaluation {
  const text = normalizeText(`${submission.title} ${submission.summary}`);
  const sourceContext = getSourcePaperContext(submission.sourcePaperId, submission.sourcePaperContext);
  const primaryIdeaType = classifyGeneEditingIdea(submission);
  const sourcePaper = sourceContext?.paper;
  const sourceExtraction = sourceContext?.extraction;
  const incremental = isIncrementalIdea(text, sourcePaper);

  let novelty = 52;
  novelty +=
    {
      "tool transfer": 18,
      "organism transfer": 17,
      "delivery optimization": 10,
      "editor optimization": 12,
      "trait application": 11,
      "off-target reduction": 16,
    }[primaryIdeaType];
  novelty += countMatches(text, ["humanized", "organoid", "repeat dosing", "biodistribution", "durability", "specificity"]) * 4;
  novelty += containsAny(text, ["synthetic lethal", "solid tumor", "retina", "primate", "canine"]) ? 6 : 0;
  novelty -= incremental ? 22 : 0;

  let feasibility = 54;
  feasibility += sourcePaper ? 8 : 0;
  feasibility += containsAny(text, ["mouse", "rodent", "organoid", "ex vivo", "cell"]) ? 12 : 0;
  feasibility += containsAny(text, ["lnp", "aav", "subretinal", "electroporation"]) ? 8 : 0;
  feasibility +=
    primaryIdeaType === "delivery optimization" || primaryIdeaType === "editor optimization" || primaryIdeaType === "off-target reduction"
      ? 10
      : 0;
  feasibility -= containsAny(text, ["primate", "first in human", "clinical", "allogeneic", "multiplex"]) ? 8 : 0;
  feasibility -= primaryIdeaType === "organism transfer" ? 4 : 0;
  feasibility += incremental ? 4 : 0;

  let publicationPotential = 55;
  publicationPotential += containsAny(text, ["phenotype", "rescue", "durability", "tumor control", "visual function", "anemia", "ldl"]) ? 12 : 0;
  publicationPotential += containsAny(text, ["off target", "specificity", "biodistribution", "inflammation"]) ? 10 : 0;
  publicationPotential += containsAny(text, ["mouse", "primate", "canine", "large animal", "humanized", "organoid"]) ? 8 : 0;
  publicationPotential += sourcePaper?.compositeScore !== undefined && sourcePaper.compositeScore >= 88 ? 6 : 0;
  publicationPotential += primaryIdeaType === "organism transfer" || primaryIdeaType === "trait application" ? 6 : 0;
  publicationPotential -= incremental ? 14 : 0;

  let competitionRisk = 40;
  competitionRisk += countMatches(text, ["pcsk9", "hbb", "prime editing", "base editing", "lnp", "crispr"]) * 4;
  competitionRisk += primaryIdeaType === "delivery optimization" || primaryIdeaType === "trait application" ? 8 : 0;
  competitionRisk -= primaryIdeaType === "off-target reduction" || primaryIdeaType === "organism transfer" ? 6 : 0;
  competitionRisk -= containsAny(text, ["retina", "canine", "organoid", "synthetic lethal", "repeat dosing"]) ? 6 : 0;
  competitionRisk += incremental ? 18 : 0;

  const articleType = getArticleTypeForIdeaType(primaryIdeaType);
  const packagePlan =
    sourcePaper && sourceExtraction
      ? getPackageForIdeaType(primaryIdeaType, sourcePaper, sourceExtraction)
      : {
          minimumExperimentalPackage: [
            "Show on-target editing in a tractable primary model.",
            "Add one disease- or trait-relevant functional readout.",
            "Benchmark against a sensible baseline workflow.",
          ],
          additionalExperiments: [
            "Add orthogonal safety or off-target measurements.",
            "Measure durability or dose-response where relevant.",
            "Validate the finding in a second model or guide context.",
          ],
        };

  novelty = clamp(novelty);
  feasibility = clamp(feasibility);
  publicationPotential = clamp(publicationPotential);
  competitionRisk = clamp(competitionRisk);

  const overallScore = clamp(
    novelty * 0.3 + feasibility * 0.3 + publicationPotential * 0.25 + (100 - competitionRisk) * 0.15,
  );

  const rationale: string[] = [];

  if (sourcePaper) {
    rationale.push(`Anchored to ${sourcePaper.title}.`);
  }

  if (primaryIdeaType === "organism transfer" || primaryIdeaType === "tool transfer") {
    rationale.push("The proposal introduces a transfer step beyond the original paper context.");
  }

  if (containsAny(text, ["off target", "specificity", "biodistribution", "inflammation"])) {
    rationale.push("Safety or specificity language improves paperability and translational framing.");
  }

  if (containsAny(text, ["phenotype", "rescue", "durability", "tumor", "visual function", "anemia", "ldl"])) {
    rationale.push("A visible phenotype endpoint supports publication potential.");
  }

  if (incremental) {
    rationale.push("The idea still overlaps heavily with the source context and needs a sharper differentiator.");
  }

  const warning = incremental
    ? "Too incremental right now. Add a new organism, stronger safety angle, or a clearly different phenotype package."
    : overallScore < 65
      ? "The scope is still fuzzy. Tighten the experimental wedge before treating this as a strong paper concept."
      : undefined;

  return {
    primaryIdeaType,
    classification: formatIdeaTypeLabel(primaryIdeaType),
    novelty,
    feasibility,
    publicationPotential,
    competitionRisk,
    overallScore,
    articleType,
    minimumExperimentalPackage: packagePlan.minimumExperimentalPackage,
    additionalExperiments: packagePlan.additionalExperiments,
    journalTier: recommendJournalTier(novelty, feasibility, publicationPotential, competitionRisk),
    isIncremental: incremental,
    warning,
    rationale,
  };
}

export function generateIdeasForSeedPaper(paper: IdeaSeedPaper, extraction: GeneEditingExtraction): GeneratedResearchIdea[] {
  return selectIdeaTypesForPaper(paper, extraction).map((ideaType) => {
    const draft = buildIdeaDraft(paper, extraction, ideaType);
    const evaluation = evaluateGeneEditingIdea({
      title: draft.title,
      summary: draft.thesis,
      sourcePaperId: paper.id,
      sourcePaperContext: { paper, extraction },
      suggestedIdeaType: ideaType,
    });
    const slug = slugify(`${paper.slug}-${ideaType}`);

    return {
      id: `idea-${slug}`,
      slug,
      title: draft.title,
      thesis: draft.thesis,
      customer: draft.customer,
      wedge: draft.wedge,
      moat: draft.moat,
      risk: draft.risk,
      stage:
        evaluation.overallScore >= 84
          ? "High priority"
          : evaluation.overallScore >= 72
            ? "Promising"
            : "Speculative",
      score: evaluation.overallScore,
      paperId: paper.id,
      topicSlug: draft.topicSlug,
      ideaType,
      articleTypeHint: draft.articleTypeHint,
      journalTierHint: evaluation.journalTier,
      minimumExperimentalPackage: evaluation.minimumExperimentalPackage,
      additionalExperiments: evaluation.additionalExperiments,
      classification: evaluation.classification,
    };
  });
}

export function generateIdeasForPaper(paper: RadarPaper): GeneratedResearchIdea[] {
  const extraction = paperExtractionById.get(paper.id)!;

  return generateIdeasForSeedPaper(paper, extraction);
}

export function generateResearchIdeas(seedPapers: RadarPaper[] = papers) {
  return seedPapers
    .flatMap((paper) => generateIdeasForPaper(paper))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

export const generatedResearchIdeas = generateResearchIdeas();

export function getResearchIdeaTypeSummary() {
  return RESEARCH_IDEA_TYPES.map((ideaType) => ({
    ideaType,
    label: formatIdeaTypeLabel(ideaType),
    count: generatedResearchIdeas.filter((idea) => idea.ideaType === ideaType).length,
  }));
}

export function getResearchIdeasPerPaper() {
  return papers.map((paper) => ({
    paperId: paper.id,
    paperTitle: paper.title,
    count: generatedResearchIdeas.filter((idea) => idea.paperId === paper.id).length,
  }));
}

export function getTargetHintForIdeaSummary(summary: string) {
  const normalized = normalizeText(summary);
  return geneTargets.find((target) => normalized.includes(target.symbol.toLowerCase()))?.symbol;
}
