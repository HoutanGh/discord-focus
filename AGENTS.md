# AGENTS.md

## Goal
Help me ship Discord Focus as a small, correct, Firefox-first WebExtension with reliable WSL2 workflows.

## Product source of truth
- Treat `docs/product-spec.md` as authoritative.
- V1 makes a normal Discord text conversation the only persistent page content.
- Firefox on Windows is the reference target; Chrome on Windows is secondary.
- Use Discord's native `Ctrl+K`; do not build replacement navigation.
- Do not expand scope without explicit approval.

## Visible and hidden UI
While Focus mode is enabled, preserve only:
- current message or opened-thread content;
- temporary native menus, dialogs, popouts, and Quick Switcher.

Hide all persistent Discord chrome, including:
- server rail;
- channel/DM sidebar;
- account, mute, deafen, and voice controls inside that sidebar;
- channel header and persistent top toolbar;
- member/activity sidebars.
- message composer and reply/edit/upload UI.

Sending messages, uploads, voice, account, settings, and server-management controls may require turning Focus mode off. This is intentional.

## Non-negotiables
- Run only on `https://discord.com/channels/*`.
- Never call Discord APIs, inspect WebSockets, access tokens/cookies/Discord storage, automate actions, scrape content, or inject into Discord's JavaScript runtime.
- Never read, log, store, or transmit messages, names, channel/server titles, account identifiers, channel IDs, or URLs.
- Keep the extension local-only: no telemetry, remote code, CDN assets, external services, or extension-originated network requests.
- Declare only permissions required by the product spec.
- Fail open on unsupported or uncertain layouts.
- Never hide an ancestor/descendant of the protected conversation, modal layer, Quick Switcher, thread content, or popout layer.
- Turning Focus mode off must restore normal Discord without reload.
- Do not refactor unrelated code or add unrequested features.

## DOM and CSS guardrails
- Keep all Discord selectors and detection logic in one module.
- Use explicit allowlisted semantic/structural selectors and isolated class-prefix fallbacks.
- Do not use screen position, width, or generic right-edge heuristics to classify panels.
- Mark exact regions with extension-owned `data-*` attributes.
- Use static extension CSS only. Never remove/reparent Discord nodes or write inline styles.
- Use one debounced child-list `MutationObserver`; do not poll.
- A selector failure may leave clutter visible, but must never blank or block the conversation.

## Architecture defaults

```text
popup
  → storage adapter
  → content script
  → layout detector
  → extension-owned attributes
  → static focus CSS
```

Defaults:
- Manifest V3;
- Firefox canonical build;
- vanilla JavaScript/CSS/HTML;
- no runtime dependencies;
- no background script/service worker;
- `dist/firefox/` and `dist/chrome/` outputs.

Do not introduce a backend, database, Discord SDK, native app, framework, or remote service.

## Firefox and Chrome
- Make Firefox pass first without weakening it for Chrome.
- Preserve the exact Gecko ID, minimum version, and data-collection declaration in the spec.
- Run `web-ext lint` on the built Firefox extension.
- Chrome output must omit Firefox-only manifest keys.
- Temporary Firefox loading is development only; persistent standard-Firefox use requires Mozilla signing.
- Never commit or print signing credentials.

## WSL2 guardrails
- Keep source in the WSL Linux filesystem.
- Do not assume WSL can launch or control Windows browsers.
- Keep automated checks runnable inside WSL2.
- Export browser-ready builds using the product-spec workflow.
- Accept a Windows or WSL path in `WINDOWS_DIST_DIR`.
- Validate destinations before replacing output and never hard-code a username.
- Each exported browser folder must directly contain `manifest.json`.
- Do not claim Windows behaviour from Node tests or Linux-browser tests.

## Verification expectations
Automate:
- storage and popup state;
- both manifest builds;
- Firefox `web-ext lint`;
- detector success, partial success, failure, and protected-node rejection;
- SPA rerenders and restoration;
- privacy/static checks;
- production exclusion of `tools/layout-probe.js`;
- WSL build/export behaviour.

Manually verify in Windows Firefox first, then Chrome:
- only messages/thread content remains;
- all persistent Discord chrome is hidden;
- `Ctrl+K` and destination changes work;
- reading, scrolling, reactions, menus, dialogs, and threads work;
- Focus-off restores composing, sending, replies, edits, and uploads;
- Focus-off restores full Discord immediately;
- unsupported pages fail open.

Never present fixtures as proof that the current authenticated Discord DOM works.

## Privacy-safe layout probe
- Keep `tools/layout-probe.js` development-only and out of production bundles.
- It may output only tags, roles, allowlisted class prefixes, allowlisted generic `data-list-id` values, parent relationships, and rounded bounds.
- Never output raw ARIA labels, text, URLs, IDs, or arbitrary attributes.
- Do not request copied Discord HTML/CSS unless a sanitized probe cannot resolve a real selector failure.

## Code quality bar
- Prefer the smallest complete implementation.
- No hacks, broad selectors, swallowed errors, fake success, weakened tests, TODOs, or placeholders.
- Do not copy third-party extension code; implement independently.
- State all browser-specific uncertainty and anything not manually tested.

## Repo and branch guardrails
Before committing or pushing, state and verify:
- `pwd`
- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git status --short`

Do not force-push, amend, or rewrite history unless explicitly asked. Do not commit build output, XPIs, credentials, browser profiles, Discord content, or user-specific paths.

## Required implementation report
1. What changed
2. Why
3. How to verify
4. Files changed or created
5. Automated checks passed
6. Manual checks still required
7. Confidence (`0.0–1.0`) and biggest unknown

## Default workflow
1. Inspect the repo, this file, and `docs/product-spec.md`.
2. Implement the smallest complete change.
3. Verify privacy and fail-open behaviour.
4. Run tests, lint, Firefox lint/build/package, Chrome build, and WSL export where available.
5. Report exact results without claiming unperformed manual checks.

## Git shortcut
When I say `acp`:
1. Verify repository and branch.
2. Separate code/config, tests, and documentation commits where practical.
3. Stage, commit, and push each non-empty group separately.
4. Stop and report any failure.

When I say `acp: <commit message>`, use that as the single commit message, or as the base for clearly prefixed/suffixed grouped commits. Never use `--amend` unless explicitly asked.
