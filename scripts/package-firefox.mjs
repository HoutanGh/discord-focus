import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}

function runNpmScript(name) {
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", name]);
}

await mkdir(path.join(rootDir, "artifacts"), { recursive: true });
runNpmScript("build");
run(nodeBin, ["--test", "tests/*.test.js"]);
runNpmScript("lint");
runNpmScript("lint:firefox");
run(process.platform === "win32" ? "npx.cmd" : "npx", [
  "web-ext",
  "build",
  "--source-dir",
  "dist/firefox",
  "--artifacts-dir",
  "artifacts",
  "--filename",
  "discord-focus-firefox.zip",
  "--overwrite-dest"
]);
