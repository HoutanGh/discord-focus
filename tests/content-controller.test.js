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
