import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isRecent,
  shanghaiDate,
  targetIsRecent,
  overviewData,
} from "../src/summary-data.ts";
const today = "2026-10-27";
assert.equal(shanghaiDate(new Date("2026-10-26T16:01:00Z")), today);
for (const date of ["2026-10-23", "2026-10-27"])
  assert.equal(isRecent(date, today), true);
for (const date of [
  "2026-10-22",
  "2026-10-28",
  "2026-10",
  "2026-02-30",
  "bad",
  null,
])
  assert.equal(isRecent(date, today), false);
const s = JSON.parse(
  fs.readFileSync(new URL("../data/pilot.json", import.meta.url)),
);
const d = overviewData(s, today);
assert.ok(d.development.molecules.some((m) => m.id === "asc36"));
assert.equal(
  new Set(d.development.molecules.map((m) => m.id)).size,
  d.development.molecules.length,
  "development records remain unique, independent of later additions",
);
assert.equal(
  d.kinds.reduce((n, x) => n + x[1], 0),
  s.deals.length,
);
assert.equal(d.targets.find((t) => t.id === "glp1r").count, 15);
assert.equal(
  d.targets.find((t) => t.id === "pcsk9").count,
  1,
  "SAR analogues do not increase the drug-development count",
);
assert.equal(
  d.targets.find((t) => t.id === "il23r").count,
  5,
  "probes and unmapped patent sequences are excluded from project counts",
);
assert.equal(
  d.targets.every(
    (t) => t.early + t.clinical + t.approved + t.unknown === t.count,
  ),
  true,
);
const targetId = s.molecules[0].targetIds[0];
const fixture = {
  ...s,
  evidence: [
    {
      ...s.evidence[0],
      moleculeIds: [s.molecules[0].id],
      seriesIds: [],
      date: "2026-10-24",
      verification: "reviewed",
      outcome: "reported",
    },
  ],
  sources: [],
  deals: [],
};
assert.equal(targetIsRecent(fixture, targetId, today), true);
fixture.evidence[0].outcome = "planned";
assert.equal(targetIsRecent(fixture, targetId, today), false);
fixture.evidence[0].outcome = "reported";
fixture.evidence[0].verification = "candidate";
assert.equal(targetIsRecent(fixture, targetId, today), false);
fixture.evidence = [];
fixture.molecules = fixture.molecules.map((m) => ({ ...m, asOf: today }));
assert.equal(
  targetIsRecent(fixture, targetId, today),
  false,
  "checking an old record today is not a new event",
);
console.log(
  "Summary: Shanghai calendar, five-day boundaries, no future/planned/candidate highlights, complete grouping and stage sums passed.",
);
const scoped = {
  ...s,
  deals: [{ ...s.deals[0], date: "2026-10-24", targetIds: ["il23r"] }],
  evidence: [
    {
      ...s.evidence[0],
      date: "2026-10-24",
      line: "regulatory",
      verification: "reviewed",
      outcome: "reported",
      moleculeIds: ["icotrokinra"],
      seriesIds: [],
    },
  ],
  sources: s.sources.map((p) => ({ ...p, publishedAt: "2025-01-01" })),
};
assert.equal(targetIsRecent(scoped, "il23r", today, "development"), true);
assert.equal(
  targetIsRecent(scoped, "il23r", today, "computational"),
  false,
  "drug approval and target-level business must not highlight model-validation papers",
);
scoped.evidence.push({
  ...scoped.evidence[0],
  line: "research",
  moleculeIds: ["il23r-p4-2025"],
});
assert.equal(
  targetIsRecent(scoped, "il23r", today, "computational"),
  true,
  "linked design research is eligible",
);
assert.equal(
  targetIsRecent(s, "il23r", today, "computational"),
  false,
  "actual IL23R computation study is not a five-day update",
);
