import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function mergeManifest(base, browserSpecific) {
  return {
    ...base,
    ...browserSpecific,
    action: {
      ...base.action,
      ...browserSpecific.action
    }
  };
}

function validateManifest(manifest, browserName) {
  const contentScript = manifest.content_scripts && manifest.content_scripts[0];

  if (manifest.manifest_version !== 3) {
    throw new Error(`${browserName} manifest must use Manifest V3.`);
  }
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(["storage"])) {
    throw new Error(`${browserName} manifest must request only storage permission.`);
  }
  if (!contentScript || JSON.stringify(contentScript.matches) !== JSON.stringify(["https://discord.com/channels/*"])) {
    throw new Error(`${browserName} content script match must stay narrowly scoped.`);
  }
  if (manifest.background) {
    throw new Error(`${browserName} manifest must not declare a background script.`);
  }
  if (browserName === "chrome" && manifest.browser_specific_settings) {
    throw new Error("Chrome manifest must omit Firefox-only settings.");
  }
}

async function copyExtensionFiles(browserOutDir) {
  await mkdir(browserOutDir, { recursive: true });
  await cp(path.join(srcDir, "content"), path.join(browserOutDir, "content"), { recursive: true });
  await cp(path.join(srcDir, "popup"), path.join(browserOutDir, "popup"), { recursive: true });
  await cp(path.join(srcDir, "shared"), path.join(browserOutDir, "shared"), { recursive: true });
}

export async function buildAll() {
  const baseManifest = await readJson(path.join(srcDir, "manifest.base.json"));
  await rm(distDir, { recursive: true, force: true });

  const outputs = [];
  for (const browserName of ["firefox", "chrome"]) {
    const browserManifest = await readJson(path.join(srcDir, `manifest.${browserName}.json`));
    const manifest = mergeManifest(baseManifest, browserManifest);
    validateManifest(manifest, browserName);

    const browserOutDir = path.join(distDir, browserName);
    await copyExtensionFiles(browserOutDir);
    await writeFile(
      path.join(browserOutDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    outputs.push(browserOutDir);
  }

  return outputs;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputs = await buildAll();
  outputs.forEach((output) => {
    console.log(`Built ${path.relative(rootDir, output)}`);
  });
}
