(function attachStorage(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};

  const SETTINGS_KEY = "discordFocusSettings";
  const CHANNEL_KEY_SALT_KEY = "discordFocusChannelKeySalt";
  const OPAQUE_CHANNEL_KEY_PATTERN = /^dfc_[a-f0-9]{64}$/;
  const INSTALLATION_SALT_PATTERN = /^[a-f0-9]{64}$/;
  const DEFAULT_PREFERENCES = Object.freeze({
    hideNavigation: true,
    hideMessageBox: true
  });
  const DEFAULT_SETTINGS = Object.freeze({
    version: 3,
    focusEnabled: true,
    defaults: DEFAULT_PREFERENCES,
    channelOverrides: Object.freeze({})
  });

  function normalizePreferences(value, fallback = DEFAULT_PREFERENCES) {
    const source = value && typeof value === "object" ? value : {};
    return {
      hideNavigation: typeof source.hideNavigation === "boolean"
        ? source.hideNavigation
        : fallback.hideNavigation,
      hideMessageBox: typeof source.hideMessageBox === "boolean"
        ? source.hideMessageBox
        : fallback.hideMessageBox
    };
  }

  function hasCompletePreferences(value) {
    return Boolean(
      value
      && typeof value === "object"
      && typeof value.hideNavigation === "boolean"
      && typeof value.hideMessageBox === "boolean"
    );
  }

  function isOpaqueChannelKey(value) {
    return typeof value === "string" && OPAQUE_CHANNEL_KEY_PATTERN.test(value);
  }

  function normalizeChannelOverrides(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(Object.entries(value).filter(([key, preferences]) => {
      return isOpaqueChannelKey(key) && hasCompletePreferences(preferences);
    }).map(([key, preferences]) => {
      return [key, normalizePreferences(preferences)];
    }));
  }

  function normalizeSettings(value) {
    if (!value || typeof value !== "object") {
      return {
        version: DEFAULT_SETTINGS.version,
        focusEnabled: DEFAULT_SETTINGS.focusEnabled,
        defaults: { ...DEFAULT_PREFERENCES },
        channelOverrides: {}
      };
    }

    const legacyPreferences = {
      hideNavigation: value.hideNavigation,
      hideMessageBox: value.hideMessageBox
    };
    const defaultSource = value.defaults && typeof value.defaults === "object"
      ? value.defaults
      : legacyPreferences;

    return {
      version: 3,
      focusEnabled: typeof value.focusEnabled === "boolean"
        ? value.focusEnabled
        : DEFAULT_SETTINGS.focusEnabled,
      defaults: normalizePreferences(defaultSource),
      channelOverrides: normalizeChannelOverrides(value.channelOverrides)
    };
  }

  function effectivePreferences(settings, channelKey = null) {
    const normalized = normalizeSettings(settings);
    const override = isOpaqueChannelKey(channelKey)
      ? normalized.channelOverrides[channelKey]
      : null;
    const preferences = override || normalized.defaults;

    return {
      ...preferences,
      channelOverrideActive: Boolean(override)
    };
  }

  function settingsEqual(first, second) {
    return JSON.stringify(normalizeSettings(first)) === JSON.stringify(normalizeSettings(second));
  }

  function withChannelOverride(settings, channelKey, preferences) {
    if (!isOpaqueChannelKey(channelKey)) {
      throw new Error("Channel preferences require an opaque local key.");
    }
    if (!hasCompletePreferences(preferences)) {
      throw new Error("Channel preferences require both supported options.");
    }

    const current = normalizeSettings(settings);
    return normalizeSettings({
      ...current,
      channelOverrides: {
        ...current.channelOverrides,
        [channelKey]: normalizePreferences(preferences)
      }
    });
  }

  function withoutChannelOverride(settings, channelKey) {
    if (!isOpaqueChannelKey(channelKey)) {
      throw new Error("Channel preferences require an opaque local key.");
    }

    const current = normalizeSettings(settings);
    const channelOverrides = { ...current.channelOverrides };
    delete channelOverrides[channelKey];
    return normalizeSettings({
      ...current,
      channelOverrides
    });
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

  async function writeDefaultPreferences(preferences, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings({
      ...current,
      defaults: normalizePreferences(preferences, current.defaults)
    }, api);
  }

  async function writeHideNavigation(hideNavigation, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings({
      ...current,
      defaults: {
        ...current.defaults,
        hideNavigation: Boolean(hideNavigation)
      }
    }, api);
  }

  async function writeHideMessageBox(hideMessageBox, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings({
      ...current,
      defaults: {
        ...current.defaults,
        hideMessageBox: Boolean(hideMessageBox)
      }
    }, api);
  }

  async function writeChannelOverride(channelKey, preferences, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings(withChannelOverride(current, channelKey, preferences), api);
  }

  async function removeChannelOverride(channelKey, api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings(withoutChannelOverride(current, channelKey), api);
  }

  async function clearChannelOverrides(api = namespace.api) {
    const current = await readSettings(api);
    return writeSettings({
      ...current,
      channelOverrides: {}
    }, api);
  }

  async function readChannelKeySalt(api = namespace.api) {
    const result = await api.storage.local.get(CHANNEL_KEY_SALT_KEY);
    const value = result ? result[CHANNEL_KEY_SALT_KEY] : null;
    return typeof value === "string" && INSTALLATION_SALT_PATTERN.test(value)
      ? value
      : null;
  }

  async function ensureChannelKeySalt(createSalt, api = namespace.api) {
    const existing = await readChannelKeySalt(api);
    if (existing) {
      return existing;
    }
    if (typeof createSalt !== "function") {
      throw new Error("Channel key generation is unavailable.");
    }

    const generated = createSalt();
    if (typeof generated !== "string" || !INSTALLATION_SALT_PATTERN.test(generated)) {
      throw new Error("Channel key generation returned invalid material.");
    }

    await api.storage.local.set({
      [CHANNEL_KEY_SALT_KEY]: generated
    });
    return (await readChannelKeySalt(api)) || generated;
  }

  function settingsFromChange(changes, areaName) {
    if (areaName !== "local" || !changes || !changes[SETTINGS_KEY]) {
      return null;
    }

    return normalizeSettings(changes[SETTINGS_KEY].newValue);
  }

  function channelKeySaltChanged(changes, areaName) {
    return areaName === "local" && Boolean(changes && changes[CHANNEL_KEY_SALT_KEY]);
  }

  const exported = {
    CHANNEL_KEY_SALT_KEY,
    DEFAULT_PREFERENCES,
    DEFAULT_SETTINGS,
    OPAQUE_CHANNEL_KEY_PATTERN,
    SETTINGS_KEY,
    channelKeySaltChanged,
    clearChannelOverrides,
    effectivePreferences,
    ensureChannelKeySalt,
    isOpaqueChannelKey,
    normalizeChannelOverrides,
    normalizePreferences,
    normalizeSettings,
    readChannelKeySalt,
    readSettings,
    removeChannelOverride,
    settingsEqual,
    settingsFromChange,
    withChannelOverride,
    withoutChannelOverride,
    writeChannelOverride,
    writeDefaultPreferences,
    writeFocusEnabled,
    writeHideMessageBox,
    writeHideNavigation,
    writeSettings
  };

  namespace.storage = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
