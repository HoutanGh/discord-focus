const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const layout = require("../src/content/layout-detector.js");
const { discordFixture, unsupportedFixture } = require("./helpers.js");

test("detects and marks a supported Discord conversation layout", () => {
  const dom = discordFixture();
  const result = layout.applyFocus(dom.window.document);

  assert.equal(result.supported, true);
  assert.equal(result.status, "active");
  assert.equal(result.hiddenNodes.length, 4);
  assert.equal(result.protectedNodes.length, 3);
  assert.equal(dom.window.document.documentElement.getAttribute(layout.ATTR_ACTIVE), "true");
  assert.equal(dom.window.document.querySelectorAll(`[${layout.ATTR_HIDDEN}]`).length, 4);
  assert.equal(dom.window.document.querySelector("[data-list-id='chat-messages']").getAttribute(layout.ATTR_PROTECTED), "true");
});

test("reports partial cleanup when an allowlisted region is absent", () => {
  const dom = discordFixture({ includeServerRail: false });
  const result = layout.applyFocus(dom.window.document);

  assert.equal(result.supported, true);
  assert.equal(result.status, "partial");
  assert.ok(result.hiddenReasons.includes("channelSidebar"));
  assert.ok(result.hiddenReasons.includes("header"));
});

test("hides exact guild list when broad navigation contains protected content", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          <nav class="appNav_a">
            <div class="guilds_a"><ul data-list-id="guildsnav"></ul></div>
            <main class="chat_a">
              <header></header>
              <ol data-list-id="chat-messages"></ol>
              <form class="channelTextArea_a">
                <div role="textbox" contenteditable="true" data-slate-editor="true"></div>
              </form>
            </main>
          </nav>
        </div>
      </body>
    </html>
  `);

  const result = layout.applyFocus(dom.window.document);
  const guildList = dom.window.document.querySelector('ul[data-list-id="guildsnav"]');

  assert.equal(result.supported, true);
  assert.ok(result.hiddenReasons.includes("serverRail"));
  assert.equal(guildList.closest("nav").hasAttribute(layout.ATTR_HIDDEN), false);
  assert.equal(guildList.closest(".guilds_a").getAttribute(layout.ATTR_HIDDEN), "server-rail");
});

test("does not protect broad persistent layer wrappers", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          <div class="layer_a">
            <nav class="guilds_a"><ul data-list-id="guildsnav"></ul></nav>
            <aside class="sidebar_a"><div class="sidebarList_a"></div></aside>
            <main class="chat_a">
              <header></header>
              <section class="chatContent_a">
                <ol data-list-id="chat-messages"></ol>
                <form class="channelTextArea_a">
                  <div role="textbox" contenteditable="true" data-slate-editor="true"></div>
                </form>
              </section>
            </main>
          </div>
        </div>
      </body>
    </html>
  `);

  const result = layout.applyFocus(dom.window.document);
  const wrapper = dom.window.document.querySelector(".layer_a");

  assert.equal(result.supported, true);
  assert.equal(result.hiddenNodes.length, 3);
  assert.equal(wrapper.hasAttribute(layout.ATTR_PROTECTED), false);
  assert.ok(result.hiddenReasons.includes("serverRail"));
  assert.ok(result.hiddenReasons.includes("channelSidebar"));
  assert.ok(result.hiddenReasons.includes("header"));
});

test("hides safe page header outside the conversation root", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          <div class="base_a">
            <nav class="guilds_a"><ul data-list-id="guildsnav"></ul></nav>
            <header class="container_a"><div class="toolbar_a"></div></header>
            <section class="content_a">
              <div class="chatContent_a">
                <ol data-list-id="chat-messages"></ol>
                <form class="channelTextArea_a">
                  <div role="textbox" contenteditable="true" data-slate-editor="true"></div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </body>
    </html>
  `);

  const result = layout.applyFocus(dom.window.document);
  const header = dom.window.document.querySelector("header");

  assert.equal(result.supported, true);
  assert.ok(result.hiddenReasons.includes("header"));
  assert.equal(header.getAttribute(layout.ATTR_HIDDEN), "header");
});

test("hides live Discord title and top bar class-prefix structures", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          <div class="container__5e434">
            <div class="base__5e434">
              <div class="bar_c38106">
                <div class="title_c38106"></div>
              </div>
              <nav class="guilds_a"><ul data-list-id="guildsnav"></ul></nav>
              <aside class="sidebar_a"><div class="sidebarList_a"></div></aside>
              <div class="chat_f75fb0">
                <section class="title_f75fb0 container__9293f">
                  <div class="upperContainer__9293f">
                    <div class="children__9293f"></div>
                    <div class="toolbar__9293f"></div>
                  </div>
                </section>
                <div class="chatContent_a">
                  <ol data-list-id="chat-messages"></ol>
                  <form class="channelTextArea_a">
                    <div role="textbox" contenteditable="true" data-slate-editor="true"></div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);

  const result = layout.applyFocus(dom.window.document);
  const appBar = dom.window.document.querySelector(".bar_c38106");
  const titleBar = dom.window.document.querySelector(".title_f75fb0");

  assert.equal(result.supported, true);
  assert.equal(appBar.getAttribute(layout.ATTR_HIDDEN), "header");
  assert.equal(titleBar.getAttribute(layout.ATTR_HIDDEN), "header");
});

test("fails open on unsupported pages", () => {
  const dom = unsupportedFixture();
  const result = layout.applyFocus(dom.window.document);

  assert.equal(result.supported, false);
  assert.equal(result.status, "unsupported");
  assert.equal(dom.window.document.documentElement.hasAttribute(layout.ATTR_ACTIVE), false);
  assert.equal(dom.window.document.querySelectorAll(`[${layout.ATTR_HIDDEN}]`).length, 0);
});

test("rejects hide candidates that contain protected conversation nodes", () => {
  const dom = discordFixture({ includeMemberPanel: false });
  const documentRef = dom.window.document;
  const chatContent = documentRef.querySelector(".chatContent_a");
  chatContent.className = "membersWrap_a";

  const result = layout.applyFocus(documentRef);

  assert.equal(result.supported, true);
  assert.equal([...documentRef.querySelectorAll(`[${layout.ATTR_HIDDEN}]`)].includes(chatContent), false);
  assert.equal(documentRef.querySelector(".chat_a").getAttribute(layout.ATTR_ROOT), "conversation");
});

test("clears all extension-owned markers for restoration", () => {
  const dom = discordFixture();
  layout.applyFocus(dom.window.document);
  layout.clearFocusMarkers(dom.window.document);

  assert.equal(dom.window.document.documentElement.hasAttribute(layout.ATTR_ACTIVE), false);
  assert.equal(dom.window.document.querySelectorAll(`[${layout.ATTR_HIDDEN}], [${layout.ATTR_PROTECTED}], [${layout.ATTR_ROOT}]`).length, 0);
});
