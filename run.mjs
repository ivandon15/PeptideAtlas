import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url),
  cwd = fileURLToPath(new URL(".", import.meta.url));
const mode = process.argv[2];
if (!["dev", "start"].includes(mode)) throw Error("Use dev or start");
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const p of children) p.kill("SIGTERM");
  process.exitCode = code;
}
function run(cmd, args) {
  const child = spawn(cmd, args, { cwd, env: process.env, stdio: "inherit" });
  children.push(child);
  child.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!closing) stop(code || 0);
  });
  return child;
}
run(process.env.ATLAS_PYTHON || "python3", [
  "atlas.py",
  "serve",
  "--port",
  process.env.ATLAS_API_PORT || "8766",
]);
if (mode === "dev")
  run(process.execPath, [
    join(dirname(require.resolve("vite/package.json")), "bin/vite.js"),
    "--config",
    "vite.config.ts",
  ]);
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
