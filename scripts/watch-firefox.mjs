import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "./build.mjs";
import { exportWindows } from "./export-windows.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watchedDirs = ["src", "scripts"].map((name) => path.join(rootDir, name));
let pending = null;
let running = false;

async function rebuildAndExport() {
  if (running) {
    return;
  }
  running = true;
  try {
    await buildAll();
    await exportWindows();
    console.log("Firefox watch export complete.");
  } finally {
    running = false;
  }
}

function schedule() {
  if (pending) {
    clearTimeout(pending);
  }
  pending = setTimeout(() => {
    pending = null;
    rebuildAndExport().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
    });
  }, 150);
}

await rebuildAndExport();

watchedDirs.forEach((directory) => {
  watch(directory, { recursive: true }, schedule);
});

console.log("Watching source files for Firefox exports.");
