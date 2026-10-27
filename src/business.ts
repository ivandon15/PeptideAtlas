import type { State, Deal } from "./model.ts";
import { isProgram } from "./research-view.ts";
export const eventLabels: Record<string, string> = {
  license: "资产许可",
  platform: "平台合作",
  investment: "股权投资",
  merger: "合并",
  acquisition: "收购",
  amendment: "条款修订",
  unknown: "待分类",
};
export function eventKind(d: Deal): string {
  return (
    d.eventKind ||
    (
      {
        "ra-merck-2013": "platform",
        "gilead-pepstar-2026": "acquisition",
        "protagonist-janssen-2024-amend": "amendment",
      } as Record<string, string>
    )[d.id] ||
    "unknown"
  );
}
export const dealDate = (d: Deal) =>
  d.date || d.signedPeriod || d.announcedAt || "";
export type DealFilters = {
  query: string;
  company: string;
  target: string;
  kind: string;
  stage: string;
  since: string;
  until: string;
  region: string;
};
export const emptyDealFilters: DealFilters = {
  query: "",
  company: "",
  target: "",
  kind: "",
  stage: "",
  since: "",
  until: "",
  region: "",
};
const norm = (s: string) => s.normalize("NFKC").toLowerCase().trim();
const searchNorm = (s: string) => norm(s).replace(/[\s\p{P}]/gu, "");
export function companyAssets(s: State, id: string) {
  return s.molecules.filter(
    (m) =>
      isProgram(m) &&
      (m.companyIds.includes(id) ||
        s.deals.some(
          (d) =>
            (d.fromCompanyId === id || d.toCompanyId === id) &&
            d.moleculeIds?.includes(m.id),
        )),
  );
}
export function filterDeals(s: State, f: DealFilters, sort = "newest") {
  const company = new Map(
    s.companies.map((c) => [c.id, [c.name, ...(c.aliases || [])].join(" ")]),
  );
  const mol = new Map(
    s.molecules.map((m) => [m.id, [m.name, ...(m.aliases || [])].join(" ")]),
  );
  const target = new Map(
    s.targets.map((t) => [t.id, [t.name, ...(t.aliases || [])].join(" ")]),
  );
  return s.deals
    .filter((d) => {
      const text = [
        d.name,
        company.get(d.fromCompanyId),
        company.get(d.toCompanyId),
        ...(d.moleculeIds || []).map((id) => mol.get(id)),
        ...(d.targetIds || []).map((id) => target.get(id)),
      ].join(" ");
      const date = dealDate(d);
      const stage = d.stageAtSigning;
      const stageMatch =
        !f.stage ||
        (f.stage === "early"
          ? /发现|临床前|PCC/.test(stage)
          : f.stage === "clinical"
            ? /期|Phase|临床 [IV123]/i.test(stage)
            : f.stage === "approved"
              ? /获批|上市/.test(stage)
              : false);
      return (
        (!f.query || searchNorm(text).includes(searchNorm(f.query))) &&
        (!f.company || [d.fromCompanyId, d.toCompanyId].includes(f.company)) &&
        (!f.target ||
          (f.target === "undisclosed"
            ? !(d.targetIds || []).length
            : d.targetIds?.includes(f.target))) &&
        (!f.kind || eventKind(d) === f.kind) &&
        stageMatch &&
        (!f.since || (!!date && date.slice(0, 7) >= f.since)) &&
        (!f.until || (!!date && date.slice(0, 7) <= f.until)) &&
        (!f.region || norm(d.rights || "").includes(norm(f.region)))
      );
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const left = dealDate(a),
        right = dealDate(b);
      if (!left || !right)
        return Number(!left) - Number(!right) || a.name.localeCompare(b.name);
      return (
        (sort === "oldest"
          ? left.localeCompare(right)
          : right.localeCompare(left)) || a.name.localeCompare(b.name)
      );
    });
}
