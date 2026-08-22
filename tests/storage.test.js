const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const test = require("node:test");
const channelContext = require("../src/content/channel-context.js");
const storage = require("../src/shared/storage.js");
const { createMemoryApi } = require("./helpers.js");

const CHANNEL_KEY = `dfc_${"a".repeat(64)}`;

test("defaults Focus mode and channel preferences to hide everything", async () => {
  const api = createMemoryApi(null);
  const settings = await storage.readSettings(api);

  assert.deepEqual(settings, {
    version: 3,
    focusEnabled: true,
    defaults: {
      hideNavigation: true,
      hideMessageBox: true
    },
    channelOverrides: {}
  });
});

test("migrates version 1 and version 2 settings into version 3 defaults", () => {
  assert.deepEqual(storage.normalizeSettings({
    version: 1,
    focusEnabled: false
  }), {
    version: 3,
    focusEnabled: false,
    defaults: {
      hideNavigation: true,
      hideMessageBox: true
    },
    channelOverrides: {}
  });

  assert.deepEqual(storage.normalizeSettings({
    version: 2,
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: true
  }), {
    version: 3,
    focusEnabled: true,
    defaults: {
      hideNavigation: false,
      hideMessageBox: true
    },
    channelOverrides: {}
  });
});

test("writes the global Focus mode independently", async () => {
  const api = createMemoryApi();

  await storage.writeFocusEnabled(false, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, false);

  await storage.writeFocusEnabled(true, api);
  assert.equal((await storage.readSettings(api)).focusEnabled, true);
});

test("writes navigation and message-box defaults independently", async () => {
  const api = createMemoryApi();

  await storage.writeHideNavigation(false, api);
  await storage.writeHideMessageBox(false, api);

  assert.deepEqual((await storage.readSettings(api)).defaults, {
    hideNavigation: false,
    hideMessageBox: false
  });
});

test("applies, removes, and clears complete channel overrides", async () => {
  const api = createMemoryApi();
  const secondKey = `dfc_${"b".repeat(64)}`;

  let settings = await storage.writeChannelOverride(CHANNEL_KEY, {
    hideNavigation: false,
    hideMessageBox: true
  }, api);
  assert.deepEqual(storage.effectivePreferences(settings, CHANNEL_KEY), {
    hideNavigation: false,
    hideMessageBox: true,
    channelOverrideActive: true
  });
  assert.deepEqual(storage.effectivePreferences(settings, secondKey), {
    hideNavigation: true,
    hideMessageBox: true,
    channelOverrideActive: false
  });

  settings = await storage.writeChannelOverride(secondKey, {
    hideNavigation: true,
    hideMessageBox: false
  }, api);
  assert.equal(Object.keys(settings.channelOverrides).length, 2);

  settings = await storage.removeChannelOverride(CHANNEL_KEY, api);
  assert.equal(settings.channelOverrides[CHANNEL_KEY], undefined);
  assert.equal(Object.keys(settings.channelOverrides).length, 1);

  settings = await storage.clearChannelOverrides(api);
  assert.deepEqual(settings.channelOverrides, {});
});

test("rejects raw identifiers and incomplete channel preferences", async () => {
  const api = createMemoryApi();

  await assert.rejects(
    storage.writeChannelOverride("999999999999999999", {
      hideNavigation: false,
      hideMessageBox: false
    }, api),
    /opaque local key/
  );
  await assert.rejects(
    storage.writeChannelOverride(CHANNEL_KEY, {
      hideNavigation: false
    }, api),
    /both supported options/
  );
});

test("filters malformed or non-opaque stored overrides", () => {
  const settings = storage.normalizeSettings({
    version: 3,
    focusEnabled: true,
    defaults: {
      hideNavigation: true,
      hideMessageBox: true
    },
    channelOverrides: {
      "999999999999999999": {
        hideNavigation: false,
        hideMessageBox: false
      },
      [CHANNEL_KEY]: {
        hideNavigation: false,
        hideMessageBox: true
      },
      [`dfc_${"c".repeat(64)}`]: {
        hideNavigation: "false",
        hideMessageBox: true
      }
    }
  });

  assert.deepEqual(settings.channelOverrides, {
    [CHANNEL_KEY]: {
      hideNavigation: false,
      hideMessageBox: true
    }
  });
});

test("stores only an opaque key and booleans for a channel override", async () => {
  const api = createMemoryApi();
  const rawPath = "/channels/111111111111111111/999999999999999999";
  const key = await channelContext.deriveOpaqueChannelKey(
    rawPath,
    "d".repeat(64),
    webcrypto
  );

  await storage.writeChannelOverride(key, {
    hideNavigation: false,
    hideMessageBox: true
  }, api);

  const persisted = JSON.stringify(api.__store);
  assert.equal(persisted.includes(rawPath), false);
  assert.equal(persisted.includes("111111111111111111"), false);
  assert.equal(persisted.includes("999999999999999999"), false);
  assert.equal(persisted.includes(key), true);
});

test("creates and reuses a local installation salt", async () => {
  const api = createMemoryApi();
  const generated = "e".repeat(64);

  assert.equal(await storage.ensureChannelKeySalt(() => generated, api), generated);
  assert.equal(await storage.readChannelKeySalt(api), generated);
  assert.equal(await storage.ensureChannelKeySalt(() => {
    throw new Error("should not create a second salt");
  }, api), generated);
});

test("normalizes storage change events", () => {
  const next = storage.settingsFromChange({
    discordFocusSettings: {
      oldValue: null,
      newValue: {
        version: 3,
        focusEnabled: false,
        defaults: {
          hideNavigation: false,
          hideMessageBox: true
        },
        channelOverrides: {}
      }
    }
  }, "local");

  assert.deepEqual(next, {
    version: 3,
    focusEnabled: false,
    defaults: {
      hideNavigation: false,
      hideMessageBox: true
    },
    channelOverrides: {}
  });
  assert.equal(storage.channelKeySaltChanged({
    discordFocusChannelKeySalt: {
      oldValue: null,
      newValue: "f".repeat(64)
    }
  }, "local"), true);
});
