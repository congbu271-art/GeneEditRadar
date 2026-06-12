import {
  NOT_REPORTED,
} from "@/lib/paper-extraction";
import {
  DISPLAY_NOT_REPORTED,
  uniqueStrings,
} from "@/lib/shared-utils";
import type {
  PaperQueryKind,
  TechnologyTransferPath,
} from "@/lib/analyze-types";
import { toZhExtractionValue } from "@/lib/ui-zh";
import type { CollectedPaper, LiteratureSource } from "@/lib/literature";

// ---------- Internal Types ----------

export type SourceStatus = {
  source: Exclude<LiteratureSource, "mock">;
  ok: boolean;
  count: number;
  error?: string;
};

export type SourceResult = {
  papers: CollectedPaper[];
  status: SourceStatus;
};

export type RankedPaper = CollectedPaper & {
  relevanceScore: number;
};

export type PaperQueryDetection = {
  kind: PaperQueryKind;
  normalizedQuery: string;
};

export type AnalyzeQueryResult = {
  papers: RankedPaper[];
  usedFallback: boolean;
  sourceStatuses: SourceStatus[];
  warnings: string[];
};

export type AnalyzePaperQueryResult = AnalyzeQueryResult & {
  detection: PaperQueryDetection;
  seed?: RankedPaper;
};

// ---------- Constants ----------

export const DEFAULT_ANALYSIS_LIMIT = 8;
export const DEFAULT_PAPER_IDEA_LIMIT = 5;

export const transferPathOrder: TechnologyTransferPath[] = [
  "mammalian_cell_to_plant",
  "animal_to_plant",
  "monocot_to_dicot",
  "crop_to_crop",
  "model_plant_to_crop",
  "tool_to_trait",
  "single_target_to_multiplex",
  "efficiency_optimization",
  "delivery_optimization",
  "specificity_optimization",
];

export const transferPathLabelMap: Record<TechnologyTransferPath, string> = {
  animal_to_plant: "动物/细胞体系 → 植物体系",
  mammalian_cell_to_plant: "哺乳动物细胞体系 → 植物体系",
  monocot_to_dicot: "单子叶作物 → 双子叶作物",
  model_plant_to_crop: "模式植物 → 经济作物",
  crop_to_crop: "作物体系 → 其他作物体系",
  tool_to_trait: "工具验证 → 性状应用",
  single_target_to_multiplex: "单靶点 → 多靶点/通路编辑",
  efficiency_optimization: "编辑效率优化",
  delivery_optimization: "递送体系优化",
  specificity_optimization: "特异性/脱靶优化",
};

// ---------- Utility Functions ----------

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function topCounts(values: string[], limit = 3) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || normalized === DISPLAY_NOT_REPORTED) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => `${label}（${count} 篇）`);
}

export function splitFeatureValues(value: string) {
  return value
    .split(/[;,，；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueNonReported(values: string[]) {
  return uniqueStrings(values.filter((value) => value && value !== DISPLAY_NOT_REPORTED && value !== NOT_REPORTED));
}

export function classifyPriority(value: number): "高" | "中" | "低" {
  if (value >= 75) {
    return "高";
  }

  if (value >= 55) {
    return "中";
  }

  return "低";
}

export function priorityWeight(priority: "高" | "中" | "低") {
  switch (priority) {
    case "高":
      return 3;
    case "中":
      return 2;
    case "低":
      return 1;
  }
}

export function splitInsightList(value: string) {
  return uniqueNonReported(
    value
      .split(/[.;；。\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function localizeReportedValue(value?: string) {
  if (!value || value === NOT_REPORTED) {
    return DISPLAY_NOT_REPORTED;
  }

  return toZhExtractionValue(value);
}
