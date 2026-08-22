const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const popup = require("../src/popup/popup.js");
const storage = require("../src/shared/storage.js");
const { createMemoryApi, wait } = require("./helpers.js");

const CHANNEL_KEY = `dfc_${"a".repeat(64)}`;

function popupDocument() {
  const html = readFileSync(path.join(__dirname, "../src/popup/popup.html"), "utf8");
  return new JSDOM(html);
}

function attachPageHandler(api, initial = {}) {
  const received = [];
  let pageStatus = {
    active: true,
    status: "active",
    hideNavigation: true,
    hideMessageBox: true,
    channelSettingsAvailable: true,
    channelOverrideActive: false,
    channelSettingsReason: "available",
    ...initial
  };

  api.runtime.messageListener = async (message) => {
    received.push(message);
    if (message.type === popup.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE) {
      pageStatus = {
        ...pageStatus,
        hideNavigation: message.hideNavigation,
        hideMessageBox: message.hideMessageBox,
        channelOverrideActive: true
      };
    }
    if (message.type === popup.USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE) {
      const settings = await storage.readSettings(api);
      pageStatus = {
        ...pageStatus,
        ...settings.defaults,
        channelOverrideActive: false
      };
    }
    return { ...pageStatus };
  };

  return received;
}

test("popup opens on current-channel settings with hide-everything defaults", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  attachPageHandler(api);

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  const documentRef = dom.window.document;
  assert.equal(documentRef.querySelector("#focus-toggle").checked, true);
  assert.equal(documentRef.querySelector("#navigation-toggle").checked, true);
  assert.equal(documentRef.querySelector("#message-box-toggle").checked, true);
  assert.equal(documentRef.querySelector("#channel-scope").getAttribute("aria-selected"), "true");
  assert.equal(documentRef.querySelector("#defaults-scope").getAttribute("aria-selected"), "false");
  assert.equal(documentRef.querySelector("#use-defaults").disabled, true);
  assert.equal(documentRef.querySelector("#scope-status").textContent, "Using defaults for this channel.");
  assert.equal(documentRef.querySelector("#status").textContent, "Focus mode is active.");
});

test("popup keeps Focus mode as a global master switch", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  attachPageHandler(api);

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  const focusToggle = dom.window.document.querySelector("#focus-toggle");
  focusToggle.checked = false;
  focusToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(10);

  assert.equal((await storage.readSettings(api)).focusEnabled, false);
  assert.equal(dom.window.document.querySelector("#status").textContent, "Focus mode is off.");
});

test("popup writes both current-channel preferences without changing defaults", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  const received = attachPageHandler(api);

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  const navigationToggle = dom.window.document.querySelector("#navigation-toggle");
  navigationToggle.checked = false;
  navigationToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(10);

  const messageBoxToggle = dom.window.document.querySelector("#message-box-toggle");
  messageBoxToggle.checked = false;
  messageBoxToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(10);

  const updates = received.filter((message) => {
    return message.type === popup.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE;
  });
  assert.deepEqual(updates, [
    {
      type: popup.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
      hideNavigation: false,
      hideMessageBox: true
    },
    {
      type: popup.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
      hideNavigation: false,
      hideMessageBox: false
    }
  ]);
  assert.deepEqual((await storage.readSettings(api)).defaults, {
    hideNavigation: true,
    hideMessageBox: true
  });
  assert.equal(dom.window.document.querySelector("#use-defaults").disabled, false);
  assert.equal(dom.window.document.querySelector("#scope-status").textContent, "Using saved settings for this channel.");
});

test("popup restores current-channel defaults through the content script", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  const received = attachPageHandler(api, {
    hideNavigation: false,
    hideMessageBox: false,
    channelOverrideActive: true
  });

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });
  dom.window.document.querySelector("#use-defaults").click();
  await wait(10);

  assert.equal(received.some((message) => {
    return message.type === popup.USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE;
  }), true);
  assert.equal(dom.window.document.querySelector("#navigation-toggle").checked, true);
  assert.equal(dom.window.document.querySelector("#message-box-toggle").checked, true);
  assert.equal(dom.window.document.querySelector("#use-defaults").disabled, true);
});

test("popup edits defaults and clears every saved channel override", async () => {
  const dom = popupDocument();
  const api = createMemoryApi({
    version: 3,
    focusEnabled: true,
    defaults: {
      hideNavigation: true,
      hideMessageBox: true
    },
    channelOverrides: {
      [CHANNEL_KEY]: {
        hideNavigation: false,
        hideMessageBox: false
      }
    }
  });
  attachPageHandler(api, {
    hideNavigation: false,
    hideMessageBox: false,
    channelOverrideActive: true
  });

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });
  dom.window.document.querySelector("#defaults-scope").click();
  await wait(10);

  const navigationToggle = dom.window.document.querySelector("#navigation-toggle");
  navigationToggle.checked = false;
  navigationToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(10);

  assert.deepEqual((await storage.readSettings(api)).defaults, {
    hideNavigation: false,
    hideMessageBox: true
  });
  assert.equal(dom.window.document.querySelector("#scope-status").textContent, "1 saved channel setting.");

  dom.window.document.querySelector("#clear-channel-settings").click();
  await wait(10);

  assert.deepEqual((await storage.readSettings(api)).channelOverrides, {});
  assert.equal(dom.window.document.querySelector("#clear-channel-settings").disabled, true);
  assert.equal(
    dom.window.document.querySelector("#scope-status").textContent,
    "No saved channel settings."
  );
});

test("popup falls back to defaults when the active page cannot remember a channel", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  attachPageHandler(api, {
    active: false,
    status: "unsupported",
    channelSettingsAvailable: false,
    channelSettingsReason: "unsupported-route"
  });

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  assert.equal(dom.window.document.querySelector("#channel-scope").disabled, true);
  assert.equal(dom.window.document.querySelector("#channel-scope").getAttribute("aria-selected"), "false");
  assert.equal(dom.window.document.querySelector("#defaults-scope").getAttribute("aria-selected"), "true");
  assert.equal(
    dom.window.document.querySelector("#scope-status").textContent,
    "Channel settings are available in server channels."
  );
});
