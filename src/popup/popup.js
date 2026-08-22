(function attachPopup(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};
  const GET_STATUS_MESSAGE = "discord-focus:get-status";
  const SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE = "discord-focus:set-current-channel-preferences";
  const USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE = "discord-focus:use-default-channel-preferences";

  function statusText(pageStatus, settings) {
    if (!settings.focusEnabled) {
      return "Focus mode is off.";
    }

    if (!pageStatus || pageStatus.unavailable) {
      return "Open a Discord channel tab to see page status.";
    }

    if (pageStatus.active) {
      return pageStatus.status === "partial"
        ? "Focus mode is active with partial cleanup."
        : "Focus mode is active.";
    }

    if (pageStatus.status === "supported-no-hide-targets") {
      return "Discord is supported, but no Discord panels were detected.";
    }

    return "No supported Discord conversation detected.";
  }

  function channelScopeText(pageStatus) {
    if (pageStatus.channelSettingsReason === "private") {
      return "Channel settings are not saved in private browsing.";
    }
    if (!pageStatus.channelSettingsAvailable) {
      return "Channel settings are available in server channels.";
    }
    return pageStatus.channelOverrideActive
      ? "Using saved settings for this channel."
      : "Using defaults for this channel.";
  }

  function defaultsScopeText(settings) {
    const count = Object.keys(settings.channelOverrides).length;
    if (count === 0) {
      return "No saved channel settings.";
    }
    return `${count} saved channel ${count === 1 ? "setting" : "settings"}.`;
  }

  async function sendPageMessage(api, message) {
    const tabs = await api.tabs.query({
      active: true,
      currentWindow: true
    });
    const activeTab = tabs.find((tab) => Number.isInteger(tab.id));

    if (!activeTab) {
      throw new Error("No active browser tab is available.");
    }

    const response = await api.tabs.sendMessage(activeTab.id, message);
    if (!response || response.ok === false) {
      throw new Error("The Discord tab could not update channel settings.");
    }
    return response;
  }

  async function readPageStatus(api) {
    try {
      return await sendPageMessage(api, {
        type: GET_STATUS_MESSAGE
      });
    } catch {
      return { unavailable: true };
    }
  }

  async function initPopup({
    document: documentRef,
    api = namespace.api,
    storage = namespace.storage
  }) {
    const focusToggle = documentRef.querySelector("#focus-toggle");
    const navigationToggle = documentRef.querySelector("#navigation-toggle");
    const messageBoxToggle = documentRef.querySelector("#message-box-toggle");
    const channelScope = documentRef.querySelector("#channel-scope");
    const defaultsScope = documentRef.querySelector("#defaults-scope");
    const useDefaults = documentRef.querySelector("#use-defaults");
    const clearChannelSettings = documentRef.querySelector("#clear-channel-settings");
    const scopeStatus = documentRef.querySelector("#scope-status");
    const status = documentRef.querySelector("#status");
    let selectedScope = "channel";
    let initialized = false;

    function selectScope(scope, channelAvailable) {
      selectedScope = scope === "channel" && channelAvailable ? "channel" : "defaults";
      channelScope.setAttribute("aria-selected", String(selectedScope === "channel"));
      defaultsScope.setAttribute("aria-selected", String(selectedScope === "defaults"));
      channelScope.tabIndex = selectedScope === "channel" ? 0 : -1;
      defaultsScope.tabIndex = selectedScope === "defaults" ? 0 : -1;
    }

    async function render() {
      const settings = await storage.readSettings(api);
      const pageStatus = await readPageStatus(api);
      const channelAvailable = Boolean(pageStatus.channelSettingsAvailable);

      if (!initialized) {
        selectedScope = channelAvailable ? "channel" : "defaults";
      }
      selectScope(selectedScope, channelAvailable);

      focusToggle.checked = settings.focusEnabled;
      channelScope.disabled = !channelAvailable;

      const preferences = selectedScope === "channel"
        ? pageStatus
        : settings.defaults;
      navigationToggle.checked = preferences.hideNavigation;
      messageBoxToggle.checked = preferences.hideMessageBox;

      useDefaults.hidden = selectedScope !== "channel";
      useDefaults.disabled = !pageStatus.channelOverrideActive;
      clearChannelSettings.hidden = selectedScope !== "defaults";
      clearChannelSettings.disabled = Object.keys(settings.channelOverrides).length === 0;

      scopeStatus.textContent = selectedScope === "channel"
        ? channelScopeText(pageStatus)
        : !pageStatus.unavailable && pageStatus.channelSettingsReason !== "available"
          ? channelScopeText(pageStatus)
          : defaultsScopeText(settings);
      status.textContent = statusText(pageStatus, settings);
      initialized = true;
    }

    async function update(action) {
      try {
        await action();
        await render();
      } catch {
        status.textContent = "Could not update Discord Focus settings.";
      }
    }

    focusToggle.addEventListener("change", () => {
      update(() => storage.writeFocusEnabled(focusToggle.checked, api));
    });

    channelScope.addEventListener("click", () => {
      selectedScope = "channel";
      render();
    });

    defaultsScope.addEventListener("click", () => {
      selectedScope = "defaults";
      render();
    });

    navigationToggle.addEventListener("change", () => {
      if (selectedScope === "channel") {
        update(() => sendPageMessage(api, {
          type: SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
          hideNavigation: navigationToggle.checked,
          hideMessageBox: messageBoxToggle.checked
        }));
        return;
      }

      update(() => storage.writeDefaultPreferences({
        hideNavigation: navigationToggle.checked,
        hideMessageBox: messageBoxToggle.checked
      }, api));
    });

    messageBoxToggle.addEventListener("change", () => {
      if (selectedScope === "channel") {
        update(() => sendPageMessage(api, {
          type: SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
          hideNavigation: navigationToggle.checked,
          hideMessageBox: messageBoxToggle.checked
        }));
        return;
      }

      update(() => storage.writeDefaultPreferences({
        hideNavigation: navigationToggle.checked,
        hideMessageBox: messageBoxToggle.checked
      }, api));
    });

    useDefaults.addEventListener("click", () => {
      update(() => sendPageMessage(api, {
        type: USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE
      }));
    });

    clearChannelSettings.addEventListener("click", () => {
      update(() => storage.clearChannelOverrides(api));
    });

    await render();
  }

  const exported = {
    GET_STATUS_MESSAGE,
    SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
    USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE,
    channelScopeText,
    defaultsScopeText,
    initPopup,
    readPageStatus,
    sendPageMessage,
    statusText
  };

  namespace.popup = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }

  if (typeof document !== "undefined" && namespace.api && namespace.storage) {
    initPopup({
      document,
      api: namespace.api,
      storage: namespace.storage
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
