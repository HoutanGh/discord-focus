const assert = require("node:assert/strict");
const test = require("node:test");
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
    debounceMs: 1
  });

  const status = await controller.start();
  const messageStatus = api.runtime.messageListener({ type: content.GET_STATUS_MESSAGE });

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
