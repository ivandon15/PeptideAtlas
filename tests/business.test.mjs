import fs from "node:fs";
import assert from "node:assert/strict";
import {
  filterDeals,
  emptyDealFilters,
  eventKind,
  companyAssets,
} from "../src/business.ts";
const d = JSON.parse(
  fs.readFileSync(new URL("../data/pilot.json", import.meta.url), "utf8"),
);
const f = (p) => ({ ...emptyDealFilters, ...p });
assert.equal(filterDeals(d, f({ query: "AVR-001" })).length, 3);
assert.equal(filterDeals(d, f({ query: "AVR001" })).length, 3);
assert.equal(
  filterDeals(d, f({ company: "hansoh", kind: "license" }))[0].id,
  "hansoh-avere-il23r-license",
);
assert.ok(
  filterDeals(d, f({ target: "undisclosed" })).some(
    (x) => x.id === "ra-merck-2013",
  ),
);
assert.ok(
  filterDeals(d, f({ target: "undisclosed" })).every(
    (x) => !x.targetIds.length,
  ),
);
assert.equal(
  eventKind(d.deals.find((x) => x.id === "gilead-pepstar-2026")),
  "acquisition",
);
assert.equal(
  filterDeals(d, f({ since: "2026-07", until: "2026-07", kind: "license" }))
    .length,
  0,
  "June signing is not July announcement",
);
assert.ok(
  filterDeals(d, f({ region: "台湾", kind: "license" })).some(
    (x) => x.id === "hansoh-avere-il23r-license",
  ),
  "region searches disclosed rights text including exclusions",
);
assert.equal(companyAssets(d, "gilead")[0].id, "hcxt2001");
assert.ok(companyAssets(d, "merck").every((m) => m.trackingRole === "program"));
assert.ok(
  !companyAssets(d, "merck").some((m) => m.id.startsWith("pcsk9-c")),
  "authored SAR analogues do not become a company's drug portfolio",
);
assert.equal(filterDeals(d, f({ query: "nonexistent" })).length, 0);
assert.ok(
  filterDeals(d, f({ stage: "early" })).some((x) => x.id === "ra-merck-2013"),
);
console.log(
  "Business: aliases, intersecting filters, signing dates, rights text, platform and company assets passed.",
);
const dateFixture = {
  ...d,
  deals: [
    {
      ...d.deals[0],
      id: "old",
      name: "B",
      date: "2020-01",
      signedPeriod: "",
      announcedAt: "",
    },
    {
      ...d.deals[0],
      id: "unknown",
      name: "A",
      date: "",
      signedPeriod: "",
      announcedAt: "",
    },
    {
      ...d.deals[0],
      id: "new",
      name: "C",
      date: "2026-10-22",
      signedPeriod: "",
      announcedAt: "",
    },
  ],
};
assert.deepEqual(
  filterDeals(dateFixture, f({})).map((x) => x.id),
  ["new", "old", "unknown"],
);
assert.deepEqual(
  filterDeals(dateFixture, f({}), "oldest").map((x) => x.id),
  ["old", "new", "unknown"],
);
assert.deepEqual(
  filterDeals(dateFixture, f({}), "name").map((x) => x.id),
  ["unknown", "old", "new"],
);
console.log(
  "Business sorting: newest default, oldest, name and missing dates passed.",
);
