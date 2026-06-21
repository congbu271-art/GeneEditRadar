import { z } from "zod";

import { authors, geneTargets, getPaperById, journals, type RadarPaper } from "@/lib/mock-data";

export const NOT_REPORTED = "not reported";

export const geneEditingExtractionSchema = z.object({
  editingTool: z.string(),
  editorVariant: z.string(),
  editingType: z.string(),
  organism: z.string(),
  deliveryMethod: z.string(),
  targetGene: z.string(),
  targetTrait: z.string(),
  editingEfficiency: z.string(),
  offTargetAnalysis: z.string(),
  phenotypeValidation: z.string(),
  mainInnovation: z.string(),
  limitations: z.string(),
  paperType: z.string(),
  followUpOpportunities: z.string(),
  extractionMethod: z.enum(["rule-based", "rule-based+llm"]),
});

export type GeneEditingExtraction = z.infer<typeof geneEditingExtractionSchema>;
type RefinableExtractionField = Exclude<keyof GeneEditingExtraction, "editingTool" | "editingType" | "organism" | "deliveryMethod" | "targetGene" | "extractionMethod">;

export type ExtractionSourcePaper = {
  id: string;
  title: string;
  abstract: string;
  journal: string;
  authors: string[];
  publishedAt?: string;
  organisms: string[];
  editorTypes: string[];
  appPaperId?: string;
  fullText?: string;
};

