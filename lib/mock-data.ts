export type RadarPaper = {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  publishedAt: string;
  doi: string;
  pmid?: string;
  modality: string;
  diseaseArea: string;
  stage: "Preclinical" | "Clinical" | "Platform";
  status: "Trending" | "Watchlist" | "Foundational";
  noveltyScore: number;
  momentumScore: number;
  translationalScore: number;
  evidenceScore: number;
  compositeScore: number;
  citationCount: number;
  clinicalSignal: string;
  keyTakeaway: string;
  marketSignal: string;
  journalSlug: string;
  authorIds: string[];
  geneSymbols: string[];
  topicSlugs: string[];
  organisms: string[];
  editorTypes: string[];
};

export type RadarJournal = {
  slug: string;
  name: string;
  publisher: string;
  summary: string;
  impactFactor: number;
  reviewSpeedDays: number;
  acceptanceRate: number;
  openAccess: boolean;
  region: string;
  coverageScore: number;
  topicSlugs: string[];
};

export type RadarAuthor = {
  id: string;
  name: string;
  affiliation: string;
  country: string;
};

export type RadarGeneTarget = {
  symbol: string;
  name: string;
  pathway: string;
};

export type RadarTopic = {
  slug: string;
  label: string;
  description: string;
};

export type RadarSubscription = {
  id: string;
  label: string;
  cadence: "Daily" | "Weekly" | "Biweekly";
  signalThreshold: number;
  notes: string;
  isActive: boolean;
  journalSlug?: string;
  topicSlug?: string;
  geneSymbol?: string;
  keywords: string[];
  authorNames: string[];
  journalNames: string[];
  organisms: string[];
  editorTypes: string[];
};

export type RadarIdea = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  customer: string;
  wedge: string;
  moat: string;
  risk: string;
  stage: "Discovery" | "Validation" | "Incubation";
  score: number;
  paperId?: string;
  topicSlug?: string;
};

export type RadarEvaluation = {
  id: string;
  ideaSlug: string;
  technicalFit: number;
  marketFit: number;
  defensibility: number;
  executionSpeed: number;
  compositeScore: number;
  verdict: "Strong" | "Watch" | "Pass";
  notes: string;
};

export type AnalyzeSeedPaper = {
  id: string;
  title: string;
  abstract: string;
  publishedAt: string;
  doi: string;
  pmid?: string;
  journal: string;
  authors: string[];
  organisms: string[];
  editorTypes: string[];
  keywords: string[];
};

export const topics: RadarTopic[] = [
  {
    slug: "base-editing",
    label: "碱基编辑",
    description: "以更低 indel 负担和更清晰修复谱系实现精确碱基改写。",
  },
  {
    slug: "delivery",
    label: "递送系统",
    description: "围绕 LNP、AAV 及混合递送体系的组织特异性编辑方案。",
  },
  {
    slug: "cell-therapy",
    label: "细胞治疗",
    description: "面向肿瘤、自身免疫与再生修复的离体编辑细胞治疗路径。",
  },
  {
    slug: "rare-disease",
    label: "罕见病",
    description: "聚焦单基因疾病，即使患者规模有限，仍可能支撑高价值治疗模式。",
  },
  {
    slug: "screening",
    label: "功能筛选",
    description: "通过 CRISPR 筛选与扰动图谱推动新靶点发现流程的建立。",
  },
];

export const authors: RadarAuthor[] = [
  { id: "ava-li", name: "Dr. Ava Li", affiliation: "Broad Institute", country: "United States" },
  { id: "mateo-silva", name: "Mateo Silva, PhD", affiliation: "Editas Translational Lab", country: "United States" },
  { id: "yuna-park", name: "Yuna Park, PhD", affiliation: "Seoul National University", country: "South Korea" },
  { id: "elias-okafor", name: "Elias Okafor, MD", affiliation: "University of Oxford", country: "United Kingdom" },
  { id: "nora-haddad", name: "Nora Haddad, PhD", affiliation: "ETH Zurich", country: "Switzerland" },
];

export const geneTargets: RadarGeneTarget[] = [
  { symbol: "PCSK9", name: "Proprotein convertase subtilisin/kexin type 9", pathway: "Lipid metabolism" },
  { symbol: "HBB", name: "Hemoglobin subunit beta", pathway: "Hemoglobin regulation" },
  { symbol: "TRAC", name: "T-cell receptor alpha constant", pathway: "T-cell engineering" },
  { symbol: "RPE65", name: "Retinal pigment epithelium-specific protein 65kDa", pathway: "Retinal disease" },
  { symbol: "TP53", name: "Tumor protein p53", pathway: "DNA damage surveillance" },
];

