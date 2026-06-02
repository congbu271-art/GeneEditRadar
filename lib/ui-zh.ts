import type { RadarPaper } from "@/lib/mock-data";
import { NOT_REPORTED, buildExtractionSourceFromRadarPaper, extractGeneEditingDetailsRuleBased } from "@/lib/paper-extraction";
import type { GeneEditingIdeaEvaluation, GeneratedResearchIdea, ResearchIdeaType } from "@/lib/research-ideas";

const paperStatusMap: Record<string, string> = {
  Trending: "热点追踪",
  Watchlist: "持续观察",
  Foundational: "基础必读",
};

const paperStageMap: Record<string, string> = {
  Preclinical: "临床前",
  Clinical: "临床",
  Platform: "平台研究",
};

const cadenceMap: Record<string, string> = {
  Daily: "每日",
  Weekly: "每周",
  Biweekly: "双周",
};

const modalityMap: Record<string, string> = {
  "Prime editing + LNP": "先导编辑（PE）+ 脂质纳米颗粒（LNP）",
  "Adenine base editing": "腺嘌呤碱基编辑（ABE）",
  "Multiplex CRISPR cell therapy": "多重 CRISPR 细胞治疗",
  "Base editing + AAV": "碱基编辑（BE）+ 腺相关病毒（AAV）",
  "CRISPR screening": "CRISPR 筛选",
};

const diseaseAreaMap: Record<string, string> = {
  Cardiometabolic: "心血管代谢",
  "Rare disease": "罕见病",
  Oncology: "肿瘤",
  Ophthalmology: "眼科",
};

const regionMap: Record<string, string> = {
  Global: "全球",
  "North America": "北美",
};

const ideaTypeMap: Record<ResearchIdeaType, string> = {
  "tool transfer": "工具迁移型",
  "organism transfer": "新物种应用型",
  "delivery optimization": "递送优化型",
  "editor optimization": "工具创新型",
  "trait application": "性状应用型",
  "off-target reduction": "脱靶控制型",
};

const generatedIdeaStageMap: Record<string, string> = {
  "High priority": "高优先级",
  Promising: "值得推进",
  Speculative: "探索储备",
};

const articleTypeMap: Record<string, string> = {
  "proof-of-concept transfer article": "技术验证型",
  "translational organism-transfer study": "新物种应用型",
  "delivery optimization article": "方法优化型",
  "editor engineering or methods paper": "工具创新型",
  "disease-application research article": "性状应用型",
  "safety and specificity methods article": "方法优化型",
};

const journalTierMap: Record<string, string> = {
  "top-tier biotech or flagship translational journal": "高水平生物技术或旗舰转化期刊",
  "strong specialty translational journal": "高质量专业转化期刊",
  "field-leading specialty journal": "领域内领先专业期刊",
  "focused application or methods journal": "聚焦应用或方法学期刊",
};

const sourceNameMap: Record<string, string> = {
  pubmed: "PubMed",
  "europe-pmc": "Europe PMC",
  crossref: "Crossref",
  mock: "内置模拟数据",
};

const paperAbstractMap: Record<string, string> = {
  "paper-pcsk9-prime-lnp":
    "该研究将模块化先导编辑器载荷与嗜性调控的脂质纳米颗粒结合，在非人灵长类中实现了高效率肝脏编辑、持久 LDL 降低以及较低脱靶特征。",
  "paper-hbb-base-editor":
    "该研究在造血干细胞中实现了较高的 HBB 在靶纠正，改善了红系分化，并在大动物模型中获得了明确的贫血表型缓解。",
  "paper-trac-armored-cells":
    "研究者结合了 TRAC 破坏、细胞因子重编程与检查点耐受设计，构建出在体内维持更久、且能更有效控制冷肿瘤的异体 T 细胞。",
  "paper-rpe65-retina":
    "该研究通过视网膜优化的编辑器与启动子系统，在啮齿类和犬模型中恢复了视觉功能，并呈现较优的炎症与体内分布特征。",
  "paper-crispr-screening-map":
    "该研究结合单细胞扰动图谱，识别出选择性抑制 TP53 缺陷肿瘤模型生长的合成致死编辑组合。",
};

