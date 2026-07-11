const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

test("collapses only the marked Discord title-bar grid in Focus mode", async () => {
  const css = await readFile(path.join(__dirname, "../src/content/focus.css"), "utf8");

  assert.match(
    css,
    /html\[data-discord-focus-active="true"\] \[data-discord-focus-layout="title-bar-grid"\]/
  );
  assert.match(css, /--custom-app-top-bar-height: 0px !important/);
  assert.match(css, /\[top\] 0\s+\[titleBarEnd\] auto\s+\[noticeEnd\] minmax\(0, 1fr\)/);
});
