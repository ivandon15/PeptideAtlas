import type { State, Molecule, Source, Series } from "./model.ts";
export type ResearchTrack = "development" | "computational";
export const isProgram = (m: Molecule) => m.trackingRole !== "research";

export function experimentalMolecules(s: State, targetId?: string) {
  return s.molecules.filter(
    (m) =>
      !isProgram(m) &&
      researchTrack(s, m) === "development" &&
      (!targetId || m.targetIds.includes(targetId)),
  );
}
export function documentKey(s: Source): string {
  if (s.documentGroup) return s.documentGroup;
  if (s.kind === "paper")
    return (
      "paper:" +
      s.title
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s\p{P}]/gu, "")
    );
  return s.url.replace(/[?#].*$/, "").replace(/\/$/, "");
}
export function researchSources(s: State, molecules: Molecule[]) {
  const ids = new Set(
    molecules.flatMap((m) => [
      ...m.sourceIds,
      ...(s.series.find((x) => x.id === m.seriesId)?.sourceIds || []),
      ...s.evidence
        .filter(
          (e) =>
            e.verification === "reviewed" &&
            e.outcome === "reported" &&
            (e.moleculeIds.includes(m.id) || e.seriesIds?.includes(m.seriesId)),
        )
        .map((e) => e.sourceId),
    ]),
  );
  return [
    ...new Map(
      s.sources
        .filter(
          (x) =>
            ids.has(x.id) &&
            ["paper", "patent"].includes(x.kind) &&
            x.disposition !== "excluded",
        )
        .map((x) => [documentKey(x), x]),
    ).values(),
  ];
}
export function hasExperiment(s: State, m: Molecule) {
  return s.evidence.some(
    (e) =>
      e.moleculeIds.includes(m.id) &&
      e.verification === "reviewed" &&
      e.outcome === "reported" &&
      !!e.stageClaim &&
      !["design", "unknown"].includes(e.stageClaim),
  );
}
export function researchTrack(s: State, m: Molecule): ResearchTrack {
  const focus = s.series.find((x) => x.id === m.seriesId)?.researchFocus;
  if (
    focus === "method-validation" ||
    (m.origin === "computational" && focus !== "development")
  )
    return "computational";
  return "development";
}
const methodSeries = (x: Series) =>
  x.researchFocus === "method-validation" ||
  (x.origin === "computational" && x.researchFocus !== "development");
export function computationalPapers(s: State, targetId?: string) {
  const molecules = s.molecules.filter(
    (m) => !targetId || m.targetIds.includes(targetId),
  );
  const ids = new Set(
    s.series
      .filter(
        (x) => methodSeries(x) && (!targetId || x.targetIds.includes(targetId)),
      )
      .flatMap((x) => x.sourceIds),
  );
  return [
    ...new Map(
      [
        ...researchSources(s, molecules),
        ...s.sources.filter((x) => ids.has(x.id)),
      ]
        .filter((x) => x.kind === "paper" && x.disposition !== "excluded")
        .map((x) => [documentKey(x), x]),
    ).values(),
  ].sort(
    (a, b) =>
      (b.publishedAt || "").localeCompare(a.publishedAt || "") ||
      a.title.localeCompare(b.title),
  );
}
export function researchState(
  s: State,
  track: ResearchTrack,
  includeResearch = false,
): State {
  const molecules = s.molecules.filter(
    (m) =>
      researchTrack(s, m) === track &&
      (track === "computational" || includeResearch || isProgram(m)),
  );
  const series = s.series.filter(
    (x) =>
      molecules.some((m) => m.seriesId === x.id) ||
      (track === "computational" && methodSeries(x)),
  );
  return {
    ...s,
    molecules,
    series,
    targets: s.targets.filter(
      (t) =>
        molecules.some((m) => m.targetIds.includes(t.id)) ||
        (track === "computational" &&
          series.some((x) => x.targetIds.includes(t.id))),
    ),
  };
}
export function computationalResults(
  s: State,
  query: string,
  sort = "updated",
) {
  const norm = (v: string) => v.normalize("NFKC").toLowerCase().trim();
  return s.targets
    .flatMap((target) => {
      const papers = computationalPapers(s, target.id);
      const studies = s.series.filter((x) => x.targetIds.includes(target.id));
      const text = [
        target.name,
        ...(target.aliases || []),
        ...papers.flatMap((p) => [p.title, p.url]),
        ...studies.flatMap((x) => [x.name, x.description || ""]),
      ].join(" ");
      if (!papers.length || (query && !norm(text).includes(norm(query))))
        return [];
      const molecules = s.molecules.filter((m) =>
        m.targetIds.includes(target.id),
      );
      return [
        {
          target,
          papers,
          molecules,
          total: molecules.length,
          updated:
            papers
              .map((p) => p.publishedAt || "")
              .sort()
              .at(-1) || "",
          filters: {
            query: "",
            company: "",
            stage: "",
            origin: "",
            status: "",
            series: "",
          },
        },
      ];
    })
    .sort((a, b) => {
      const targetMatch = (t: typeof a.target) =>
        norm([t.name, ...(t.aliases || [])].join(" ")).includes(norm(query));
      return (
        Number(targetMatch(b.target)) - Number(targetMatch(a.target)) ||
        (sort === "count"
          ? b.papers.length - a.papers.length ||
            a.target.name.localeCompare(b.target.name)
          : sort === "name"
            ? a.target.name.localeCompare(b.target.name)
            : b.updated.localeCompare(a.updated) ||
              a.target.name.localeCompare(b.target.name))
      );
    });
}
