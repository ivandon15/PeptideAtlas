import assert from "node:assert/strict";
import { publicState, readPublicState } from "../src/public-state.ts";

const records = Object.fromEntries(
  [
    "targets",
    "companies",
    "sources",
    "series",
    "molecules",
    "evidence",
    "relations",
    "deals",
    "gaps",
  ].map((key) => [key, []]),
);
const snapshot = {
  schemaVersion: 1,
  publishedAt: "2026-10-27T00:00:00Z",
  dataVersion: "public-test",
  records,
};
const state = publicState(snapshot);
assert.deepEqual(state.uploads, []);
assert.deepEqual(state.receipts, []);
assert.equal(state.publication.dataVersion, "public-test");
assert.throws(() => publicState({ ...snapshot, schemaVersion: 99 }), /格式/);
assert.throws(() => publicState({ ...snapshot, records: {} }), /格式/);

const paths = [];
const request = async (url) => {
  paths.push(url);
  if (url === "remote") throw Error("network unavailable");
  return new Response(JSON.stringify(snapshot));
};
assert.equal(
  (await readPublicState("remote", "bundled", request)).publication.fallback,
  true,
);
assert.deepEqual(paths, ["remote", "bundled"]);
assert.equal(
  (await readPublicState("bundled", "bundled", request)).publication.fallback,
  undefined,
);
await assert.rejects(
  readPublicState(
    "bundled",
    "bundled",
    async () => new Response("", { status: 503 }),
  ),
);
console.log(
  "Public view: static loading, malformed snapshots, no private workflow state and explicit offline fallback passed.",
);