const exactTermMap: Record<string, string> = {
  Human: "人",
  Primate: "灵长类",
  Mouse: "小鼠",
  Rat: "大鼠",
  Rodent: "啮齿类",
  Canine: "犬",
  "Large animal": "大动物",
  Zebrafish: "斑马鱼",
  Tomato: "番茄",
  Rice: "水稻",
  Wheat: "小麦",
  Maize: "玉米",
  Soybean: "大豆",
  Arabidopsis: "拟南芥",
  "Prime editing": "先导编辑（PE）",
  "prime editing": "先导编辑（PE）",
  "Base editing": "碱基编辑（BE）",
  "base editing": "碱基编辑（BE）",
  "Adenine base editing": "腺嘌呤碱基编辑（ABE）",
  "adenine base editing": "腺嘌呤碱基编辑（ABE）",
  "Cytosine base editing": "胞嘧啶碱基编辑（CBE）",
  "rare disease": "罕见病",
  liver: "肝脏",
  manufacturability: "可制造性",
  allogeneic: "异体",
  persistence: "持久性",
  "solid tumors": "实体瘤",
  "localized delivery": "局部递送",
  "Prime editing + LNP": "先导编辑（PE）+ 脂质纳米颗粒（LNP）",
  "Multiplex CRISPR cell therapy": "多重 CRISPR 细胞治疗",
  "Base editing + AAV": "碱基编辑（BE）+ 腺相关病毒（AAV）",
  CRISPR: "CRISPR",
  "CRISPR screening": "CRISPR 筛选",
  "Multiplex editing": "多重编辑",
  "Cas9 editing": "Cas9 编辑",
  "Cas12 editing": "Cas12 编辑",
  LNP: "脂质纳米颗粒（LNP）",
  AAV: "腺相关病毒（AAV）",
  "subretinal delivery": "视网膜下递送",
  "ex vivo delivery": "离体递送",
  "in vivo delivery": "体内递送",
  electroporation: "电转递送",
  "prime editor": "先导编辑器（PE）",
  "adenine base editor": "腺嘌呤碱基编辑器（ABE）",
  "cytosine base editor": "胞嘧啶碱基编辑器（CBE）",
  "base editor": "碱基编辑器（BE）",
  "CRISPR screening system": "CRISPR 筛选系统",
  "CRISPR-Cas12": "CRISPR-Cas12",
  "CRISPR-Cas9": "CRISPR-Cas9",
  "CRISPR system": "CRISPR 系统",
  "preclinical study": "临床前研究",
  "clinical study": "临床研究",
  "platform study": "平台研究",
  "platform screening study": "平台筛选研究",
  "trait application study": "性状应用研究",
  "translational study": "转化研究",
  "rule-based": "规则提取",
  "rule-based+llm": "规则提取 + LLM 校正",
  "custom payload architecture": "自定义载荷架构",
  "cholesterol lowering": "降胆固醇效应",
  "modular prime editor payload": "模块化先导编辑器载荷",
  "tropism-tuned LNPs": "嗜性调控脂质纳米颗粒（LNP）",
  "retina-optimized editor": "视网膜优化编辑器",
  "armored allogeneic T cells": "增强型异体 T 细胞",
  "PCSK9 knockdown / LDL reduction": "PCSK9 下调 / LDL 降低",
  "anemia rescue": "贫血表型改善",
  "visual function restoration": "视觉功能恢复",
  "multibiofortification / nutrient-dense crop improvement": "多营养强化 / 营养密度作物改良",
  "vitamin and phytonutrient enrichment": "维生素与植物营养素强化",
  "fruit quality and nutritional trait improvement": "果实品质与营养性状改良",
  "not reported": "未报告",
};