export const journals: RadarJournal[] = [
  {
    slug: "nature-biotechnology",
    name: "Nature Biotechnology",
    publisher: "Springer Nature",
    summary: "重点覆盖高信号转化生物学研究，对产业化与公司化判断具有较强参考价值。",
    impactFactor: 33.1,
    reviewSpeedDays: 27,
    acceptanceRate: 0.09,
    openAccess: false,
    region: "Global",
    coverageScore: 94,
    topicSlugs: ["base-editing", "delivery", "cell-therapy"],
  },
  {
    slug: "cell",
    name: "Cell",
    publisher: "Cell Press",
    summary: "聚焦机制突破与旗舰型论文，往往直接影响领域关注度与资源流向。",
    impactFactor: 45.5,
    reviewSpeedDays: 24,
    acceptanceRate: 0.08,
    openAccess: false,
    region: "Global",
    coverageScore: 91,
    topicSlugs: ["screening", "cell-therapy", "rare-disease"],
  },
  {
    slug: "molecular-therapy",
    name: "Molecular Therapy",
    publisher: "Elsevier",
    summary: "适合持续跟踪递送优化与治疗性编辑进展的稳定发表窗口。",
    impactFactor: 12.4,
    reviewSpeedDays: 31,
    acceptanceRate: 0.18,
    openAccess: true,
    region: "Global",
    coverageScore: 87,
    topicSlugs: ["delivery", "rare-disease", "base-editing"],
  },
  {
    slug: "crispr-journal",
    name: "The CRISPR Journal",
    publisher: "Mary Ann Liebert",
    summary: "专注 CRISPR 方向，可较快反映平台演进、监管变化与工具更新。",
    impactFactor: 5.9,
    reviewSpeedDays: 19,
    acceptanceRate: 0.22,
    openAccess: true,
    region: "North America",
    coverageScore: 79,
    topicSlugs: ["screening", "delivery", "cell-therapy"],
  },
];

