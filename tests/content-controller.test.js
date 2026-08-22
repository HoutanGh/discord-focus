const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const test = require("node:test");
const channelContext = require("../src/content/channel-context.js");
const storage = require("../src/shared/storage.js");
const layout = require("../src/content/layout-detector.js");
const content = require("../src/content/content.js");
const { createMemoryApi, discordFixture, wait } = require("./helpers.js");

test("content controller applies focus and reports status", async () => {
  const dom = discordFixture();
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  const status = await controller.start();
  const messageStatus = await api.runtime.messageListener({ type: content.GET_STATUS_MESSAGE });

  assert.equal(status.active, true);
  assert.equal(status.status, "active");
  assert.equal(messageStatus.hiddenCount, 5);
  controller.stop();
});

test("content controller restores page when Focus mode is disabled", async () => {
  const dom = discordFixture();
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  assert.equal(dom.window.document.querySelectorAll(`[${layout.ATTR_HIDDEN}]`).length, 5);

  await storage.writeFocusEnabled(false, api);
  await wait(5);

  assert.equal(controller.getStatus().active, false);
  assert.equal(dom.window.document.querySelectorAll(`[${layout.ATTR_HIDDEN}]`).length, 0);
  controller.stop();
});

test("content controller toggles navigation and the message box independently", async () => {
  const dom = discordFixture();
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  await storage.writeHideNavigation(false, api);
  await wait(5);

  assert.equal(dom.window.document.querySelector(".guilds_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(dom.window.document.querySelector(".sidebar_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(dom.window.document.querySelector(".channelTextArea_a").getAttribute(layout.ATTR_HIDDEN), "composer");
  assert.equal(controller.getStatus().hiddenCount, 3);

  await storage.writeHideMessageBox(false, api);
  await wait(5);

  assert.equal(dom.window.document.querySelector(".channelTextArea_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(dom.window.document.querySelector("header").getAttribute(layout.ATTR_HIDDEN), "header");
  assert.equal(dom.window.document.querySelector(".membersWrap_a").getAttribute(layout.ATTR_HIDDEN), "member-panel");
  assert.deepEqual(controller.getStatus(), {
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: false,
    channelSettingsAvailable: true,
    channelOverrideActive: false,
    channelSettingsReason: "available",
    active: true,
    status: "active",
    statusLabel: "active",
    hiddenCount: 2,
    protectedCount: 2
  });

  controller.stop();
});

test("content controller rescans after SPA child-list changes", async () => {
  const dom = discordFixture({ includeMemberPanel: false });
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  const memberPanel = dom.window.document.createElement("aside");
  memberPanel.className = "membersWrap_b";
  dom.window.document.querySelector(".chat_a").append(memberPanel);
  await wait(10);

  assert.equal(memberPanel.getAttribute(layout.ATTR_HIDDEN), "member-panel");
  controller.stop();
});

test("content controller hides a new-message bar inserted after startup", async () => {
  const dom = discordFixture();
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  const newMessageBar = dom.window.document.createElement("div");
  newMessageBar.className = "newMessagesBar_b barBase_b";
  dom.window.document.querySelector(".chatContent_a").prepend(newMessageBar);
  await wait(10);

  assert.equal(newMessageBar.getAttribute(layout.ATTR_HIDDEN), "new-messages-bar");
  controller.stop();
});

test("content controller preserves visible navigation and message box after an SPA rerender", async () => {
  const dom = discordFixture();
  const api = createMemoryApi({
    version: 2,
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: false
  });
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  const documentRef = dom.window.document;
  const replacementSidebar = documentRef.createElement("aside");
  replacementSidebar.className = "sidebar_b";
  const sidebarList = documentRef.createElement("div");
  sidebarList.className = "sidebarList_b";
  replacementSidebar.append(sidebarList);
  documentRef.querySelector(".sidebar_a").replaceWith(replacementSidebar);

  const replacementComposer = documentRef.createElement("form");
  replacementComposer.className = "channelTextArea_b";
  const editor = documentRef.createElement("div");
  editor.setAttribute("role", "textbox");
  editor.setAttribute("contenteditable", "true");
  editor.setAttribute("data-slate-editor", "true");
  replacementComposer.append(editor);
  documentRef.querySelector(".channelTextArea_a").replaceWith(replacementComposer);
  await wait(10);

  assert.equal(replacementSidebar.hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(replacementComposer.hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(documentRef.querySelector("header").getAttribute(layout.ATTR_HIDDEN), "header");
  assert.equal(controller.getStatus().hiddenCount, 2);
  controller.stop();
});

test("content controller applies a remembered override for the current channel", async () => {
  const pathname = "/channels/111111111111111111/222222222222222222";
  const salt = "a".repeat(64);
  const dom = discordFixture({
    url: `https://discord.com${pathname}`
  });
  const api = createMemoryApi(undefined, {
    initialStore: {
      [storage.CHANNEL_KEY_SALT_KEY]: salt
    }
  });
  const key = await channelContext.deriveOpaqueChannelKey(pathname, salt, webcrypto);
  await storage.writeChannelOverride(key, {
    hideNavigation: false,
    hideMessageBox: false
  }, api);
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();

  assert.equal(dom.window.document.querySelector(".guilds_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(dom.window.document.querySelector(".sidebar_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(dom.window.document.querySelector(".channelTextArea_a").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(controller.getStatus().channelOverrideActive, true);
  assert.equal(controller.getStatus().hiddenCount, 2);
  controller.stop();
});

test("content controller switches between channel overrides and defaults after SPA navigation", async () => {
  const firstPath = "/channels/111111111111111111/222222222222222222";
  const secondPath = "/channels/111111111111111111/333333333333333333";
  const salt = "b".repeat(64);
  const dom = discordFixture({
    url: `https://discord.com${firstPath}`
  });
  const api = createMemoryApi(undefined, {
    initialStore: {
      [storage.CHANNEL_KEY_SALT_KEY]: salt
    }
  });
  const firstKey = await channelContext.deriveOpaqueChannelKey(firstPath, salt, webcrypto);
  await storage.writeChannelOverride(firstKey, {
    hideNavigation: false,
    hideMessageBox: false
  }, api);
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  assert.equal(controller.getStatus().channelOverrideActive, true);
  assert.equal(controller.getStatus().hiddenCount, 2);

  dom.reconfigure({ url: `https://discord.com${secondPath}` });
  dom.window.document.querySelector("#app-mount").append(dom.window.document.createElement("span"));
  await wait(15);

  assert.equal(controller.getStatus().channelOverrideActive, false);
  assert.equal(controller.getStatus().hiddenCount, 5);
  assert.equal(dom.window.document.querySelector(".guilds_a").getAttribute(layout.ATTR_HIDDEN), "server-rail");
  assert.equal(dom.window.document.querySelector(".channelTextArea_a").getAttribute(layout.ATTR_HIDDEN), "composer");

  dom.reconfigure({ url: `https://discord.com${firstPath}` });
  dom.window.document.querySelector("#app-mount").append(dom.window.document.createElement("span"));
  await wait(15);

  assert.equal(controller.getStatus().channelOverrideActive, true);
  assert.equal(controller.getStatus().hiddenCount, 2);
  controller.stop();
});

test("content messages save and remove only the current opaque channel override", async () => {
  const channelId = "777777777777777777";
  const dom = discordFixture({
    url: `https://discord.com/channels/666666666666666666/${channelId}`
  });
  const api = createMemoryApi();
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  await controller.start();
  assert.equal(api.__store[storage.CHANNEL_KEY_SALT_KEY], undefined);
  const overridden = await api.runtime.messageListener({
    type: content.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
    hideNavigation: false,
    hideMessageBox: false
  });
  const savedSettings = await storage.readSettings(api);
  const savedKeys = Object.keys(savedSettings.channelOverrides);

  assert.equal(overridden.channelOverrideActive, true);
  assert.equal(overridden.hideNavigation, false);
  assert.equal(overridden.hideMessageBox, false);
  assert.equal(savedKeys.length, 1);
  assert.match(savedKeys[0], storage.OPAQUE_CHANNEL_KEY_PATTERN);
  assert.match(api.__store[storage.CHANNEL_KEY_SALT_KEY], /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(api.__store).includes(channelId), false);
  assert.equal(JSON.stringify(overridden).includes(channelId), false);
  assert.equal(JSON.stringify(overridden).includes(savedKeys[0]), false);

  const restored = await api.runtime.messageListener({
    type: content.USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE
  });
  assert.equal(restored.channelOverrideActive, false);
  assert.deepEqual((await storage.readSettings(api)).channelOverrides, {});
  controller.stop();
});

test("content controller uses defaults when local channel-key derivation is unavailable", async () => {
  const dom = discordFixture();
  const api = createMemoryApi(undefined, {
    initialStore: {
      [storage.CHANNEL_KEY_SALT_KEY]: "c".repeat(64)
    }
  });
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: {
      getRandomValues(bytes) {
        return bytes;
      }
    },
    debounceMs: 1
  });

  const status = await controller.start();

  assert.equal(status.channelSettingsAvailable, false);
  assert.equal(status.channelSettingsReason, "unavailable");
  assert.equal(status.hideNavigation, true);
  assert.equal(status.hideMessageBox, true);
  assert.equal(status.hiddenCount, 5);
  controller.stop();
});

test("content controller does not save channel settings in private browsing", async () => {
  const dom = discordFixture();
  const api = createMemoryApi(undefined, {
    inIncognitoContext: true
  });
  const controller = content.createFocusController({
    document: dom.window.document,
    window: dom.window,
    api,
    storage,
    detector: layout,
    channelContext,
    crypto: webcrypto,
    debounceMs: 1
  });

  const status = await controller.start();

  assert.equal(status.channelSettingsAvailable, false);
  assert.equal(status.channelSettingsReason, "private");
  assert.equal(api.__store[storage.CHANNEL_KEY_SALT_KEY], undefined);
  await assert.rejects(api.runtime.messageListener({
    type: content.SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
    hideNavigation: false,
    hideMessageBox: false
  }), /unavailable/);
  assert.deepEqual((await storage.readSettings(api)).channelOverrides, {});
  controller.stop();
});
