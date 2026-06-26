const assert = require("node:assert/strict");
const test = require("node:test");
const storage = require("../src/shared/storage.js");
const { createMemoryApi } = require("./helpers.js");

test("defaults Focus mode to enabled", async () => {
  const api = createMemoryApi(null);
  const settings = await storage.readSettings(api);

  assert.deepEqual(settings, {
    version: 1,
    focusEnabled: true
  });
});

test("writes and reads Focus mode setting", async () => {
  const api = createMemoryApi();

  await storage.writeFocusEnabled(false, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, false);

  await storage.writeFocusEnabled(true, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, true);
});

test("normalizes storage change events", () => {
  const next = storage.settingsFromChange({
    discordFocusSettings: {
      oldValue: { version: 1, focusEnabled: true },
      newValue: { version: 1, focusEnabled: false }
    }
  }, "local");

  assert.deepEqual(next, {
    version: 1,
    focusEnabled: false
  });
});
