# Discord Focus — Firefox-First One-Shot MVP

## Goal

Build a local-only browser extension that reduces Discord Web to the active text conversation. Firefox on Windows is the reference target; Chrome on Windows is secondary. Development, tests, and builds run in WSL2.

## V1 user experience

1. Open `https://discord.com/channels/*`.
2. Focus mode starts enabled.
3. By default, the page shows only:
   - the current message or thread content;
   - temporary native menus, dialogs, popouts, and Discord's Quick Switcher when invoked.
4. By default, hide all persistent Discord chrome, including:
   - server rail;
   - channel/DM sidebar;
   - account, mute, deafen, and voice controls contained in that sidebar;
   - channel header and persistent top toolbar;
   - member/activity sidebars.
   - message composer and its reply/edit/upload UI.
5. Use Discord's native `Ctrl+K` to switch destination.
6. The extension popup contains a global Focus mode toggle, `This channel` and `Defaults` scopes, `Hide navigation`, `Hide message box`, and status.
7. `Defaults` starts with both hide options checked and applies to every channel without a saved override.
8. `This channel` is available on exact numeric server-channel routes and shows the effective settings for the current channel. Changing either option saves both option values as that channel's override.
9. `Use defaults` removes the current channel's override. `Clear all channel settings` removes every saved override.
10. DMs, group DMs, private-browsing sessions, and unsupported or uncertain route shapes use defaults without saving per-channel settings.
11. `Hide navigation` independently controls the server rail and left channel/DM sidebar, including the account and voice controls contained there.
12. `Hide message box` independently controls the composer and its reply/edit/upload UI.
13. The right member/activity panel, headers, and other persistent cleanup remain hidden whenever Focus mode is enabled.
14. Turning Focus mode off restores normal Discord without reloading, regardless of the two independent settings.

Focus mode defaults to reading text conversations. Users may selectively restore navigation or the message box without disabling the remaining Focus cleanup.

Do not build custom navigation, injected controls, pinned channels, a replacement header, keyboard shortcuts, or a resource-saver feature.

## Supported views

Support normal server text channels, announcement channels, DMs, group DMs, and an opened text thread when their normal message list and composer anchors are present.

Remember per-channel overrides only for exact `/channels/<numeric-server>/<numeric-channel>` route shapes. Other supported conversations continue to use defaults.

Fail open on Friends/Home, forum index pages, voice/stage/call layouts, settings, login, and unknown Discord layouts.

## Layout rules

- First identify a conversation surface using message-list and composer anchors.
- Then identify each hideable region independently from an explicit selector allowlist.
- Mark exact regions with extension-owned `data-*` attributes and hide them through static extension CSS.
- Never remove, reparent, replace, or set inline styles on Discord nodes.
- Never hide an ancestor or descendant of the protected message list, modal layer, Quick Switcher, opened thread content, or native popout layer.
- Never classify a region from screen position, width, or "right-side" geometry alone.
- Generated Discord class-prefix selectors may be isolated fallbacks, not broad global CSS selectors.
- Missing selectors produce partial cleanup or no cleanup; they must never blank the conversation.

Keep selectors and detection in one module. Initial selector candidates may include:

- server rail: the closest navigation container containing `ul[data-list-id="guildsnav"]`;
- channel/DM sidebar: the sidebar ancestor of a `sidebarList_` class-prefix element;
- member list: a `membersWrap_` class-prefix element;
- channel header/top toolbar: only a header candidate structurally owned by the protected conversation container.

The detector must validate every candidate before marking it.

Use one debounced `MutationObserver` on Discord's application mount for SPA rerenders. Observe child-list changes only; do not poll or rescan on every mutation.

## Privacy and safety

The extension must:

- run only on `https://discord.com/channels/*`;
- use extension-local storage only;
- inspect structural DOM metadata in memory only;
- never read, log, store, or transmit message text, names, channel/server titles, account identifiers, tokens, cookies, Discord storage, or WebSocket data;
- use only the minimum route information required for local per-channel preferences: the content script may inspect the current `location.pathname` in memory and use only its channel segment to select an override;
- never log, persist, sync, expose to page content, or transmit a raw channel ID or URL; derive an opaque installation-specific key before persistence, then discard the raw pathname and channel ID;
- limit `storage.local` to the settings schema version, global/default booleans, a random local keying salt, opaque channel keys, and approved override booleans, and do not save per-channel preferences from private-browsing sessions;
- never call Discord APIs, automate account actions, or inject code into Discord's JavaScript runtime;
- include no analytics, telemetry, remote code, CDN assets, external services, or extension-originated network requests;
- request only the `storage` permission and the narrowly scoped static content-script match.

A development-only `tools/layout-probe.js` may output tag names, roles, allowlisted class prefixes, allowlisted generic `data-list-id` values, parent relationships, and rounded bounds. It must never output raw text, raw ARIA-label values, URLs, IDs, or arbitrary attributes.

## Browser architecture