export const papers: RadarPaper[] = [
  {
    id: "paper-pcsk9-prime-lnp",
    slug: "pcsk9-prime-lnp",
    title: "Programmable liver prime editing with tropism-tuned LNPs achieves durable PCSK9 knockdown in primates",
    abstract:
      "A modular prime editor payload paired with tropism-tuned lipid nanoparticles delivered high-efficiency hepatic editing, durable LDL reduction, and a reduced off-target profile in non-human primates.",
    publishedAt: "2026-05-16",
    doi: "",
    pmid: undefined,
    modality: "Prime editing + LNP",
    diseaseArea: "Cardiometabolic",
    stage: "Preclinical",
    status: "Trending",
    noveltyScore: 94,
    momentumScore: 89,
    translationalScore: 92,
    evidenceScore: 90,
    compositeScore: 91,
    citationCount: 34,
    clinicalSignal: "灵长类持久性读出有助于降低首人体给药方案设计的不确定性。",
    keyTakeaway: "先导编辑（PE）正在从平台层面的概念验证，走向慢性疾病场景下更可信的应用部署。",
    marketSignal: "为一批单次给药具备经济学吸引力的心血管代谢编辑项目提供了依据。",
    journalSlug: "nature-biotechnology",
    authorIds: ["ava-li", "mateo-silva"],
    geneSymbols: ["PCSK9"],
    topicSlugs: ["base-editing", "delivery", "rare-disease"],
    organisms: ["Primate"],
    editorTypes: ["Prime editing"],
  },
  {
    id: "paper-hbb-base-editor",
    slug: "hbb-base-editor",
    title: "In vivo adenine base editing rescues beta-thalassemia phenotypes through optimized HBB correction",
    abstract:
      "The study demonstrates high on-target HBB correction in hematopoietic stem cells, improved erythroid differentiation, and meaningful anemia rescue in a large-animal model.",
    publishedAt: "2026-04-28",
    doi: "",
    pmid: undefined,
    modality: "Adenine base editing",
    diseaseArea: "Rare disease",
    stage: "Clinical",
    status: "Trending",
    noveltyScore: 91,
    momentumScore: 84,
    translationalScore: 95,
    evidenceScore: 88,
    compositeScore: 90,
    citationCount: 28,
    clinicalSignal: "为血红蛋白病从 ex vivo 证据迈向更可扩展的 in vivo 治疗框架提供了桥梁。",
    keyTakeaway: "在部分单基因疾病中，制造负担更轻的编辑方案，可能优于高度定制化的自体治疗流程。",
    marketSignal: "这为提供疾病特异性编辑工具包的平台公司留下了空间，而不必局限于定制治疗模式。",
    journalSlug: "cell",
    authorIds: ["yuna-park", "elias-okafor"],
    geneSymbols: ["HBB"],
    topicSlugs: ["base-editing", "rare-disease"],
    organisms: ["Human", "Large animal"],
    editorTypes: ["Base editing", "Adenine base editing"],
  },
  {
    id: "paper-trac-armored-cells",
    slug: "trac-armored-cells",
    title: "Multiplex TRAC editing enables armored allogeneic T cells with improved persistence in solid tumors",
    abstract:
      "Researchers combined TRAC disruption, cytokine rewiring, and checkpoint resistance to create allogeneic T cells that persisted longer and showed stronger control of cold tumors in vivo.",
    publishedAt: "2026-04-07",
    doi: "",
    pmid: undefined,
    modality: "Multiplex CRISPR cell therapy",
    diseaseArea: "Oncology",
    stage: "Preclinical",
    status: "Watchlist",
    noveltyScore: 89,
    momentumScore: 82,
    translationalScore: 83,
    evidenceScore: 86,
    compositeScore: 85,
    citationCount: 22,
    clinicalSignal: "提示实体瘤项目中的异体细胞产品有机会获得更持久的体内维持能力。",
    keyTakeaway: "编辑壁垒可能更多来自组合式细胞状态设计，而不是单一基因敲除本身。",
    marketSignal: "有利于支撑帮助细胞治疗团队优化多重编辑流程的工具与分析平台。",
    journalSlug: "molecular-therapy",
    authorIds: ["mateo-silva", "nora-haddad"],
    geneSymbols: ["TRAC", "TP53"],
    topicSlugs: ["cell-therapy", "screening"],
    organisms: ["Mouse"],
    editorTypes: ["CRISPR", "Multiplex editing"],
  },
  {
    id: "paper-rpe65-retina",
    slug: "rpe65-retina",
    title: "Subretinal base editing of RPE65 corrects inherited blindness with low inflammatory burden",
    abstract:
      "A retina-optimized editor and promoter system restored visual function in rodent and canine models with favorable inflammation and biodistribution profiles.",
    publishedAt: "2026-03-19",
    doi: "",
    pmid: undefined,
    modality: "Base editing + AAV",
    diseaseArea: "Ophthalmology",
    stage: "Preclinical",
    status: "Foundational",
    noveltyScore: 86,
    momentumScore: 76,
    translationalScore: 88,
    evidenceScore: 84,
    compositeScore: 84,
    citationCount: 18,
    clinicalSignal: "受限的组织暴露特征使眼科成为验证持久编辑可行性的现实切入口。",
    keyTakeaway: "局部递送仍是降低下一代编辑器转化风险的最快路径之一。",
    marketSignal: "视网膜项目可作为递送平台与安全性平台的高价值切入市场。",
    journalSlug: "nature-biotechnology",
    authorIds: ["ava-li", "nora-haddad"],
    geneSymbols: ["RPE65"],
    topicSlugs: ["delivery", "rare-disease", "base-editing"],
    organisms: ["Rodent", "Canine"],
    editorTypes: ["Base editing"],
  },
  {
    id: "paper-crispr-screening-map",
    slug: "crispr-screening-map",
    title: "Perturbation atlases from pooled CRISPR screens uncover synthetic-lethal editing combinations in p53-deficient tumors",
    abstract:
      "An integrated single-cell perturbation map identified synthetic-lethal gene editing combinations that selectively impaired growth in TP53-deficient tumor models.",
    publishedAt: "2026-02-11",
    doi: "",
    pmid: undefined,
    modality: "CRISPR screening",
    diseaseArea: "Oncology",
    stage: "Platform",
    status: "Trending",
    noveltyScore: 92,
    momentumScore: 87,
    translationalScore: 79,
    evidenceScore: 85,
    compositeScore: 86,
    citationCount: 31,
    clinicalSignal: "在不要求立即进入治疗转化的前提下，为肿瘤编辑公司打开了靶点发现路径。",
    keyTakeaway: "筛选基础设施正在从内部隐性能力，转变为可被单独评估的投资层。",
    marketSignal: "为将编辑筛选结果沉淀为可复用知识产权图谱的软件与实验平台公司创造了机会。",
    journalSlug: "cell",
    authorIds: ["elias-okafor", "yuna-park"],
    geneSymbols: ["TP53"],
    topicSlugs: ["screening", "cell-therapy"],
    organisms: ["Mouse"],
    editorTypes: ["CRISPR", "CRISPR screening"],
  },
];

