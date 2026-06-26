(function attachStorage(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};

  const SETTINGS_KEY = "discordFocusSettings";
  const DEFAULT_SETTINGS = Object.freeze({
    version: 1,
    focusEnabled: true
  });

  function normalizeSettings(value) {
    if (!value || typeof value !== "object") {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      version: 1,
      focusEnabled: typeof value.focusEnabled === "boolean"
        ? value.focusEnabled
        : DEFAULT_SETTINGS.focusEnabled
    };
  }

  async function readSettings(api = namespace.api) {
    const result = await api.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(result ? result[SETTINGS_KEY] : null);
  }

  async function writeSettings(settings, api = namespace.api) {
    const normalized = normalizeSettings(settings);
    await api.storage.local.set({
      [SETTINGS_KEY]: normalized
    });
    return normalized;
  }

  async function writeFocusEnabled(focusEnabled, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings({
      ...current,
      focusEnabled: Boolean(focusEnabled)
    }, api);
  }

  function settingsFromChange(changes, areaName) {
    if (areaName !== "local" || !changes || !changes[SETTINGS_KEY]) {
      return null;
    }

    return normalizeSettings(changes[SETTINGS_KEY].newValue);
  }

  const exported = {
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
    normalizeSettings,
    readSettings,
    settingsFromChange,
    writeFocusEnabled,
    writeSettings
  };

  namespace.storage = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
