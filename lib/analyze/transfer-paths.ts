import type { GeneEditingExtraction } from "@/lib/paper-extraction";
import { NOT_REPORTED } from "@/lib/paper-extraction";
import type {
  TechnologyTransferPath,
  TechnologyTransferPathSummary,
} from "@/lib/analyze-types";
import { normalizeTitle } from "@/lib/shared-utils";
import { DISPLAY_NOT_REPORTED } from "@/lib/shared-utils";
import type { IdeaSeedPaper } from "@/lib/research-ideas";
import {
  transferPathOrder,
  transferPathLabelMap,
  DEFAULT_PAPER_IDEA_LIMIT,
  priorityWeight,
} from "./helpers";

// ---------- Keyword Detection Helpers ----------

export function isPlantKeyword(text: string) {
  return /\b(rice|oryza|wheat|maize|corn|soybean|soy|tomato|arabidopsis|plant|crop|dicot|monocot|callus|agrobacterium)\b/.test(text);
}

export function isMonocotKeyword(text: string) {
  return /\b(rice|oryza|wheat|maize|corn|barley|sorghum)\b/.test(text);
}

export function isDicotCropKeyword(text: string) {
  return /\b(tomato|soybean|soy|cotton|potato|canola|rapeseed)\b/.test(text);
}

export function isModelPlantKeyword(text: string) {
  return /\b(arabidopsis|nicotiana|model plant)\b/.test(text);
}

export function isAnimalOrCellKeyword(text: string) {
  return /\b(human|primate|mouse|mice|murine|rat|dog|canine|zebrafish|animal|mammalian|hek|hela|293t|stem cell|stem cells|cell line|cell lines|organoid|organoids|human cells|mammalian cells)\b/.test(text);
}

export function isMammalianCellKeyword(text: string) {
  return /\b(mammalian cell|mammalian cells|human cell|human cells|cell line|cell lines|hek|hela|293t|stem cell|stem cells|organoid|organoids)\b/.test(text);
}

export function isPeOrBeKeyword(text: string) {
  return /\b(prime editing|prime editor|base editing|base editor|abe|cbe|pe)\b/.test(text);
}

export function isMultiplexOrPathwayKeyword(text: string) {
  return /\b(multiplex|multigene|multi-gene|multi gene|pathway|quintuple|simultaneous(?:ly)?|five key genes)\b/.test(text);
}

// ---------- Classification Helpers ----------

export function buildSeedClassificationText(
  paper: Pick<IdeaSeedPaper, "title" | "abstract" | "organisms" | "editorTypes" | "geneSymbols" | "modality" | "diseaseArea">,
  extraction: Pick<
    GeneEditingExtraction,
    | "editingTool"
    | "editorVariant"
    | "editingType"
    | "organism"
    | "deliveryMethod"
    | "targetGene"
    | "targetTrait"
    | "mainInnovation"
    | "limitations"
    | "paperType"
    | "offTargetAnalysis"
    | "phenotypeValidation"
  >,
) {
  return normalizeTitle(
    [
      paper.title,
      paper.abstract,
      paper.modality,
      paper.diseaseArea,
      ...paper.organisms,
      ...paper.editorTypes,
      ...paper.geneSymbols,
      extraction.editingTool,
      extraction.editorVariant,
      extraction.editingType,
      extraction.organism,
      extraction.deliveryMethod,
      extraction.targetGene,
      extraction.targetTrait,
      extraction.mainInnovation,
      extraction.limitations,
      extraction.paperType,
      extraction.offTargetAnalysis,
      extraction.phenotypeValidation,
    ].join(" "),
  );
}

export function determineTransferPathPriority(path: TechnologyTransferPath, text: string): "高" | "中" | "低" {
  const hasLimitedPriorReports = /\b(not yet reported in plants|limited prior reports|few reports|first in plants)\b/.test(text);

  switch (path) {
    case "mammalian_cell_to_plant":
    case "animal_to_plant":
      return hasLimitedPriorReports ? "高" : "高";
    case "monocot_to_dicot":
    case "crop_to_crop":
      return "高";
    case "model_plant_to_crop":
    case "tool_to_trait":
    case "efficiency_optimization":
    case "delivery_optimization":
    case "specificity_optimization":
      return "中";
    case "single_target_to_multiplex":
      return "中";
  }
}

