import type { State, Molecule } from "./model.ts";
export type Filters = {
  query: string;
  company: string;
  stage: string;
  origin: string;
  status: string;
  series: string;
};
export const emptyFilters: Filters = {
  query: "",
  company: "",
  stage: "",
  origin: "",
  status: "",
  series: "",
};
const norm = (s: string) => s.normalize("NFKC").toLocaleLowerCase().trim();
export function matchingMolecules(
  state: State,
  molecules: Molecule[],
  f: Filters,
): Molecule[] {
  const companies = new Map(
    state.companies.map((c) => [
      c.id,
      [c.name, ...(c.aliases || [])].join(" "),
    ]),
  );
  const series = new Map(state.series.map((s) => [s.id, s.name]));
  const dealCompanies = new Map<string, string[]>();
  for (const deal of state.deals)
    for (const id of deal.moleculeIds || [])
      dealCompanies.set(id, [
        ...(dealCompanies.get(id) || []),
        deal.fromCompanyId,
        deal.toCompanyId,
      ]);
  return molecules.filter((m) => {
    const company = [
      ...new Set([...m.companyIds, ...(dealCompanies.get(m.id) || [])]),
    ]
      .map((id) => companies.get(id) || id)
      .join(" ");
    const search = [
      m.name,
      ...(m.aliases || []),
      m.specificity || "",
      company,
      series.get(m.seriesId) || "",
    ].join(" ");
    return (
      (!f.query || norm(search).includes(norm(f.query))) &&
      (!f.company || norm(company).includes(norm(f.company))) &&
      (!f.stage || m.stage === f.stage) &&
      (!f.origin || m.origin === f.origin) &&
      (!f.status || m.status === f.status) &&
      (!f.series || m.seriesId === f.series)
    );
  });
}
export function targetResults(state: State, f: Filters, sort = "updated") {
  const byTarget = (molecules: Molecule[]) => {
    const index = new Map<string, Molecule[]>();
    for (const m of molecules)
      for (const id of m.targetIds) {
        const items = index.get(id) || [];
        items.push(m);
        index.set(id, items);
      }
    return index;
  };
  const allIndex = byTarget(state.molecules),
    matchedIndex = byTarget(matchingMolecules(state, state.molecules, f)),
    facetIndex = byTarget(
      matchingMolecules(state, state.molecules, { ...f, query: "" }),
    );
  return state.targets
    .flatMap((t) => {
      const all = allIndex.get(t.id) || [],
        targetMatch = norm([t.name, ...(t.aliases || [])].join(" ")).includes(
          norm(f.query),
        );
      const matches = (targetMatch ? facetIndex : matchedIndex).get(t.id) || [];
      if (!matches.length && (all.length || Object.values(f).some(Boolean)))
        return [];
      return [
        {
          target: t,
          molecules: matches,
          total: all.length,
          updated:
            all
              .map((m) => m.asOf)
              .sort()
              .at(-1) || "",
          filters: { ...f, query: targetMatch ? "" : f.query },
        },
      ];
    })
    .sort((a, b) =>
      sort === "count"
        ? b.molecules.length - a.molecules.length ||
          a.target.name.localeCompare(b.target.name)
        : sort === "name"
          ? a.target.name.localeCompare(b.target.name)
          : b.updated.localeCompare(a.updated) ||
            a.target.name.localeCompare(b.target.name),
    );
}
export function pageItems<T>(items: T[], page: number, size = 12) {
  const pages = Math.max(1, Math.ceil(items.length / size)),
    current = Math.max(1, Math.min(page, pages));
  return {
    items: items.slice((current - 1) * size, current * size),
    current,
    pages,
  };
}

import type { Mark } from "./progress.ts";
export function clusterMarks(marks: Mark[], spanDays: number): Mark[][] {
  const groups: Mark[][] = [];
  for (const mark of [...marks].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = groups.at(-1);
    if (
      last &&
      (Date.parse(mark.date) - Date.parse(last[0].date)) / 86400000 <=
        Math.max(1, spanDays * 0.035)
    )
      last.push(mark);
    else groups.push([mark]);
  }
  return groups;
}
