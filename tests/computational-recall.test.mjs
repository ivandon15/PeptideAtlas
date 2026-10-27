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
    (p) => p.id === "compute-il4-mimic" && p.disposition === "included",
  ),
);
const il4y = s.evidence.find((e) => e.id === "il4y-2025-mst");
assert.equal(il4y.assay.value, 349);
assert.equal(il4y.assay.unit, "µM");
assert.equal(
  s.evidence.find((e) => e.id === "il4x-2025-mst").validationLevel,
  "not-detected",
  "negative MST remains distinct from the calculated interaction",
);
const rfp = s.molecules.filter((m) => m.id.startsWith("rfp-"));
assert.equal(rfp.length, 77, "RFpeptides Tables 1a–4a selected designs");
assert.equal(rfp.filter((m) => m.stage === "in-vitro").length, 39);
const screens = s.evidence.filter(
  (e) => e.id.startsWith("rfp-") && e.id.endsWith("-selection"),
);
assert.equal(
  screens.filter((e) => e.validationLevel === "in-vitro").length,
  14,
);
assert.equal(
  screens.filter((e) => e.validationLevel === "not-detected").length,
  25,
);
assert.equal(
  screens.filter((e) => e.validationLevel === "computational-only").length,
  38,
);
assert.equal(
  s.evidence.find((e) => e.id === "pcsk9-c75-assay").assay.metric,
  "IC50",
  "the 2020 paper labels this measurement IC50; other assays report Ki",
);
assert.ok(
  !s.molecules.some((m) => m.seriesId.startsWith("mlip-rfd3-")),
  "computational benchmark mappings do not fabricate tested molecules",
);
console.log(
  "Reference DOI/target recall, publication deduplication, method search, negative and pending states passed.",
);
