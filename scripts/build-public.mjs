import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const env = { ...process.env, VITE_ATLAS_PUBLIC: "1" };
for (const args of [
  [require.resolve("typescript/bin/tsc"), "--noEmit"],
  [
    join(dirname(require.resolve("vite/package.json")), "bin/vite.js"),
    "build",
    "--mode",
    "public",
    "--config",
    "vite.config.ts",
  ],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