export function buildTransferPathSummary(
  path: TechnologyTransferPath,
  rationale: string,
  priority?: "高" | "中" | "低",
): TechnologyTransferPathSummary {
  return {
    path,
    label: transferPathLabelMap[path],
    rationale,
    priority: priority ?? determineTransferPathPriority(path, rationale),
    reliabilityLabel: "规则解析",
  };
}

export function inferPaperArchetype(
  paper: Pick<IdeaSeedPaper, "title" | "abstract" | "diseaseArea">,
  extraction: Pick<
    GeneEditingExtraction,
    "mainInnovation" | "targetTrait" | "phenotypeValidation" | "paperType" | "deliveryMethod" | "offTargetAnalysis"
  >,
) {
  const text = buildSeedClassificationText(
    {
      ...paper,
      organisms: [],
      editorTypes: [],
      geneSymbols: [],
      modality: "",
    },
    {
      editingTool: NOT_REPORTED,
      editorVariant: NOT_REPORTED,
      editingType: NOT_REPORTED,
      organism: NOT_REPORTED,
      deliveryMethod: extraction.deliveryMethod,
      targetGene: NOT_REPORTED,
      targetTrait: extraction.targetTrait,
      mainInnovation: extraction.mainInnovation,
      limitations: NOT_REPORTED,
      paperType: extraction.paperType,
      offTargetAnalysis: extraction.offTargetAnalysis,
      phenotypeValidation: extraction.phenotypeValidation,
    },
  );

  const isToolOptimization = /\b(optimized|optimization|variant|architecture|scaffold|promoter|nls|pegRNA|sgRNA|compare|comparison|engineering|compact|payload|improve efficiency|enhancing efficiency|tool platform|toolkit)\b/.test(
    text,
  );
  const isTraitApplication =
    extraction.targetTrait !== NOT_REPORTED ||
    extraction.phenotypeValidation !== NOT_REPORTED ||
    /\b(trait|yield|quality|nutrition|nutritional|biofortification|phytonutrient|vitamin|fruit|resistance|phenotype|agronomic|disease|rescue|blindness|anemia)\b/.test(
      text,
    );
  const isDeliveryFocused = extraction.deliveryMethod !== NOT_REPORTED || /\b(delivery|lnp|aav|electroporation|agrobacterium)\b/.test(text);
  const isSpecificityFocused =
    extraction.offTargetAnalysis !== NOT_REPORTED || /\b(off target|specificity|bystander|precision)\b/.test(text);
  const isMultiplexOrPathway = isMultiplexOrPathwayKeyword(text);

  return {
    isToolOptimization,
    isTraitApplication,
    isDeliveryFocused,
    isSpecificityFocused,
    isMultiplexOrPathway,
  };
}

