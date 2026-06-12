export type AnalyzeMode = "keyword" | "paper";
export type PaperQueryKind = "doi" | "pmid" | "title";
export type TechnologyTransferPath =
  | "animal_to_plant"
  | "mammalian_cell_to_plant"
  | "monocot_to_dicot"
  | "model_plant_to_crop"
  | "crop_to_crop"
  | "tool_to_trait"
  | "single_target_to_multiplex"
  | "efficiency_optimization"
  | "delivery_optimization"
  | "specificity_optimization";

export type AnalyzeReliabilityLabel = "元数据" | "规则解析" | "启发式评分" | "AI生成假设" | "AI综述";

export type AnalyzeRequestInput = {
  mode: AnalyzeMode;
  query: string;
};

export type AnalyzePaper = {
  id: string;
  title: string;
  abstract: string;
  journal: string;
  authors: string[];
  doi: string;
  pmid: string;
  publishedAt: string;
  url?: string;
  source: string;
  signalScore: number;
  reliabilityLabel: "元数据";
};

export type GeneEditingFeature = {
  paperId: string;
  paperTitle: string;
  editingTool: string;
  editorVariant: string;
  editingType: string;
  organism: string;
  deliveryMethod: string;
  targetGene: string;
  targetTrait: string;
  editingEfficiency: string;
  offTargetAnalysis: string;
  phenotypeValidation: string;
  mainInnovation: string;
  limitations: string;
  paperType: string;
  followUpOpportunities: string;
  reliabilityLabel: "规则解析";
};

export type AnalyzeIdea = {
  id: string;
  name: string;
  innovationType: string;
  transferPath: string;
  priority: "高" | "中" | "低";
  basedOnPapers: string[];
  innovationLogic: string;
  feasibilityRisk: string;
  feasibilityRationale: string;
  minimumExperimentalPackage: string[];
  minimumExperimentPackage: string[];
  recommendedJournalTier: string;
  suggestedJournalTier: string;
  articleType: string;
  novelty: number;
  noveltyScore: number;
  feasibility: number;
  feasibilityScore: number;
  publicationPotential: number;
  publicationPotentialScore: number;
  competitionRisk: number;
  warning?: string;
  riskWarnings: string[];
  reliabilityLabel: "AI生成假设";
  evolutionAnalysis?: {
    establishedPaths: string[];
    identifiedGaps: string[];
    innovationPathSummary: string;
  };
};

export type AnalyzeEvaluation = {
  targetIdeaName: string;
  novelty: number;
  feasibility: number;
  publicationPotential: number;
  competitionRisk: number;
  articleType: string;
  additionalExperiments: string[];
  journalTier: string;
  warning?: string;
  lowNoveltyWarning?: string;
  rationale: string[];
  reliabilityLabel: "启发式评分";
};

export type JournalSuggestion = {
  journalTier: string;
  rationale: string;
  exampleJournals: string[];
  reliabilityLabel: "启发式评分";
};

export type PaperStrategySummary = {
  overallStrategy: string;
  whyPublishable: string;
  coreInnovation: string;
  evidenceChain: string[];
  limitations: string[];
};

export type TechnologyTransferPathSummary = {
  path: TechnologyTransferPath;
  label: string;
  rationale: string;
  priority: "高" | "中" | "低";
  reliabilityLabel: "规则解析";
};

export type AnalyzeSourceStatus = {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
};

export type AnalyzeResponse = {
  mode: AnalyzeMode;
  query: string;
  detectedQueryKind?: PaperQueryKind;
  seedPaper?: AnalyzePaper;
  paperStrategySummary?: PaperStrategySummary;
  technologyTransferPaths?: TechnologyTransferPathSummary[];
  papers: AnalyzePaper[];
  structuredFeatures: GeneEditingFeature[];
  fieldOverview: string;
  ideas: AnalyzeIdea[];
  evaluation: AnalyzeEvaluation;
  journalSuggestions: JournalSuggestion[];
  warnings: string[];
  usedFallback: boolean;
  sourceStatuses: AnalyzeSourceStatus[];
};
