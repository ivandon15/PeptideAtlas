import assert from "node:assert/strict";
import fs from "node:fs";
import {
  researchTrack,
  researchSources,
  researchState,
  experimentalMolecules,
} from "../src/research-view.ts";
const original = JSON.parse(
  fs.readFileSync(new URL("../data/pilot.json", import.meta.url)),
);
const m = {
  ...original.molecules[0],
  id: "m",
  seriesId: "s",
  origin: "computational",
  sourceIds: ["p1"],
  targetIds: ["t"],
};
const source = (id, title, kind = "paper") => ({
  id,
  title,
  kind,
  url: "https://example.org/" + id,
  access: "partial",
  checkedAt: "2026-10-26",
  publishedAt: null,
});
const s = {
  ...original,
  targets: [{ id: "t", name: "T" }],
  series: [{ ...original.series[0], id: "s", sourceIds: ["p1"] }],
  molecules: [m],
  sources: [source("p1", "First paper")],
  evidence: [
    {
      ...original.evidence[0],
      id: "e",
      moleculeIds: ["m"],
      seriesIds: [],
      sourceId: "p1",
      stageClaim: "in-vitro",
      verification: "reviewed",
      outcome: "reported",
    },
  ],
};
assert.equal(
  researchTrack(s, m),
  "computational",
  "one model-validation study stays grouped by paper even with wet lab validation",
);
const hundred = {
  ...s,
  molecules: Array.from({ length: 100 }, (_, i) => ({ ...m, id: "m" + i })),
};
assert.equal(
  researchSources(hundred, hundred.molecules).length,
  1,
  "100 designs do not become 100 papers",
);
s.sources.push(source("p2", "Second paper"));
s.series[0].sourceIds.push("p2");
assert.equal(
  researchTrack(s, m),
  "computational",
  "two model papers do not alone establish a development program",
);
s.series[0].researchFocus = "development";
assert.equal(researchTrack(s, m), "development");
s.sources[1] = { ...source("p2", "First paper") };
assert.equal(
  researchTrack(s, m),
  "development",
  "single or duplicated research source does not hide a verified project",
);
m.origin = "screening";
assert.equal(researchTrack(s, m), "development");
s.evidence[0].verification = "candidate";
assert.equal(
  researchTrack(s, m),
  "development",
  "view grouping is distinct from fact verification",
);
assert.equal(researchState(s, "development").molecules.length, 1);
console.log(
  "Research views: no source-count gate, computational grouping, paper deduplication passed.",
);
const paperOnly = {
  ...s,
  molecules: [],
  series: [
    {
      ...s.series[0],
      origin: "computational",
      researchFocus: "method-validation",
      targetIds: ["t"],
      sourceIds: ["paper-only"],
    },
  ],
  sources: [source("paper-only", "A paper with many designs")],
};
const paperView = researchState(paperOnly, "computational");
assert.equal(
  paperView.targets.length,
  1,
  "a paper can be indexed without enumerating every design",
);
const { computationalPapers } = await import("../src/research-view.ts");
assert.equal(computationalPapers(paperView, "t").length, 1);

const programView = researchState(original, "development");
assert.equal(
  programView.molecules.filter((m) => m.targetIds.includes("pcsk9")).length,
  1,
);
assert.ok(programView.molecules.some((m) => m.id === "enlicitide"));
assert.ok(!programView.molecules.some((m) => m.id.startsWith("pcsk9-c")));
assert.equal(experimentalMolecules(original, "pcsk9").length, 74);
for (const id of [
  "p630",
  "p630-tmr",
  "il23r-wo2022109328-seq1",
  "ap8784-m",
  "krpep2",
  "krpep2d",
  "tnik-tk7-2026",
])
  assert.ok(
    !programView.molecules.some((m) => m.id === id),
    `${id} is research context`,
  );
for (const id of ["syh2082", "atsp7041"])
  assert.ok(
    programView.molecules.some((m) => m.id === id),
    "verified preclinical programs remain visible",
  );
assert.ok(
  original.molecules.every((m) => m.trackingRole && m.trackingRoleNote),
  "curated molecules require an explicit program/research classification",
);
assert.ok(
  researchState(original, "development", true).molecules.some(
    (m) => m.id === "tnik-tk7-2026",
  ),
  "research-only targets remain discoverable in the catalog",
);