export const analysisSeedPapers: AnalyzeSeedPaper[] = [
  {
    id: "analysis-tomato-multibiofortification",
    title: "Multiplex gene editing enables the multibiofortification of essential vitamins and other health-promoting phytonutrients in tomato",
    abstract:
      'Dietary deficiencies in essential micronutrients and other phytonutrients represent a global health and economic burden, contributing to "hidden hunger" and chronic diseases. While genome editing has been employed to improve individual nutritional traits in crops, multibiofortification through simultaneous modification of multiple distinct metabolic pathways is more challenging. Here, we designed a multiplex CRISPR-Cas strategy to edit five key genes in tomato: Sl7-DR2, SlGAD3, SlSGR1, SlGGP1, and SlGGP2. This approach successfully generated quintuple mutant (5m) tomato lines simultaneously biofortified with seven health-promoting compounds: vitamin D3, vitamin C, provitamin A/beta-carotene, alpha-carotene, lutein, lycopene, and gamma-aminobutyric acid (GABA). Notably, these multibiofortified tomatoes exhibited no significant trade-offs in plant growth or fruit quality. Extracts from 5m tomatoes showed enhanced suppression of colorectal cancer cell proliferation in vitro. This antiproliferative effect was validated in vivo, where dietary supplementation with 5m tomato powder significantly inhibited tumor growth in a mouse xenograft model. Our work demonstrates an effective strategy for developing a next generation of functional foods through multibiofortification, creating a single, nutrient-dense crop that combats both micronutrient malnutrition and chronic diseases.',
    publishedAt: "2026-06-02",
    doi: "",
    pmid: undefined,
    journal: "Proc Natl Acad Sci U S A",
    authors: [
      "Hong Y",
      "Yu Z",
      "Zhu W",
      "Sun J",
      "Zhu Z",
      "Wang Z",
      "Cao M",
      "Lang Z",
      "Lyu YX",
      "Liu P",
      "Zhu JK",
    ],
    organisms: ["Tomato", "Mouse"],
    editorTypes: ["CRISPR", "Multiplex editing"],
    keywords: [
      "tomato",
      "multiplex gene editing",
      "multibiofortification",
      "phytonutrients",
      "vitamin C",
      "lycopene",
      "GABA",
      "trait application",
    ],
  },
];

export const subscriptions: RadarSubscription[] = [
  {
    id: "sub-liver-editing",
    label: "肝脏编辑监测",
    cadence: "Weekly",
    signalThreshold: 88,
    notes: "优先关注具备灵长类持久性证据或重复给药解决方案的项目。",
    isActive: true,
    topicSlug: "delivery",
    geneSymbol: "PCSK9",
    keywords: ["liver", "prime editing", "PCSK9", "LNP"],
    authorNames: ["Ava Li"],
    journalNames: ["Nature Biotechnology"],
    organisms: ["Primate"],
    editorTypes: ["Prime editing"],
  },
  {
    id: "sub-rare-disease",
    label: "罕见病碱基编辑订阅",
    cadence: "Daily",
    signalThreshold: 85,
    notes: "重点标记那些会显著改变可制造性或患者分层策略的论文。",
    isActive: true,
    topicSlug: "rare-disease",
    keywords: ["rare disease", "HBB", "beta-thalassemia", "manufacturability"],
    authorNames: ["Yuna Park", "Elias Okafor"],
    journalNames: ["Cell"],
    organisms: ["Human", "Large animal"],
    editorTypes: ["Base editing", "Adenine base editing"],
  },
  {
    id: "sub-cell-therapy",
    label: "异体细胞治疗监测",
    cadence: "Biweekly",
    signalThreshold: 82,
    notes: "持续跟踪多重编辑与抗耗竭设计方向。",
    isActive: true,
    journalSlug: "molecular-therapy",
    topicSlug: "cell-therapy",
    geneSymbol: "TRAC",
    keywords: ["allogeneic", "TRAC", "solid tumors", "persistence"],
    authorNames: ["Mateo Silva", "Nora Haddad"],
    journalNames: ["Molecular Therapy"],
    organisms: ["Mouse"],
    editorTypes: ["CRISPR", "Multiplex editing"],
  },
];

