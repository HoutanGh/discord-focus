const assert = require("node:assert/strict");
const { readFile, stat } = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

test("build creates Firefox and Chrome manifests with expected permissions", async () => {
  const { buildAll } = await import("../scripts/build.mjs");
  await buildAll();

  const firefoxManifest = JSON.parse(await readFile(path.join(rootDir, "dist/firefox/manifest.json"), "utf8"));
  const chromeManifest = JSON.parse(await readFile(path.join(rootDir, "dist/chrome/manifest.json"), "utf8"));

  assert.deepEqual(firefoxManifest.permissions, ["storage"]);
  assert.deepEqual(chromeManifest.permissions, ["storage"]);
  assert.equal(firefoxManifest.browser_specific_settings.gecko.id, "discord-focus@houtan.local");
  assert.equal(firefoxManifest.browser_specific_settings.gecko.strict_min_version, "140.0");
  assert.deepEqual(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
  assert.equal(chromeManifest.browser_specific_settings, undefined);
  await stat(path.join(rootDir, "dist/firefox/manifest.json"));
  await stat(path.join(rootDir, "dist/chrome/manifest.json"));
});

test("production build excludes the development layout probe", async () => {
  const { buildAll } = await import("../scripts/build.mjs");
  await buildAll();

  await assert.rejects(stat(path.join(rootDir, "dist/firefox/tools/layout-probe.js")));
  await assert.rejects(stat(path.join(rootDir, "dist/chrome/tools/layout-probe.js")));
});

test("privacy scanner passes on production source", () => {
  const result = spawnSync(process.execPath, ["scripts/check-privacy.mjs"], {
    cwd: rootDir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