export function classifyTechnologyTransferPath(
  paper: Pick<
    IdeaSeedPaper,
    "title" | "abstract" | "organisms" | "editorTypes" | "geneSymbols" | "modality" | "diseaseArea" | "stage"
  >,
  extraction: Pick<
    GeneEditingExtraction,
    | "editingTool"
    | "editorVariant"
    | "editingType"
    | "organism"
    | "deliveryMethod"
    | "targetGene"
    | "targetTrait"
    | "mainInnovation"
    | "limitations"
    | "paperType"
    | "offTargetAnalysis"
    | "phenotypeValidation"
  >,
): TechnologyTransferPathSummary[] {
  const text = buildSeedClassificationText(paper, extraction);
  const isPlant = isPlantKeyword(text);
  const isAnimalOrCell = isAnimalOrCellKeyword(text);
  const isMammalianCell = isMammalianCellKeyword(text);
  const isRice = /\b(rice|oryza sativa)\b/.test(text);
  const isMonocot = isMonocotKeyword(text);
  const isDicotCrop = isDicotCropKeyword(text);
  const isModelPlant = isModelPlantKeyword(text);
  const isPeOrBe = isPeOrBeKeyword(text);
  const { isToolOptimization, isTraitApplication, isDeliveryFocused, isSpecificityFocused, isMultiplexOrPathway } = inferPaperArchetype(
    paper,
    extraction,
  );
  const summaries: TechnologyTransferPathSummary[] = [];

  const add = (path: TechnologyTransferPath, rationale: string, priority?: "高" | "中" | "低") => {
    if (summaries.some((summary) => summary.path === path)) {
      return;
    }

    summaries.push(buildTransferPathSummary(path, rationale, priority));
  };

  if (isAnimalOrCell && isPeOrBe && !isPlant) {
    if (isMammalianCell) {
      add(
        "mammalian_cell_to_plant",
        "该论文的核心价值更像是编辑器架构或工具体系本身，而不是特定动物性状，因此优先考虑将其迁移到植物体系验证可移植性。",
        "高",
      );
    }

    add(
      "animal_to_plant",
      "当前结果显示该工具主要在动物或细胞体系中成立，若尚未在植物中建立，将其转入水稻、Arabidopsis 或番茄会形成更清晰的新场景论文路径。",
      "高",
    );
  }

  if (isRice && isPeOrBe) {
    add(
      "monocot_to_dicot",
      "该论文已证明水稻中的单子叶可行性，下一步最现实的延展是转向番茄或大豆等双子叶体系，检验架构是否具备跨类群适配能力。",
      "高",
    );
    add(
      "crop_to_crop",
      "在水稻中成立的 PE/BE 体系继续扩展到小麦、玉米等作物，通常更容易形成有比较深度的新物种应用论文。",
      "高",
    );
  }

  if (isDicotCrop && isPeOrBe) {
    add(
      "crop_to_crop",
      "该论文已在双子叶作物中完成验证，继续扩展到其他双子叶作物或转入单子叶作物，是最自然的发表延展路径。",
      "高",
    );
  }

  if (isPlant && isTraitApplication) {
    add(
      "crop_to_crop",
      "当前论文已经把编辑工具与明确性状读出连接起来，最现实的后续方向是把同类品质、抗性或营养强化策略迁移到相关经济作物中。",
      "高",
    );
  }

  if (isModelPlant && isPlant) {
    add(
      "model_plant_to_crop",
      "如果当前工作更偏模式植物验证，将同一工具路线推进到经济作物通常比继续做模型内重复更有发表价值。",
      "高",
    );
  }

  if (isToolOptimization) {
    add(
      "efficiency_optimization",
      "该论文的发表基础在于工具架构或参数优化，因此继续做效率与版本比较，是最稳妥的后续发表方向。",
      "中",
    );
    add(
      "single_target_to_multiplex",
      "若当前工作仍主要停留在单靶点验证，进一步扩展到多靶点或通路级编辑，更能提升工具论文的说服力。",
      "中",
    );
  }

  if (isPlant && (isTraitApplication || isMultiplexOrPathway)) {
    add(
      "single_target_to_multiplex",
      isMultiplexOrPathway
        ? "当前论文已经展示了多基因或通路级编辑的潜力，下一步可继续扩展到更系统的通路重构、更多目标位点或不同作物背景。"
        : "若当前工作尚未覆盖通路级设计，则把单性状编辑推进到多位点协同调控，通常更容易形成新的发表层级。",
      "高",
    );
  }

  if (isDeliveryFocused) {
    add(
      "delivery_optimization",
      "当前技术路线对递送条件较敏感，继续围绕启动子、载体或稳定转化环节做优化，通常有明确的方法学延展空间。",
      "中",
    );
  }

  if (isSpecificityFocused || extraction.offTargetAnalysis === DISPLAY_NOT_REPORTED) {
    add(
      "specificity_optimization",
      extraction.offTargetAnalysis === DISPLAY_NOT_REPORTED
        ? "当前论文尚未充分展开脱靶或特异性验证，因此补做特异性优化与比较，是合理且必要的延展路径。"
        : "在已有脱靶或特异性讨论基础上继续优化安全性，往往能形成更完整的方法学或平台升级文章。",
      "中",
    );
  }

  if (isTraitApplication) {
    add(
      "tool_to_trait",
      isPlant
        ? "当前论文已经证明工具能够支撑明确的植物性状终点，下一步更具发表性的方向是把同一逻辑迁移到相邻品质、抗性或营养性状。"
        : "如果当前论文已经展示了明确性状或疾病终点，最现实的下一步不是重复同一目标，而是把工具迁移到相邻性状或相关作物场景。",
      isPlant ? "中" : "中",
    );
  }

  return summaries
    .sort((left, right) => {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return transferPathOrder.indexOf(left.path) - transferPathOrder.indexOf(right.path);
    })
    .slice(0, DEFAULT_PAPER_IDEA_LIMIT);
}