- Manifest V3 WebExtension.
- Firefox build is canonical; Chrome is generated from the same source.
- Vanilla JavaScript, CSS, and HTML; no framework or runtime dependency.
- Static content script and popup; no background script or service worker.
- Promise-based `browser.*` API behind a tiny local adapter with a Chrome fallback.
- Settings schema: `{ version: 3, focusEnabled: true, defaults: { hideNavigation: true, hideMessageBox: true }, channelOverrides: {} }`.
- A separate random local salt derives installation-specific opaque keys. Raw channel IDs and paths never enter settings or popup messages.
- Version 1 and version 2 settings migrate into version 3 defaults, preserving existing behaviour.
- Popup writes global/default settings to `storage.local`; the content script writes and removes current-channel overrides after deriving the key locally. Content scripts react to `storage.onChanged`.
- Popup obtains page status and requests current-channel changes by messaging the active tab without reading its URL, receiving an identifier, or requesting the `tabs` permission.

Firefox manifest:

- stable Gecko ID: `discord-focus@houtan.local`;
- `strict_min_version`: `140.0`;
- `browser_specific_settings.gecko.data_collection_permissions.required`: `["none"]`.

Chrome output must omit Firefox-only manifest keys.

## Toolchain and WSL2

Use Node.js 22 and commit `package-lock.json`. Pin development dependencies to compatible major versions, including Mozilla `web-ext`. Use Node's built-in test runner plus one DOM test dependency if needed.

Required commands:

```text
npm run build
npm run test
npm run lint
npm run lint:firefox
npm run watch:firefox
npm run export:windows
npm run package:firefox
```

Build outputs:

```text
dist/firefox/
dist/chrome/
```

`watch:firefox` rebuilds and exports but does not try to control Windows Firefox.

`export:windows`:

- accepts `WINDOWS_DIST_DIR` as either a WSL path or Windows path;
- otherwise resolves `%LOCALAPPDATA%` using `powershell.exe` and converts it with `wslpath`;
- writes to `DiscordFocusBuild/firefox` and `DiscordFocusBuild/chrome`;
- validates the destination before deleting old output;
- ensures each exported browser folder directly contains `manifest.json`;
- prints both Windows paths.

`package:firefox` builds, tests, lints, runs `web-ext lint`, and creates an unsigned XPI/ZIP package. Mozilla credentials and unlisted signing are outside the one-shot build and must be documented, not automated with committed secrets.

## Repository layout

```text
src/
  content/channel-context.js
  content/content.js
  content/focus.css
  content/layout-detector.js
  popup/popup.html
  popup/popup.css
  popup/popup.js
  shared/extension-api.js
  shared/storage.js
  manifest.base.json
  manifest.firefox.json
  manifest.chrome.json
scripts/
  build.mjs
  export-windows.mjs
  package-firefox.mjs
  check-privacy.mjs
tools/layout-probe.js
tests/
eslint.config.mjs
README.md
package.json
package-lock.json
```

## Automated acceptance

- Firefox and Chrome manifests build correctly.
- `web-ext lint` reports no Firefox errors.
- Tests cover storage migration, opaque key derivation, raw-identifier rejection, defaults, per-channel overrides, override removal, popup scope state, private-browsing fallback, manifest generation, detector success, composer hiding, partial success, failure, protected-node rejection, SPA channel changes, rerenders, and restoration.
- Focus-off removes extension state immediately.
- Production code contains no network, Discord-storage, cookie, WebSocket, or page-runtime injection path.
- The layout probe is excluded from both production builds.
- No TODOs or placeholders remain in accepted scope.

## Manual acceptance on Windows

In current Firefox first, then Chrome:

- a normal text channel or DM shows only message/thread content;
- server rail, channel sidebar, account/voice controls, header, and member list are hidden;
- `Ctrl+K` opens unchanged and switching destinations keeps Focus mode active;
- reading, scrolling, reactions, context menus, dialogs, and an opened thread still work;
- turning Focus mode off restores composing, sending, replying, editing, and uploading;
- turning Focus mode off restores the full Discord UI without reload;
- unchecking `Hide navigation` restores the server rail and left sidebar without restoring the message box;
- unchecking `Hide message box` restores composing without restoring navigation;
- changing either option in `This channel` creates a saved override without changing `Defaults`;
- returning to an overridden server channel restores its two saved options;
- an unconfigured server channel and a DM use `Defaults`;
- `Use defaults` removes the current override and `Clear all channel settings` removes every override;
- all four navigation/message-box combinations survive SPA rerenders;
- unsupported views remain unchanged rather than broken.

Manual live-Discord checks and Mozilla signing are the only expected post-generation steps. Codex must report them as pending if it cannot perform them.

## One-shot Codex instruction

Implement this specification end-to-end in the current repository. Read `AGENTS.md` first. Do not expand scope or copy third-party extension code. Make Firefox pass automated checks first, then Chrome. Run all builds, tests, linting, privacy checks, Firefox linting, packaging, and the WSL2 export when Windows interop is available. Do not claim live Discord or Windows-browser behaviour was verified unless it was actually tested. Finish with exact Firefox temporary-load steps, exported paths, Chrome load steps, and the remaining manual checklist.