const phraseReplacements: Array<[RegExp, string]> = [
  [/\bhigh-efficiency hepatic editing\b/gi, "高效率肝脏编辑"],
  [/\bdurable LDL reduction\b/gi, "持久 LDL 降低"],
  [/\breduced off-target profile\b/gi, "较低脱靶特征"],
  [/\boff-target profile\b/gi, "脱靶特征"],
  [/\bimproved erythroid differentiation\b/gi, "红系分化改善"],
  [/\bmeaningful anemia rescue\b/gi, "明确的贫血表型改善"],
  [/\bvisual function\b/gi, "视觉功能"],
  [/\blow inflammatory burden\b/gi, "低炎症负担"],
  [/\bfavorable inflammation and biodistribution profiles\b/gi, "较优的炎症与体内分布特征"],
  [/\bsynthetic-lethal\b/gi, "合成致死"],
  [/\bbeta-thalassemia\b/gi, "β-地中海贫血"],
  [/\bmultibiofortification\b/gi, "多营养强化"],
  [/\bphytonutrients?\b/gi, "植物营养素"],
  [/\bvitamin d3\b/gi, "维生素 D3"],
  [/\bvitamin c\b/gi, "维生素 C"],
  [/\blycopene\b/gi, "番茄红素"],
  [/\blutein\b/gi, "叶黄素"],
  [/\bgaba\b/gi, "γ-氨基丁酸（GABA）"],
  [/\bfruit quality\b/gi, "果实品质"],
  [/\btrade-offs?\b/gi, "权衡代价"],
  [/\btumor growth\b/gi, "肿瘤生长"],
  [/\bsolid tumors\b/gi, "实体瘤"],
  [/\bretina\b/gi, "视网膜"],
  [/\boff-target\b/gi, "脱靶"],
  [/\bbiodistribution\b/gi, "体内分布"],
  [/\bdurability\b/gi, "持久性"],
  [/\brepeat dosing\b/gi, "重复给药"],
  [/\bspecificity\b/gi, "特异性"],
  [/\bphenotype\b/gi, "表型"],
  [/\bprimate\b/gi, "灵长类"],
  [/\bhumanized\b/gi, "人源化"],
  [/\borganoid\b/gi, "类器官"],
];

