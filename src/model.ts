export type Origin =
  | "computational"
  | "screening"
  | "natural-derived"
  | "hybrid"
  | "unknown";
export interface RecordBase {
  aliases?: string[];
  id: string;
  name: string;
  description?: string;
}
export interface Source {
  documentGroup?: string;
  id: string;
  title: string;
  url: string;
  kind: string;
  access: string;
  checkedAt: string;
  publishedAt: string | null;
  readScope?: string;
  disposition?: string;
  relevanceReason?: string;
}
export interface Series extends RecordBase {
  researchFocus?: "development" | "method-validation";
  researchFocusNote?: string;
  targetIds: string[];
  sourceIds: string[];
  companyIds: string[];
  origin: Origin;
  basis: string;
}
export interface Molecule extends RecordBase {
  targetIds: string[];
  seriesId: string;
  sourceIds: string[];
  companyIds: string[];
  origin: Origin;
  stage: string;
  status: string;
  asOf: string;
  sequence: string | null;
  sequenceNote?: string;
  specificity?: string;
  modality: string;
  recordLevel: string;
  stageEvidenceIds: string[];
}
export interface Evidence {
  companyIds?: string[];
  dealIds?: string[];
  validationLevel?:
    | "in-vitro"
    | "in-vivo"
    | "not-detected"
    | "computational-only"
    | "uncertain";
  topic?: "cmc";
  shortLabel?: string;
  region?: string;
  indication?: string;
  id: string;
  title: string;
  summary: string;
  date: string | null;
  sourceId: string;
  locator: string;
  line: string;
  verification: string;
  outcome: string;
  moleculeIds: string[];
  seriesIds?: string[];
  stageClaim?: string;
  statusClaim?: string;
  statusAsOf?: string;
  candidateClaim?: boolean;
  assay?: {
    metric: string;
    value: number;
    unit: string;
    relation: string;
    context?: string;
  };
}
export interface Relation {
  id: string;
  from: string;
  to: string;
  type: string;
  sourceId: string;
  locator: string;
  reason: string;
  verification: string;
}
export interface Deal extends RecordBase {
  fromCompanyId: string;
  toCompanyId: string;
  sourceIds: string[];
  date: string | null;
  stageAtSigning: string;
  signedPeriod?: string;
  announcedAt?: string;
  eventKind?:
    | "license"
    | "investment"
    | "merger"
    | "platform"
    | "acquisition"
    | "amendment";
  financialScope?: string;
  acquisitionScope?: "company" | "asset";
  financialNotes?: string;
  financialSummary?: string;
  rationale: { kind: string; text: string };
  contributions?: string;
  rights?: string;
  locator: string;
  payments?: {
    kind: string;
    date: string | null;
    amount: Money;
    note: string;
    sourceId: string;
    locator: string;
  }[];
  upfront?: Money;
  paid?: Money;
  potentialMilestones?: Money;
  potentialTotal?: Money;
  targetIds?: string[];
  moleculeIds?: string[];
}
interface Money {
  value: number;
  currency: string;
}
export interface Gap {
  companyIds?: string[];
  dealIds?: string[];
  id: string;
  title: string;
  reason: string;
  requested: string;
  status: string;
  urls: string[];
  sourceIds: string[];
  targetIds: string[];
  moleculeIds: string[];
  seriesIds: string[];
  resolution?: string;
  resolutionEvidenceIds?: string[];
}
export interface Upload {
  id: string;
  gapId: string;
  name: string;
  sha256: string;
  submittedAt: string;
  formatCheck: { status: string; reason: string; pages?: number };
  identity: string;
  scientific: string;
}
export interface Receipt {
  targetIds?: string[];
  scope?: string;
  count?: number;
  totalHits?: number | null;
  pagesFetched?: number;
  truncated?: boolean;
  error?: string;
  id: string;
  query: string;
  tool: string;
  date: string;
  status: string;
  note?: string;
}
export interface Review {
  id: string;
  gapId: string;
  uploadId: string;
  identity: string;
  scientific: string;
  note: string;
  reviewer: string;
}
export interface Observation {
  id: string;
  title: string;
  asOf: string;
  author: string;
  basedOnRevision: number;
  coverage: string;
  summary: string;
  interpretation: string;
  uncertainty: string;
  nextCheck: string;
  status: "active" | "needs-review" | "superseded" | "withdrawn";
  sourceIds: string[];
  evidenceIds: string[];
  dealIds: string[];
  targetIds?: string[];
  companyIds?: string[];
  moleculeIds?: string[];
  seriesIds?: string[];
}
export interface State {
  observations?: Observation[];
  lastCommitAt?: string | null;
  revision: number;
  targets: RecordBase[];
  companies: (RecordBase & { canonicalCompanyId?: string })[];
  sources: Source[];
  series: Series[];
  molecules: Molecule[];
  evidence: Evidence[];
  relations: Relation[];
  deals: Deal[];
  gaps: Gap[];
  uploads: Upload[];
  receipts: Receipt[];
  reviews: Review[];
}
export const originLabel: Record<Origin, string> = {
  computational: "计算设计",
  screening: "实验筛选",
  "natural-derived": "天然 / 已知配体衍生",
  hybrid: "混合路线",
  unknown: "路线待核实",
};
export const stageLabel: Record<string, string> = {
  design: "设计",
  "in-vitro": "体外验证",
  preclinical: "动物 / 临床前",
  phase1: "临床 I 期",
  phase2: "临床 II 期",
  phase3: "临床 III 期",
  filed: "申报中",
  approved: "已获批",
  unknown: "阶段待核实",
};
export const statusLabel: Record<string, string> = {
  active: "在研",
  paused: "暂停",
  stopped: "停止开发",
  unknown: "当前动向待核实",
};
export const gapLabel: Record<string, string> = {
  "needs-material": "待补材料",
  submitted: "已提交 · 待核验",
  reviewing: "核验中",
  "needs-more": "需补充 / 重传",
  resolved: "已解决",
  unobtainable: "无法获取 · 已归档",
};

export interface Revision {
  commitId: string;
  at: string;
  reviewer: string;
  before: Molecule | null;
  after: Molecule;
}

export const modalityLabel: Record<string, string> = {
  peptide: "多肽",
  "macrocyclic-peptide": "大环多肽",
  "peptide-conjugate": "肽偶联物",
  "peptide-protein-fusion": "肽蛋白融合物",
  peptidomimetic: "肽模拟物",
  unknown: "模态待核实",
};
