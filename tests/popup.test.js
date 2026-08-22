const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const popup = require("../src/popup/popup.js");
const storage = require("../src/shared/storage.js");
const { createMemoryApi, wait } = require("./helpers.js");

function popupDocument() {
  return new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <input id="focus-toggle" type="checkbox">
        <input id="navigation-toggle" type="checkbox">
        <input id="message-box-toggle" type="checkbox">
        <p id="status"></p>
      </body>
    </html>
  `);
}

test("popup initializes all controls with hide-everything defaults", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  api.runtime.messageListener = () => ({ active: true, status: "active" });

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  assert.equal(dom.window.document.querySelector("#focus-toggle").checked, true);
  assert.equal(dom.window.document.querySelector("#navigation-toggle").checked, true);
  assert.equal(dom.window.document.querySelector("#message-box-toggle").checked, true);
  assert.equal(dom.window.document.querySelector("#status").textContent, "Focus mode is active.");
});

test("popup writes navigation and message-box controls independently", async () => {
  const dom = popupDocument();
  const api = createMemoryApi();
  api.runtime.messageListener = () => ({ active: true, status: "active" });

  await popup.initPopup({
    document: dom.window.document,
    api,
    storage
  });

  const navigationToggle = dom.window.document.querySelector("#navigation-toggle");
  navigationToggle.checked = false;
  navigationToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(5);

  const messageBoxToggle = dom.window.document.querySelector("#message-box-toggle");
  messageBoxToggle.checked = false;
  messageBoxToggle.dispatchEvent(new dom.window.Event("change"));
  await wait(5);

  assert.deepEqual(await storage.readSettings(api), {
    version: 2,
    focusEnabled: true,
    hideNavigation: false,
    hideMessageBox: false
  });
});
