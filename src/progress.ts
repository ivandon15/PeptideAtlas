import type { Evidence, Molecule, Relation, Source } from "./model.ts";
import { stageLabel, statusLabel } from "./model.ts";
export const stages = [
  "design",
  "in-vitro",
  "preclinical",
  "phase1",
  "phase2",
  "phase3",
  "filed",
  "approved",
];
export type Mark = {
  id: string;
  date: string;
  label: string;
  kind: "cmc" | "research" | "stage" | "status" | "candidate";
  basis: string;
  evidence: Evidence;
};
export function marksFor(
  m: Molecule,
  evidence: Evidence[],
  sources: Source[],
): Mark[] {
  return evidence
    .filter(
      (e) =>
        e.moleculeIds.includes(m.id) &&
        e.verification === "reviewed" &&
        e.outcome === "reported",
    )
    .flatMap((e) => {
      const source = sources.find((s) => s.id === e.sourceId),
        marks: Mark[] = [];
      const add = (
        kind: Mark["kind"],
        date: string | null,
        label: string,
        basis: string,
      ) => {
        if (date)
          marks.push({
            id: e.id + "-" + kind,
            date,
            label,
            kind,
            basis,
            evidence: e,
          });
      };
      if (e.stageClaim)
        add(
          "stage",
          e.date,
          e.stageClaim === "in-vitro"
            ? "体外结果公开"
            : e.stageClaim === "preclinical"
              ? "动物结果公开"
              : (stageLabel[e.stageClaim] || e.stageClaim) +
                (e.region
                  ? " · " + e.region
                  : e.indication
                    ? " · " +
                      ({
                        溃疡性结肠炎: "UC",
                        克罗恩病: "CD",
                        斑块状银屑病: "银屑病",
                      }[e.indication] || e.indication)
                    : ""),
          e.line === "clinical"
            ? "实际临床启动 / 原文事件日"
            : e.line === "regulatory"
              ? "监管公告日"
              : "实验结果公开日，非实验起始日",
        );
      if (e.statusClaim)
        add(
          "status",
          e.statusAsOf ||
            (e.line === "clinical" ? source?.publishedAt || e.date : e.date),
          statusLabel[e.statusClaim] || e.statusClaim,
          source?.kind === "registry" ? "登记版本公开日" : "公司披露日",
        );
      if (e.candidateClaim)
        add("candidate", e.date, "PCC 确认", "原文明确的候选提名事件");
      if (!e.stageClaim && !e.statusClaim && !e.candidateClaim)
        add(
          e.topic === "cmc" ? "cmc" : "research",
          e.date,
          e.shortLabel ||
            (e.topic === "cmc"
              ? "CMC / 制剂"
              : e.line === "business"
                ? "合作披露"
                : "研究公开"),
          e.line === "business"
            ? "公司 / 证券披露日，非签约或交割日"
            : "论文 / 会议公开日，非研发起始日",
        );
      return marks;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function defaultAnchor(ms: Molecule[]): Molecule | undefined {
  return [...ms].sort(
    (a, b) =>
      Number(a.status === "stopped") - Number(b.status === "stopped") ||
      stages.indexOf(b.stage) - stages.indexOf(a.stage) ||
      Number(b.status === "active") - Number(a.status === "active") ||
      a.id.localeCompare(b.id),
  )[0];
}
export function familyOrder(ms: Molecule[], relations: Relation[]): Molecule[] {
  const result: Molecule[] = [],
    visited = new Set<string>();
  function add(m: Molecule) {
    if (visited.has(m.id)) return;
    visited.add(m.id);
    for (const r of relations.filter(
      (r) =>
        r.type === "derived" && r.verification === "reviewed" && r.to === m.id,
    )) {
      const parent = ms.find((x) => x.id === r.from);
      if (parent) add(parent);
    }
    result.push(m);
  }
  ms.forEach(add);
  return result;
}
export function connectedFamily(
  id: string,
  relations: Relation[],
): Set<string> {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of relations.filter(
      (r) => r.type === "derived" && r.verification === "reviewed",
    )) {
      if (ids.has(r.from) || ids.has(r.to)) {
        if (!ids.has(r.from) || !ids.has(r.to)) changed = true;
        ids.add(r.from);
        ids.add(r.to);
      }
    }
  }
  return ids;
}
export function yearDomain(marks: Mark[], asOf: string) {
  const years = marks
      .map((e) => Number(e.date.slice(0, 4)))
      .filter(Number.isFinite),
    end = Math.max(
      Number(asOf.slice(0, 4)) || new Date().getFullYear(),
      ...years,
    );
  return { start: Math.min(end - 2, ...years), end };
}

export function clinicalWindow(
  marks: Mark[],
): { start: string; end: string } | null {
  const first = marks.find(
    (m) =>
      m.kind === "stage" &&
      m.evidence.line === "clinical" &&
      ["phase1", "phase2", "phase3"].includes(m.evidence.stageClaim || ""),
  );
  if (!first) return null;
  const states = marks.filter(
    (m) => m.kind === "status" && m.date >= first.date,
  );
  const final =
    states.find((m) =>
      ["stopped", "paused"].includes(m.evidence.statusClaim || ""),
    ) || states.at(-1);
  return final && final.date > first.date
    ? { start: first.date, end: final.date }
    : null;
}
