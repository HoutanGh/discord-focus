const assert = require("node:assert/strict");
const test = require("node:test");
const storage = require("../src/shared/storage.js");
const { createMemoryApi } = require("./helpers.js");

test("defaults Focus mode to enabled", async () => {
  const api = createMemoryApi(null);
  const settings = await storage.readSettings(api);

  assert.deepEqual(settings, {
    version: 2,
    focusEnabled: true,
    hideNavigation: true,
    hideMessageBox: true
  });
});

test("migrates existing settings to hiding navigation and the message box", () => {
  assert.deepEqual(storage.normalizeSettings({
    version: 1,
    focusEnabled: false
  }), {
    version: 2,
    focusEnabled: false,
    hideNavigation: true,
    hideMessageBox: true
  });
});

test("writes and reads Focus mode setting", async () => {
  const api = createMemoryApi();

  await storage.writeFocusEnabled(false, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, false);

  await storage.writeFocusEnabled(true, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, true);
});

test("writes navigation and message-box settings independently", async () => {
  const api = createMemoryApi();

  await storage.writeHideNavigation(false, api);
  assert.deepEqual(await storage.readSettings(api), {
    version: 2,
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: true
  });

  await storage.writeHideMessageBox(false, api);
  assert.deepEqual(await storage.readSettings(api), {
    version: 2,
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: false
  });
});

test("normalizes storage change events", () => {
  const next = storage.settingsFromChange({
    discordFocusSettings: {
      oldValue: {
        version: 2,
        focusEnabled: true,
        hideNavigation: true,
        hideMessageBox: true
      },
      newValue: {
        version: 2,
        focusEnabled: false,
        hideNavigation: false,
        hideMessageBox: true
      }
    }
  }, "local");

  assert.deepEqual(next, {
    version: 2,
    focusEnabled: false,
    hideNavigation: false,
    hideMessageBox: true
  });
});
