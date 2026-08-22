# Discord Focus

Discord Focus is a local-only, Firefox-first WebExtension for Discord Web. Focus mode starts enabled on `https://discord.com/channels/*` and hides persistent Discord chrome plus the message box while preserving the current text conversation, temporary menus, dialogs, popouts, opened thread content, and Discord's native `Ctrl+K`.

Focus mode is the global master switch. The popup starts with `Hide navigation` and `Hide message box` checked and provides two settings scopes:

- **This channel** changes and remembers both options for the current server channel.
- **Defaults** applies to channels without a saved override, plus DMs and other supported conversations.

**Use defaults** removes the current channel's override. **Clear all channel settings** removes every saved override. Navigation restores the server rail and left channel/DM sidebar, while the message-box option restores composing, replies, edits, and uploads. Turning Focus mode off restores full Discord.

Remembered settings are available only on exact numeric server-channel routes. The extension briefly uses the current route's channel segment to derive an opaque installation-specific key. It never stores, logs, syncs, exposes, or transmits the raw channel ID or URL. Stored channel data consists only of a random local keying salt, opaque keys, and the two preference booleans.

The extension does not use Discord APIs, call external services, add telemetry, inject into Discord's runtime, remove Discord nodes, or store Discord content. Unsupported or uncertain layouts fail open. No additional browser permission is required for per-channel settings.

## Requirements

- Node.js 22
- WSL2 for development
- Firefox on Windows for the reference manual check
- Chrome on Windows for secondary compatibility checks

## Development

```bash
npm install
npm run build
npm run test
npm run lint
npm run lint:firefox
```

Build outputs are written to:

```text
dist/firefox/
dist/chrome/
```

The Firefox build is canonical. The Chrome build is generated from the same source and omits Firefox-only manifest keys.

## WSL2 Export

Export browser-ready folders to Windows:

```bash
npm run export:windows
```

By default, the export goes under Windows Local AppData:

```text
%LOCALAPPDATA%\DiscordFocusBuild\firefox
%LOCALAPPDATA%\DiscordFocusBuild\chrome
```

To choose a destination:

```bash
WINDOWS_DIST_DIR='C:\Users\you\Desktop' npm run export:windows
```

or:

```bash
WINDOWS_DIST_DIR=/mnt/c/Users/you/Desktop npm run export:windows
```

Each exported browser folder directly contains `manifest.json`.

## Firefox Loading

1. Run `npm run export:windows`.
2. Open Firefox on Windows.
3. Go to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on...**.
5. Select the exported Firefox `manifest.json`, usually:

```text
%LOCALAPPDATA%\DiscordFocusBuild\firefox\manifest.json
```

Temporary loading is for development. Persistent use in standard Firefox requires Mozilla signing.

## Chrome Loading

1. Run `npm run export:windows`.
2. Open Chrome on Windows.
3. Go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the exported Chrome folder, usually:

```text
%LOCALAPPDATA%\DiscordFocusBuild\chrome
```

## Packaging Firefox

```bash
npm run package:firefox
```

This builds, tests, lints, runs Firefox extension linting, and creates:

```text
artifacts/discord-focus-firefox.zip
```

Mozilla signing credentials are not automated or stored in this repository.

## Manual Discord Checklist

Run these in Windows Firefox first, then Chrome:

- A normal text channel or DM shows only message or thread content.
- Server rail, channel sidebar, account controls, mute/deafen controls, voice controls, header, toolbar, message box, and member/activity sidebars are hidden.
- `Ctrl+K` opens Discord's native Quick Switcher and destination changes keep Focus mode active.
- Reading, scrolling, reactions, context menus, dialogs, and opened threads still work.
- Turning Focus mode off restores composing, sending, replying, editing, and uploading.
- Turning Focus mode off in the popup restores the full Discord UI without reload.
- Unchecking **Hide navigation** restores the server rail and left channel/DM sidebar while the message box remains hidden.
- Unchecking **Hide message box** restores composing while navigation remains hidden.
- Changing either option under **This channel** creates a saved override without changing **Defaults**.
- Switching to an unconfigured server channel uses **Defaults**.
- Returning to the configured server channel restores both saved options.
- Clicking **Use defaults** removes the current channel override.
- Clicking **Clear all channel settings** removes every saved override.
- A DM uses **Defaults** and does not offer remembered per-channel settings.
- Each combination remains applied after Discord rerenders or opening a thread.
- Friends/Home, forum index pages, voice/stage/call layouts, settings, login, and unknown layouts remain unchanged.

Automated tests use local fixtures only. They are not proof that the current authenticated Discord DOM has been manually verified.
