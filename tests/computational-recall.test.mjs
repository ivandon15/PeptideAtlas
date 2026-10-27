import fs from "node:fs";
import assert from "node:assert/strict";
import {
  researchState,
  computationalPapers,
  computationalResults,
} from "../src/research-view.ts";
const s = JSON.parse(
  fs.readFileSync(new URL("../data/pilot.json", import.meta.url)),
);
const audit = JSON.parse(
  fs.readFileSync(
    new URL("../data/computational-recall-2026-10-27.json", import.meta.url),
  ),
);
const v = researchState(s, "computational");
assert.equal(audit.targets.length, 23);
for (const w of audit.works) {
  assert.ok(s.sources.some((p) => p.id === w.sourceId));
  for (const id of w.targetIds)
    assert.ok(
      computationalPapers(v, id).some((p) => p.id === w.sourceId),
      `${id} lost paper ${w.doi}`,
    );
}
const referenceIds = new Set(audit.works.map((w) => w.sourceId));
assert.equal(
  computationalPapers(v).filter((p) => referenceIds.has(p.id)).length,
  referenceIds.size,
  "every reference paper is counted once, independent of later additions",
);
assert.equal(
  new Set(computationalPapers(v).map((p) => p.id)).size,
  computationalPapers(v).length,
  "one paper mapped to multiple targets remains a single publication",
);
assert.equal(
  computationalResults(v, "PepMimic").length,
  5,
  "paper-only studies must be searchable by method",
);
assert.equal(computationalResults(v, "HER2")[0].papers.length, 2);
assert.equal(computationalResults(v, "", "count")[0].target.id, "mdm2");
assert.equal(computationalResults(v, "no-such-method").length, 0);
assert.ok(
  s.evidence.some(
    (e) =>
      e.validationLevel === "not-detected" &&
      e.seriesIds.includes("study-bindcraft-peptide-cd274"),
  ),
);
assert.ok(
  s.sources.some(
    (p) => p.id === "compute-il4-mimic" && p.disposition === "pending",
  ),
);
assert.ok(
  !s.molecules.some((m) => m.seriesId.startsWith("mlip-rfd3-")),
  "computational benchmark mappings do not fabricate tested molecules",
);
console.log(
  "Reference DOI/target recall, publication deduplication, method search, negative and pending states passed.",
);
