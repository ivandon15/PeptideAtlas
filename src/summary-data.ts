import type { State } from "./model.ts";
import { dealDate, eventKind } from "./business.ts";
import { researchState, type ResearchTrack } from "./research-view.ts";
export const shanghaiDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function isRecent(
  date: string | null | undefined,
  today = shanghaiDate(),
) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = Date.parse(date + "T00:00:00Z");
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== date
  )
    return false;
  const age = (Date.parse(today + "T00:00:00Z") - parsed) / 86400000;
  return age >= 0 && age < 5;
}
export function targetIsRecent(
  state: State,
  id: string,
  today = shanghaiDate(),
  track: ResearchTrack = "development",
) {
  const s = researchState(state, track);
  const mols = s.molecules
    .filter((m) => m.targetIds.includes(id))
    .map((m) => m.id);
  const series = s.series.filter((x) => x.targetIds.includes(id));
  return (
    s.evidence.some(
      (e) =>
        e.verification === "reviewed" &&
        e.outcome === "reported" &&
        (track !== "computational" ||
          ["research", "method"].includes(e.line)) &&
        isRecent(e.date, today) &&
        (e.moleculeIds.some((m) => mols.includes(m)) ||
          e.seriesIds?.some((id) => series.some((x) => x.id === id))),
    ) ||
    (track !== "computational" &&
      s.deals.some(
        (d) => d.targetIds?.includes(id) && isRecent(dealDate(d), today),
      )) ||
    s.sources.some(
      (p) =>
        p.kind === "paper" &&
        p.disposition !== "excluded" &&
        p.disposition !== "pending" &&
        isRecent(p.publishedAt, today) &&
        series.some((x) => x.sourceIds.includes(p.id)),
    )
  );
}
export function overviewData(s: State, today = shanghaiDate()) {
  const development = researchState(s, "development");
  const targets = development.targets
    .map((t) => {
      const mols = development.molecules.filter((m) =>
        m.targetIds.includes(t.id),
      );
      const approved = mols.filter((m) => m.stage === "approved").length;
      const clinical = mols.filter((m) =>
        ["phase1", "phase2", "phase3", "filed"].includes(m.stage),
      ).length;
      const early = mols.filter((m) =>
        ["design", "in-vitro", "preclinical"].includes(m.stage),
      ).length;
      return {
        ...t,
        count: mols.length,
        approved,
        clinical,
        early,
        unknown: mols.length - approved - clinical - early,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const kinds = Object.entries(
    s.deals.reduce(
      (a, d) => {
        const k = eventKind(d);
        a[k] = (a[k] || 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    ),
  ).sort((a, b) => b[1] - a[1]);
  const companies = s.companies
    .filter((c) => !c.canonicalCompanyId)
    .map((c) => ({
      ...c,
      count: s.deals.filter((d) =>
        [d.fromCompanyId, d.toCompanyId].includes(c.id),
      ).length,
    }))
    .filter((c) => c.count)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const latestResearch = [
    ...s.receipts.map((r) => r.date),
    ...s.sources.map((p) => p.checkedAt),
  ]
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x <= today)
    .sort()
    .at(-1);
  const recentDeals = s.deals.filter((d) => isRecent(dealDate(d), today));
  const recentEvidence = s.evidence.filter(
    (e) =>
      e.verification === "reviewed" &&
      e.outcome === "reported" &&
      e.line !== "business" &&
      isRecent(e.date, today),
  );
  return {
    development,
    targets,
    kinds,
    companies,
    latestResearch,
    recentDeals,
    recentEvidence,
  };
}