export const LLM_REFINABLE_FIELDS: RefinableExtractionField[] = [
  "editorVariant",
  "targetTrait",
  "editingEfficiency",
  "offTargetAnalysis",
  "phenotypeValidation",
  "mainInnovation",
  "limitations",
  "paperType",
  "followUpOpportunities",
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkup(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function normalizeLower(value: string) {
  return stripMarkup(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function joinOrNotReported(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length > 0 ? unique.join(", ") : NOT_REPORTED;
}

function reported(value?: string | null) {
  const cleaned = value ? normalizeWhitespace(value) : "";
  return cleaned.length > 0 ? cleaned : NOT_REPORTED;
}

export function normalizeLlmFieldValue(value: string) {
  const cleaned = reported(value);
  return /\bnot reported\b|\bnot available\b|\bunknown\b|\bunclear\b/i.test(cleaned) ? NOT_REPORTED : cleaned;
}

function getSentences(...values: string[]) {
  return values
    .flatMap((value) => stripMarkup(value).split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstMatchingSentence(sentences: string[], keywords: string[]) {
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return sentences.find((sentence) => {
    const lowered = sentence.toLowerCase();
    return loweredKeywords.some((keyword) => lowered.includes(keyword));
  });
}

function extractByPatterns(text: string, patterns: Array<[RegExp, string]>) {
  for (const [pattern, value] of patterns) {
    if (pattern.test(text)) {
      return value;
    }
  }

  return NOT_REPORTED;
}

export function resolveBasePaper(paper: ExtractionSourcePaper): RadarPaper | undefined {
  return paper.appPaperId ? getPaperById(paper.appPaperId) : getPaperById(paper.id);
}

function buildContext(paper: ExtractionSourcePaper) {
  const basePaper = resolveBasePaper(paper);
  const title = stripMarkup(paper.title);
  const abstract = stripMarkup(paper.abstract);
  const journal = stripMarkup(paper.journal);
  const text = [title, abstract, journal].filter(Boolean).join(" ");
  const loweredText = normalizeLower(text);
  const sentences = getSentences(title, abstract);

  return { basePaper, title, abstract, journal, text, loweredText, sentences };
}

function extractEditingTool(context: ReturnType<typeof buildContext>, sourcePaper: ExtractionSourcePaper) {
  const toolFromTypes = sourcePaper.editorTypes.map((item) => item.toLowerCase());

  if (toolFromTypes.some((item) => item.includes("prime"))) {
    return "prime editor";
  }

  if (toolFromTypes.some((item) => item.includes("adenine"))) {
    return "adenine base editor";
  }

  if (toolFromTypes.some((item) => item.includes("cytosine"))) {
    return "cytosine base editor";
  }

  if (toolFromTypes.some((item) => item.includes("base"))) {
    return "base editor";
  }

  if (toolFromTypes.some((item) => item.includes("screen"))) {
    return "CRISPR screening system";
  }

  return extractByPatterns(context.loweredText, [
    [/\bprime edit(?:ing|or)?\b/, "prime editor"],
    [/\badenine base edit(?:ing|or)?\b/, "adenine base editor"],
    [/\bcytosine base edit(?:ing|or)?\b/, "cytosine base editor"],
    [/\bbase edit(?:ing|or)?\b/, "base editor"],
    [/\bcas12a?\b/, "CRISPR-Cas12"],
    [/\bcas9\b/, "CRISPR-Cas9"],
    [/\bcrispr\b/, "CRISPR system"],
  ]);
}

function extractEditorVariant(context: ReturnType<typeof buildContext>) {
  const variantPatterns: Array<[RegExp, string]> = [
    [/\bretina-optimized editor\b/i, "retina-optimized editor"],
    [/\bmodular prime editor payload\b/i, "modular prime editor payload"],
    [/\btropism-tuned lnp(?:s)?\b/i, "tropism-tuned LNPs"],
    [/\barmored allogeneic t cells\b/i, "armored allogeneic T cells"],
    [/\badenine base editing\b/i, "adenine base editing system"],
  ];

  const patternMatch = extractByPatterns(context.text, variantPatterns);
  if (patternMatch !== NOT_REPORTED) {
    return patternMatch;
  }

  const variantFromSentence = firstMatchingSentence(context.sentences, [
    "retina-optimized editor",
    "modular prime editor",
    "tropism-tuned",
    "optimized editor",
    "armored allogeneic t cells",
  ]);

  return variantFromSentence ? reported(variantFromSentence) : NOT_REPORTED;
}

function extractEditingType(context: ReturnType<typeof buildContext>, sourcePaper: ExtractionSourcePaper) {
  const preferred = sourcePaper.editorTypes[0];
  if (preferred) {
    return preferred;
  }

  if (context.basePaper?.modality) {
    return context.basePaper.modality;
  }

  return extractByPatterns(context.loweredText, [
    [/\bprime edit(?:ing|or)?\b/, "Prime editing"],
    [/\badenine base edit(?:ing|or)?\b/, "Adenine base editing"],
    [/\bbase edit(?:ing|or)?\b/, "Base editing"],
    [/\bmultiplex\b.*\bcrispr\b|\bcrispr\b.*\bmultiplex\b/, "Multiplex CRISPR editing"],
    [/\bcrispr screen(?:ing)?\b/, "CRISPR screening"],
    [/\bcrispr\b/, "CRISPR editing"],
  ]);
}

function extractOrganism(context: ReturnType<typeof buildContext>, sourcePaper: ExtractionSourcePaper) {
  if (sourcePaper.organisms.length > 0) {
    return joinOrNotReported(sourcePaper.organisms);
  }

  const organisms: string[] = [];
  const pairs: Array<[RegExp, string]> = [
    [/\b(non[- ]human primate|primate|macaque)\b/i, "Primate"],
    [/\bpatient|patients|human\b/i, "Human"],
    [/\bmurine|mouse|mice\b/i, "Mouse"],
    [/\brat|rats\b/i, "Rat"],
    [/\brodent|rodents\b/i, "Rodent"],
    [/\bcanine|dog|dogs\b/i, "Canine"],
    [/\blarge animal\b/i, "Large animal"],
    [/\bzebrafish\b/i, "Zebrafish"],
  ];

  for (const [pattern, value] of pairs) {
    if (pattern.test(context.text)) {
      organisms.push(value);
    }
  }

  return joinOrNotReported(organisms);
}

function extractDeliveryMethod(context: ReturnType<typeof buildContext>) {
  const modality = context.basePaper?.modality?.toLowerCase() ?? "";
  const text = `${context.loweredText} ${modality}`;

  return extractByPatterns(text, [
    [/\blnp\b|\blipid nanoparticle\b/, "LNP"],
    [/\baav\b|adeno-associated virus/, "AAV"],
    [/\bsubretinal\b/, "subretinal delivery"],
    [/\bex vivo\b/, "ex vivo delivery"],
    [/\bin vivo\b/, "in vivo delivery"],
    [/\belectroporation\b/, "electroporation"],
  ]);
}

function extractTargetGene(context: ReturnType<typeof buildContext>) {
  if (context.basePaper?.geneSymbols.length) {
    return context.basePaper.geneSymbols.join(", ");
  }

  const explicitGenes = geneTargets
    .filter((gene) => new RegExp(`\\b${gene.symbol}\\b`, "i").test(context.text))
    .map((gene) => gene.symbol);

  if (explicitGenes.length > 0) {
    return explicitGenes.join(", ");
  }

  const nonGeneTokens = new Set(["CRISPR", "CAS9", "CAS12", "AAV", "LNP", "DNA", "RNA", "ABE", "CBE", "PE"]);
  const uppercaseGeneTokens = Array.from(
    new Set(context.text.match(/\b(?:[A-Z]{2,}\d+[A-Z0-9-]*|[A-Z][a-z][A-Z0-9-]{2,})\b/g) ?? []),
  ).filter(
    (token) => !nonGeneTokens.has(token),
  );
  return joinOrNotReported(uppercaseGeneTokens);
}

function extractTargetTrait(context: ReturnType<typeof buildContext>) {
  const traitPatterns: Array<[RegExp, string]> = [
    [/\bpcsk9 knockdown\b|\bldl reduction\b/i, "PCSK9 knockdown / LDL reduction"],
    [/\bbeta-thalassemia\b/i, "beta-thalassemia"],
    [/\banemia rescue\b/i, "anemia rescue"],
    [/\binherited blindness\b/i, "inherited blindness"],
    [/\bvisual function\b/i, "visual function restoration"],
    [/\bcold tumors?\b|\bsolid tumors?\b/i, "solid tumor control"],
    [/\bsynthetic-lethal\b.*\btumou?rs?\b/i, "synthetic-lethal tumor vulnerabilities"],
    [/\bmultibiofortification\b|\bbiofortified\b|\bmicronutrient malnutrition\b/i, "multibiofortification / nutrient-dense crop improvement"],
    [/\bphytonutrient\b|\bvitamin c\b|\bvitamin d3\b|\blycopene\b|\blutein\b|\bgaba\b/i, "vitamin and phytonutrient enrichment"],
    [/\bfruit quality\b|\bnutritional traits?\b/i, "fruit quality and nutritional trait improvement"],
  ];

  const directMatch = extractByPatterns(context.text, traitPatterns);
  if (directMatch !== NOT_REPORTED) {
    return directMatch;
  }

  if (context.basePaper?.diseaseArea) {
    return context.basePaper.diseaseArea;
  }

  return NOT_REPORTED;
}

function extractEditingEfficiency(context: ReturnType<typeof buildContext>) {
  const abstractSentences = getSentences(context.abstract);
  const numericSentence = firstMatchingSentence(abstractSentences, ["%", "percent", "efficiency", "on-target", "knockdown"]);
  const numericMatch = context.abstract.match(/(\d+(?:\.\d+)?)\s*%[^.]{0,80}(editing|correction|efficiency|knockdown)/i);

  if (numericMatch) {
    return reported(numericMatch[0]);
  }

  if (numericSentence && /\bhigh-efficiency\b|\bhigh on-target\b|\bdurable .* knockdown\b/i.test(numericSentence)) {
    return reported(numericSentence);
  }

  return NOT_REPORTED;
}

function extractOffTargetAnalysis(context: ReturnType<typeof buildContext>) {
  const sentence = firstMatchingSentence(context.sentences, ["off-target", "off target"]);
  return sentence ? reported(sentence) : NOT_REPORTED;
}

function extractPhenotypeValidation(context: ReturnType<typeof buildContext>) {
  const sentence = firstMatchingSentence(context.sentences, [
    "rescue",
    "restored visual function",
    "ldl reduction",
    "control of cold tumors",
    "persisted longer",
    "anemia rescue",
    "fruit quality",
    "tumor growth",
    "no significant trade-offs",
  ]);

  if (sentence) {
    return reported(sentence);
  }

  return NOT_REPORTED;
}

function extractMainInnovation(context: ReturnType<typeof buildContext>) {
  const prioritySentence = firstMatchingSentence(context.sentences, [
    "designed a multiplex",
    "simultaneously",
    "optimized",
    "engineered",
    "generated",
    "strategy",
  ]);

  return reported(prioritySentence ?? (context.abstract ? getSentences(context.abstract)[0] : context.sentences[0]));
}

function extractLimitations(context: ReturnType<typeof buildContext>) {
  const sentence = firstMatchingSentence(context.sentences, [
    "however",
    "limitation",
    "limited",
    "challenge",
    "constraint",
    "caveat",
  ]);

  return sentence ? reported(sentence) : NOT_REPORTED;
}

function extractPaperType(context: ReturnType<typeof buildContext>) {
  if (context.basePaper?.stage === "Platform") {
    return /screen/i.test(context.title) ? "platform screening study" : "platform study";
  }

  if (context.basePaper?.stage === "Clinical") {
    return "clinical study";
  }

  if (context.basePaper?.stage === "Preclinical") {
    return "preclinical study";
  }

  if (/\b(trait|quality|nutrition|biofortification|phytonutrient|fruit)\b/i.test(context.text)) {
    return "trait application study";
  }

  return extractByPatterns(context.loweredText, [
    [/\breview\b/, "review article"],
    [/\bscreen(?:ing)?\b/, "screening study"],
    [/\bpatient|patients|clinical\b/, "clinical study"],
    [/\bin vivo\b|\bmouse|mice|murine|primate|rodent|canine\b/, "preclinical study"],
  ]);
}

function extractFollowUpOpportunities(context: ReturnType<typeof buildContext>) {
  const sentence = firstMatchingSentence(context.sentences, [
    "future",
    "follow-up",
    "next step",
    "next steps",
    "further study",
    "further studies",
    "translation",
    "clinical trial",
    "clinical studies",
  ]);

  return sentence ? reported(sentence) : NOT_REPORTED;
}

function finalizeExtraction(candidate: Omit<GeneEditingExtraction, "extractionMethod">, extractionMethod: GeneEditingExtraction["extractionMethod"]) {
  return geneEditingExtractionSchema.parse({
    editingTool: reported(candidate.editingTool),
    editorVariant: reported(candidate.editorVariant),
    editingType: reported(candidate.editingType),
    organism: reported(candidate.organism),
    deliveryMethod: reported(candidate.deliveryMethod),
    targetGene: reported(candidate.targetGene),
    targetTrait: reported(candidate.targetTrait),
    editingEfficiency: reported(candidate.editingEfficiency),
    offTargetAnalysis: reported(candidate.offTargetAnalysis),
    phenotypeValidation: reported(candidate.phenotypeValidation),
    mainInnovation: reported(candidate.mainInnovation),
    limitations: reported(candidate.limitations),
    paperType: reported(candidate.paperType),
    followUpOpportunities: reported(candidate.followUpOpportunities),
    extractionMethod,
  });
}

export function extractGeneEditingDetailsRuleBased(sourcePaper: ExtractionSourcePaper) {
  const context = buildContext(sourcePaper);

  return finalizeExtraction(
    {
      editingTool: extractEditingTool(context, sourcePaper),
      editorVariant: extractEditorVariant(context),
      editingType: extractEditingType(context, sourcePaper),
      organism: extractOrganism(context, sourcePaper),
      deliveryMethod: extractDeliveryMethod(context),
      targetGene: extractTargetGene(context),
      targetTrait: extractTargetTrait(context),
      editingEfficiency: extractEditingEfficiency(context),
      offTargetAnalysis: extractOffTargetAnalysis(context),
      phenotypeValidation: extractPhenotypeValidation(context),
      mainInnovation: extractMainInnovation(context),
      limitations: extractLimitations(context),
      paperType: extractPaperType(context),
      followUpOpportunities: extractFollowUpOpportunities(context),
    },
    "rule-based",
  );
}

export function buildExtractionSourceFromRadarPaper(paper: RadarPaper): ExtractionSourcePaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    journal: journals.find((journal) => journal.slug === paper.journalSlug)?.name ?? paper.journalSlug,
    authors: paper.authorIds
      .map((authorId) => authors.find((author) => author.id === authorId)?.name)
      .filter(Boolean) as string[],
    publishedAt: paper.publishedAt,
    organisms: paper.organisms,
    editorTypes: paper.editorTypes,
    appPaperId: paper.id,
  };
}