export const ideas: RadarIdea[] = [
  {
    id: "idea-prime-cardiometabolic",
    slug: "prime-cardiometabolic",
    title: "Single-dose cardiometabolic editing launcher",
    thesis: "Package liver-focused editing insights into a platform for one-time cardiometabolic interventions with payer-friendly durability modeling.",
    customer: "Therapeutic biotech teams expanding beyond rare disease into larger chronic markets.",
    wedge: "Start with PCSK9 benchmarking dashboards and preclinical design support for liver-tropic delivery.",
    moat: "Cross-paper evidence library linking payload architecture, tropism, and durability outcomes.",
    risk: "Clinical safety expectations in chronic disease may move faster than platform readiness.",
    stage: "Validation",
    score: 91,
    paperId: "paper-pcsk9-prime-lnp",
    topicSlug: "delivery",
  },
  {
    id: "idea-retina-safety-platform",
    slug: "retina-safety-platform",
    title: "Retina editing safety benchmark suite",
    thesis: "Build a validation layer for localized editing programs where tissue-specific inflammatory burden is the key go/no-go lever.",
    customer: "Ophthalmology-focused gene therapy startups and translational academic labs.",
    wedge: "Offer standardized safety design reviews and off-target stress testing panels.",
    moat: "Niche benchmark corpus around localized editing rather than broad genome-editing analytics.",
    risk: "Could become service-heavy without enough reusable IP or software leverage.",
    stage: "Discovery",
    score: 78,
    paperId: "paper-rpe65-retina",
    topicSlug: "rare-disease",
  },
  {
    id: "idea-screening-operating-system",
    slug: "screening-operating-system",
    title: "CRISPR screen intelligence operating system",
    thesis: "Turn perturbation datasets into investable target hypotheses and edit-design recommendations for oncology teams.",
    customer: "Precision oncology biotechs and platform incubators.",
    wedge: "Lead with synthetic-lethal target maps and decision support for experimental design.",
    moat: "Compounding proprietary graph of perturbation outcomes tied to tractable editing mechanisms.",
    risk: "Value may concentrate in a narrow slice of customers unless the workflow expands beyond discovery.",
    stage: "Incubation",
    score: 88,
    paperId: "paper-crispr-screening-map",
    topicSlug: "screening",
  },
];

export const evaluations: RadarEvaluation[] = [
  {
    id: "eval-prime-cardiometabolic",
    ideaSlug: "prime-cardiometabolic",
    technicalFit: 92,
    marketFit: 90,
    defensibility: 88,
    executionSpeed: 74,
    compositeScore: 86,
    verdict: "Strong",
    notes: "Strong strategic timing and clear customer demand, but requires careful sequencing into high-burden chronic indications.",
  },
  {
    id: "eval-retina-safety-platform",
    ideaSlug: "retina-safety-platform",
    technicalFit: 84,
    marketFit: 69,
    defensibility: 72,
    executionSpeed: 81,
    compositeScore: 77,
    verdict: "Watch",
    notes: "Fast to validate with experts, though upside depends on proving reusable benchmarking IP.",
  },
  {
    id: "eval-screening-operating-system",
    ideaSlug: "screening-operating-system",
    technicalFit: 86,
    marketFit: 82,
    defensibility: 91,
    executionSpeed: 68,
    compositeScore: 82,
    verdict: "Strong",
    notes: "Compelling moat if early customers treat the datasets as a strategic asset rather than a one-off service output.",
  },
];

export function getPaperById(id: string) {
  return papers.find((paper) => paper.id === id || paper.slug === id);
}

export function getJournalBySlug(slug: string) {
  return journals.find((journal) => journal.slug === slug);
}

export function getIdeaBySlug(slug: string) {
  return ideas.find((idea) => idea.slug === slug);
}

export function getDashboardMetrics() {
  const highSignalPapers = papers.filter((paper) => paper.compositeScore >= 88);
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.isActive);
  const averageCompositeScore = Math.round(
    papers.reduce((sum, paper) => sum + paper.compositeScore, 0) / papers.length,
  );

  return {
    highSignalPapers: highSignalPapers.length,
    activeSubscriptions: activeSubscriptions.length,
    trackedJournals: journals.length,
    averageCompositeScore,
  };
}
