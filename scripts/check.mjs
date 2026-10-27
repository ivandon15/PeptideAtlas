import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.ATLAS_PYTHON || "python3";
const suites = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => `tests/${name}`);

for (const [command, args] of [
  [python, ["-m", "unittest", "discover", "-s", "tests", "-v"]],
  [process.execPath, ["--experimental-strip-types", "--test", ...suites]],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