function replaceCommonPhrases(value: string) {
  return phraseReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function humanizeList(values: string[]) {
  return values.filter(Boolean).join("、");
}

function getPaperPrimaryGene(paper?: RadarPaper) {
  return paper?.geneSymbols[0] ?? "目标基因";
}

function getPaperOrganismText(paper?: RadarPaper) {
  return paper ? humanizeList(paper.organisms.map(toZhTerm)) : "目标模型";
}

function getPaperDiseaseAreaText(paper?: RadarPaper) {
  return paper ? toZhDiseaseArea(paper.diseaseArea) : "相关适应症";
}

function getPaperDeliveryText(paper?: RadarPaper) {
  if (!paper) {
    return "既有递送体系";
  }

  const extraction = extractGeneEditingDetailsRuleBased(buildExtractionSourceFromRadarPaper(paper));
  return extraction.deliveryMethod === NOT_REPORTED ? toZhModality(paper.modality) : toZhExtractionValue(extraction.deliveryMethod);
}

function getPaperEditingToolText(paper?: RadarPaper) {
  if (!paper) {
    return "编辑体系";
  }

  const extraction = extractGeneEditingDetailsRuleBased(buildExtractionSourceFromRadarPaper(paper));
  return extraction.editingTool === NOT_REPORTED ? toZhModality(paper.modality) : toZhExtractionValue(extraction.editingTool);
}

function getPaperTraitText(paper?: RadarPaper) {
  if (!paper) {
    return "相邻性状场景";
  }

  switch (paper.id) {
    case "paper-pcsk9-prime-lnp":
      return "相邻肝脏分泌型心代谢靶点";
    case "paper-hbb-base-editor":
      return "其他血红蛋白病纠正场景";
    case "paper-trac-armored-cells":
      return "其他持久性受限的实体瘤细胞治疗场景";
    case "paper-rpe65-retina":
      return "其他遗传性视网膜变性性状";
    case "paper-crispr-screening-map":
      return "新的肿瘤合成致死靶点假设";
    default:
      return `${getPaperDiseaseAreaText(paper)}相邻性状`;
  }
}

function getIdeaTransferTarget(paper?: RadarPaper) {
  if (!paper) {
    return "新适应症场景";
  }

  switch (paper.id) {
    case "paper-pcsk9-prime-lnp":
      return "相邻肝脏心代谢适应症";
    case "paper-hbb-base-editor":
      return "其他单基因血液病场景";
    case "paper-trac-armored-cells":
      return "其他实体瘤异体细胞治疗场景";
    case "paper-rpe65-retina":
      return "其他遗传性视网膜病场景";
    case "paper-crispr-screening-map":
      return "新的肿瘤靶点发现工作流";
    default:
      return "相关相邻适应症";
  }
}

function getIdeaOrganismTarget(paper?: RadarPaper) {
  if (!paper) {
    return "更高保真验证模型";
  }

  if (paper.organisms.includes("Primate")) {
    return "人肝类器官与重复给药肝脏模型";
  }

  if (paper.organisms.includes("Human")) {
    return "非人灵长类与人源化验证模型";
  }

  if (paper.organisms.includes("Canine") || paper.organisms.includes("Rodent")) {
    return "更接近临床给药场景的大动物眼科模型";
  }

  if (paper.organisms.includes("Mouse")) {
    return "人源化或患者来源验证体系";
  }

  return "新的转化物种场景";
}

function getIdeaDeliveryFocus(paper?: RadarPaper) {
  if (!paper) {
    return "组织选择性与持久性";
  }

  const delivery = getPaperDeliveryText(paper);

  if (delivery.includes("LNP")) {
    return "重复给药耐受性与肝外选择性";
  }

  if (delivery.includes("AAV")) {
    return "衣壳节约用量与局部体内分布控制";
  }

  if (delivery.includes("视网膜下")) {
    return "手术给药一致性与视网膜扩散控制";
  }

  if (delivery.includes("离体")) {
    return "生产速度与细胞状态保持";
  }

  return "组织暴露选择性与持久性";
}

function getIdeaEditorFocus(paper?: RadarPaper) {
  if (!paper) {
    return "编辑效率与特异性";
  }

  const tool = getPaperEditingToolText(paper);

  if (tool.includes("先导编辑")) {
    return "pegRNA 架构与载荷压缩";
  }

  if (tool.includes("ABE") || tool.includes("碱基编辑")) {
    return "编辑窗口控制与特异性";
  }

  if (tool.includes("筛选")) {
    return "文库设计精度与扰动深度";
  }

  return "向导序列架构与表达时序";
}

export function toZhPaperStatus(value: string) {
  return paperStatusMap[value] ?? value;
}

export function toZhPaperStage(value: string) {
  return paperStageMap[value] ?? value;
}

export function toZhCadence(value: string) {
  return cadenceMap[value] ?? value;
}

export function toZhModality(value: string) {
  return modalityMap[value] ?? value;
}

export function toZhDiseaseArea(value: string) {
  return diseaseAreaMap[value] ?? value;
}

export function toZhRegion(value: string) {
  return regionMap[value] ?? value;
}

export function toZhSourceName(value: string) {
  return sourceNameMap[value] ?? value;
}

export function toZhIdeaType(value: ResearchIdeaType) {
  return ideaTypeMap[value] ?? value;
}

export function toZhIdeaStage(value: string) {
  return generatedIdeaStageMap[value] ?? value;
}

export function toZhArticleType(value: string) {
  return articleTypeMap[value] ?? value;
}

export function toZhJournalTier(value: string) {
  return journalTierMap[value] ?? value;
}

export function toZhTerm(value: string) {
  if (!value) {
    return value;
  }

  if (exactTermMap[value]) {
    return exactTermMap[value];
  }

  if (value.includes(",")) {
    return humanizeList(
      value
        .split(",")
        .map((item) => item.trim())
        .map((item) => exactTermMap[item] ?? replaceCommonPhrases(item)),
    );
  }

  return replaceCommonPhrases(value);
}

export function toZhExtractionValue(value: string) {
  if (exactTermMap[value]) {
    return exactTermMap[value];
  }

  return toZhTerm(value);
}

export function toZhSourceError(error?: string) {
  return error ? `接口异常：${error}` : "数据源暂不可用";
}

export function toZhMatchReason(reason: string) {
  if (reason.startsWith("Keyword: ")) {
    return `关键词：${toZhTerm(reason.replace("Keyword: ", ""))}`;
  }

  if (reason.startsWith("Author: ")) {
    return `作者：${reason.replace("Author: ", "")}`;
  }

  if (reason.startsWith("Journal: ")) {
    return `期刊：${reason.replace("Journal: ", "")}`;
  }

  if (reason.startsWith("Organism: ")) {
    return `研究物种：${toZhTerm(reason.replace("Organism: ", ""))}`;
  }

  if (reason.startsWith("Editor: ")) {
    return `编辑类型：${toZhTerm(reason.replace("Editor: ", ""))}`;
  }

  return toZhTerm(reason);
}

export function toZhFilterItem(value: string) {
  return toZhTerm(value);
}

export function toZhOpenAccessBadge(openAccess: boolean) {
  return openAccess ? "开放获取" : "选择性收录";
}

export function getZhPaperAbstract(paperId?: string, fallback?: string) {
  if (paperId && paperAbstractMap[paperId]) {
    return paperAbstractMap[paperId];
  }

  return fallback ?? "";
}

export function toZhIncrementalBadge(isIncremental: boolean) {
  return isIncremental ? "低创新增量风险" : "具备差异化角度";
}

export function getLocalizedIdeaCopy(idea: GeneratedResearchIdea & { paper?: RadarPaper }) {
  const paper = idea.paper;
  const gene = getPaperPrimaryGene(paper);
  const diseaseArea = getPaperDiseaseAreaText(paper);
  const tool = getPaperEditingToolText(paper);
  const delivery = getPaperDeliveryText(paper);
  const transferTarget = getIdeaTransferTarget(paper);
  const organismTarget = getIdeaOrganismTarget(paper);
  const deliveryFocus = getIdeaDeliveryFocus(paper);
  const editorFocus = getIdeaEditorFocus(paper);
  const traitTarget = getPaperTraitText(paper);
  const organismText = getPaperOrganismText(paper);

  switch (idea.ideaType) {
    case "tool transfer":
      return {
        title: `将 ${tool} 从 ${gene} 场景迁移至 ${transferTarget}`,
        thesis: `基于源论文的 ${delivery} 工作流，验证同一编辑架构在 ${transferTarget} 中能否形成可发表的表型信号，并说明其平台迁移价值。`,
        customer: "适配团队：已掌握源论文实验体系、并拥有相邻疾病模型的转化研究团队。",
        wedge: `最低切入：围绕 ${gene} 之外的第二靶点重建迁移实验，并保持可比的递送与读出设置。`,
        moat: "发表价值：若迁移成功，说明该论文的关键进展具备平台可迁移性，而非单一靶点案例。",
        risk: "主要风险：效应可能更多依赖组织环境，而不是编辑架构本身。",
      };
    case "organism transfer":
      return {
        title: `将 ${gene} 编辑验证推进到 ${organismTarget}`,
        thesis: `把当前在 ${organismText} 中建立的编辑逻辑，推进到 ${organismTarget}，检验其在更高转化难度模型中的稳健性。`,
        customer: "适配团队：同时掌握原始模型与更高保真验证模型的平台型课题组。",
        wedge: `最低切入：在 ${organismTarget} 中复现核心编辑与剂量设计，比较编辑率、暴露与表型改善。`,
        moat: "发表价值：物种迁移通常是把优雅的编辑化学推进到更具转化分量论文的关键桥梁。",
        risk: "主要风险：剂量、免疫背景或组织可达性变化会显著削弱效果。",
      };
    case "delivery optimization":
      return {
        title: `围绕 ${delivery} 优化 ${deliveryFocus}`,
        thesis: `以源论文的递送框架为基础，围绕 ${deliveryFocus} 做系统优化，同时保持同一编辑读出与表型信号，并突出重复给药、体内分布与持久性改进。`,
        customer: "适配团队：可快速迭代制剂、体内分布与表型读出的递送工程实验室。",
        wedge: `最低切入：建立优化前后递送方案对比，联合量化体内分布、编辑效率与功能表型。`,
        moat: "发表价值：若改进能直接落在剂量、持久性或安全性上，往往最容易形成后续论文。",
        risk: "主要风险：暴露改善未必能转化为足够有说服力的表型提升。",
      };
    case "editor optimization":
      return {
        title: `为 ${gene} 构建更优的 ${tool}`,
        thesis: `围绕 ${editorFocus} 重新工程化 ${tool}，使研究贡献落在编辑器本身的性能提升，而不仅是重复源论文表型，并突出特异性、载荷与效率收益。`,
        customer: "适配团队：具备快速构建迭代能力，并可直接接入源论文实验体系的编辑器工程团队。",
        wedge: `最低切入：比较优化前后编辑器在效率、纯度与表型读出上的变化。`,
        moat: "发表价值：如果特异性或载荷优势真实存在，编辑器优化结果往往可跨靶点迁移。",
        risk: "主要风险：性能增益过小或情境依赖过强，难以支撑独立论文贡献。",
      };
    case "trait application":
      return {
        title: `将 ${tool} 应用于 ${traitTarget}`,
        thesis: `以源论文为起点，把同一编辑模式迁移到 ${traitTarget}，围绕新的表型终点构建应用型研究。`,
        customer: "适配团队：希望在相邻适应症中快速复用成熟编辑化学的疾病研究团队。",
        wedge: `最低切入：定义新的性状终点，并在保留核心编辑策略的同时重设疾病模型与评价指标。`,
        moat: "发表价值：高质量的性状迁移研究能够在不重新发明整个平台的前提下打开新适应症切口。",
        risk: "主要风险：如果模型升级或表型终点不够差异化，容易被视为跟随性应用。",
      };
    case "off-target reduction":
      return {
        title: `降低 ${tool} 在 ${gene} 编辑中的脱靶负担`,
        thesis: `围绕更低脱靶与炎症负担重构工作流，在保留核心编辑与表型信号的同时强化脱靶、特异性与炎症控制叙事。`,
        customer: "适配团队：能够把编辑效率测定与正交安全性读出结合起来的转化安全团队。",
        wedge: "最低切入：在同一模型中同步测量在靶编辑、脱靶、炎症与体内分布，并评估安全性增益是否保留有效性。",
        moat: "发表价值：可信的特异性提升既能提升文章质量，也能增强后续采用的实际说服力。",
        risk: "主要风险：安全性改进可能以显著牺牲有效性为代价。",
      };
  }
}

export function getLocalizedEvaluationCopy(
  evaluation: GeneEditingIdeaEvaluation,
  sourcePaper?: RadarPaper,
) {
  const paper = sourcePaper;
  const gene = getPaperPrimaryGene(paper);
  const tool = getPaperEditingToolText(paper);
  const delivery = getPaperDeliveryText(paper);

  const packages: Record<ResearchIdeaType, string[]> = {
    "tool transfer": [
      `围绕 ${gene} 之外的第二靶点，重建源论文中的编辑工作流。`,
      "在迁移场景中同时展示在靶编辑效率与性状相关功能读出。",
      "与源论文条件进行可比对照，说明迁移是否成立。",
    ],
    "organism transfer": [
      `在 ${getIdeaOrganismTarget(paper)} 中复现核心编辑设计。`,
      "同时测量编辑率、药效表型与暴露特征。",
      "通过匹配的 guide RNA（gRNA）与剂量对照，证明物种迁移的可比性。",
    ],
    "delivery optimization": [
      `围绕 ${delivery} 优化 ${getIdeaDeliveryFocus(paper)}。`,
      "联合量化体内分布、编辑效率与功能表型。",
      "与源论文递送条件做直接基准比较。",
    ],
    "editor optimization": [
      `围绕 ${tool} 优化 ${getIdeaEditorFocus(paper)}。`,
      "比较优化前后在编辑纯度、在靶效率与表型读出上的差异。",
      "说明优化设计在降剂量条件下是否仍保有效性。",
    ],
    "trait application": [
      `将同一编辑平台转用于 ${getPaperTraitText(paper)}。`,
      "证明在新性状中同时具备在靶编辑与疾病相关表型改善。",
      "设置与原始性状或原始靶点类别的直接对照。",
    ],
    "off-target reduction": [
      `围绕 ${tool} 建立更低风险的 guide RNA（gRNA）、载荷或表达时序控制。`,
      "同步测量在靶编辑、脱靶/炎症与体内分布读出。",
      "证明特异性提升并未抹去核心表型信号。",
    ],
  };

  const additionalExperiments: Record<ResearchIdeaType, string[]> = {
    "tool transfer": [
      "增加至少两个时间点的持久性测量。",
      "补充脱靶或转录组层面的安全性分析。",
      "与更简单的编辑器或递送基线做对比。",
    ],
    "organism transfer": [
      "若模型允许，增加重复给药或纵向随访。",
      "比较不同物种间的免疫激活或炎症负担。",
      "对表型变化增加正交分子验证。",
    ],
    "delivery optimization": [
      "补充重复给药兼容性或再给药实验。",
      "增加载荷完整性与组织选择性表达读出。",
      "用临床熟悉的递送对照评估安全性。",
    ],
    "editor optimization": [
      "补充编辑窗口或旁观者编辑分析。",
      "增加表达动力学或载荷大小测量。",
      "测试降剂量后是否仍保持有效性。",
    ],
    "trait application": [
      "围绕新性状增加剂量反应或 guide 选择筛选。",
      "在具临床意义时加入持久性与可逆性评估。",
      "补充适配新疾病场景的安全性分析。",
    ],
    "off-target reduction": [
      "增加靶向测序或无偏方法的正交脱靶验证。",
      "比较瞬时暴露与持续暴露的差异。",
      "在第二个 guide 或靶点中验证特异性策略。",
    ],
  };

  return {
    classification: toZhIdeaType(evaluation.primaryIdeaType),
    articleType: toZhArticleType(evaluation.articleType),
    journalTier: toZhJournalTier(evaluation.journalTier),
    warning: toZhEvaluationWarning(evaluation.warning),
    rationale: evaluation.rationale.map(toZhEvaluationRationale),
    minimumExperimentalPackage: packages[evaluation.primaryIdeaType],
    additionalExperiments: additionalExperiments[evaluation.primaryIdeaType],
  };
}

export function toZhEvaluationWarning(value?: string) {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("Too incremental right now.")) {
    return "当前方案仍偏增量化。建议加入新的研究物种、更强的安全性角度，或明显不同的表型数据包。";
  }

  if (value.startsWith("The scope is still fuzzy.")) {
    return "当前研究范围仍偏宽泛，建议先收紧最小实验切口，再将其视为成熟论文方案。";
  }

  return value;
}

export function toZhEvaluationRationale(value: string) {
  if (value.startsWith("Anchored to ")) {
    return `锚定来源论文：${value.replace("Anchored to ", "").replace(/\.$/, "")}。`;
  }

  if (value === "The proposal introduces a transfer step beyond the original paper context.") {
    return "该方案引入了超出原论文语境的迁移步骤，有助于形成新的研究边界。";
  }

  if (value === "Safety or specificity language improves paperability and translational framing.") {
    return "方案包含安全性或特异性维度，有助于提升文章可发表性与转化叙事力度。";
  }

  if (value === "A visible phenotype endpoint supports publication potential.") {
    return "明确的表型终点有助于提升发表潜力。";
  }

  if (value === "The idea still overlaps heavily with the source context and needs a sharper differentiator.") {
    return "该方案与来源论文语境仍有较高重叠，需要进一步强化差异化设计。";
  }

  return value;
}
