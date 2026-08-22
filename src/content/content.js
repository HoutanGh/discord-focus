(function attachContent(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};
  const GET_STATUS_MESSAGE = "discord-focus:get-status";
  const SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE = "discord-focus:set-current-channel-preferences";
  const USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE = "discord-focus:use-default-channel-preferences";

  function visibleStatusLabel(state) {
    if (!state.focusEnabled) {
      return "off";
    }
    return state.active ? state.status : "unsupported";
  }

  function createFocusController({
    document: documentRef,
    window: windowRef,
    api = namespace.api,
    storage = namespace.storage,
    detector = namespace.layoutDetector,
    channelContext = namespace.channelContext,
    crypto = windowRef.crypto,
    debounceMs = 80
  }) {
    let settings = storage.normalizeSettings(null);
    let observer = null;
    let debounceTimer = null;
    let started = false;
    let applyGeneration = 0;
    let state = {
      focusEnabled: true,
      hideNavigation: true,
      hideMessageBox: true,
      channelSettingsAvailable: false,
      channelOverrideActive: false,
      channelSettingsReason: "initializing",
      active: false,
      status: "initializing",
      hiddenCount: 0,
      protectedCount: 0
    };

    function setState(nextState) {
      state = {
        ...state,
        ...nextState
      };
      return getStatus();
    }

    function getStatus() {
      return {
        focusEnabled: state.focusEnabled,
        hideNavigation: state.hideNavigation,
        hideMessageBox: state.hideMessageBox,
        channelSettingsAvailable: state.channelSettingsAvailable,
        channelOverrideActive: state.channelOverrideActive,
        channelSettingsReason: state.channelSettingsReason,
        active: state.active,
        status: state.status,
        statusLabel: visibleStatusLabel(state),
        hiddenCount: state.hiddenCount,
        protectedCount: state.protectedCount
      };
    }

    function defaultChannelState(reason) {
      return {
        key: null,
        available: false,
        reason,
        ...storage.effectivePreferences(settings)
      };
    }

    async function resolveChannelState(createKeyMaterial = false) {
      const pathname = windowRef.location.pathname;
      if (!channelContext.isSupportedServerChannelPath(pathname)) {
        return defaultChannelState("unsupported-route");
      }
      if (api.extension && api.extension.inIncognitoContext) {
        return defaultChannelState("private");
      }

      try {
        let installationSalt = await storage.readChannelKeySalt(api);
        if (!installationSalt && !createKeyMaterial) {
          return channelContext.canDeriveOpaqueChannelKey(crypto)
            ? {
                key: null,
                available: true,
                reason: "available",
                ...storage.effectivePreferences(settings)
              }
            : defaultChannelState("unavailable");
        }
        if (!installationSalt) {
          installationSalt = await storage.ensureChannelKeySalt(() => {
            return channelContext.createInstallationSalt(crypto);
          }, api);
        }
        const key = await channelContext.deriveOpaqueChannelKey(
          pathname,
          installationSalt,
          crypto
        );

        if (!key) {
          return defaultChannelState("unsupported-route");
        }

        return {
          key,
          available: true,
          reason: "available",
          ...storage.effectivePreferences(settings, key)
        };
      } catch {
        return defaultChannelState("unavailable");
      }
    }

    function failOpen() {
      const preferences = storage.effectivePreferences(settings);
      detector.clearFocusMarkers(documentRef);
      return setState({
        focusEnabled: settings.focusEnabled,
        hideNavigation: preferences.hideNavigation,
        hideMessageBox: preferences.hideMessageBox,
        channelSettingsAvailable: false,
        channelOverrideActive: false,
        channelSettingsReason: "unavailable",
        active: false,
        status: "error",
        hiddenCount: 0,
        protectedCount: 0
      });
    }

    async function applyCurrentState() {
      if (debounceTimer !== null) {
        windowRef.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      const generation = ++applyGeneration;
      const channelState = await resolveChannelState();
      if (generation !== applyGeneration) {
        return getStatus();
      }

      const effectiveSettings = {
        focusEnabled: settings.focusEnabled,
        hideNavigation: channelState.hideNavigation,
        hideMessageBox: channelState.hideMessageBox,
        channelSettingsAvailable: channelState.available,
        channelOverrideActive: channelState.channelOverrideActive,
        channelSettingsReason: channelState.reason
      };

      if (!settings.focusEnabled) {
        detector.clearFocusMarkers(documentRef);
        return setState({
          ...effectiveSettings,
          active: false,
          status: "off",
          hiddenCount: 0,
          protectedCount: 0
        });
      }

      const result = detector.applyFocus(documentRef, {
        hideNavigation: channelState.hideNavigation,
        hideComposer: channelState.hideMessageBox
      });
      return setState({
        ...effectiveSettings,
        active: result.supported && result.hiddenNodes.length > 0,
        status: result.status,
        hiddenCount: result.hiddenNodes.length,
        protectedCount: result.protectedNodes.length
      });
    }

    function scheduleApply(delay = debounceMs) {
      applyGeneration += 1;
      if (debounceTimer !== null) {
        windowRef.clearTimeout(debounceTimer);
      }

      debounceTimer = windowRef.setTimeout(() => {
        debounceTimer = null;
        applyCurrentState().catch(failOpen);
      }, delay);
    }

    function observeDocument() {
      const mount = documentRef.querySelector("#app-mount") || documentRef.body;
      observer = new windowRef.MutationObserver(() => {
        scheduleApply();
      });
      observer.observe(mount, {
        childList: true,
        subtree: true
      });
    }

    async function writeCurrentChannelPreferences(message) {
      if (
        typeof message.hideNavigation !== "boolean"
        || typeof message.hideMessageBox !== "boolean"
      ) {
        throw new Error("Invalid channel preferences.");
      }

      const channelState = await resolveChannelState(true);
      if (!channelState.available || !channelState.key) {
        throw new Error("Per-channel settings are unavailable on this page.");
      }

      settings = storage.withChannelOverride(settings, channelState.key, {
        hideNavigation: message.hideNavigation,
        hideMessageBox: message.hideMessageBox
      });
      await storage.writeSettings(settings, api);
      return applyCurrentState();
    }

    async function useDefaultChannelPreferences() {
      const channelState = await resolveChannelState();
      if (!channelState.available) {
        throw new Error("Per-channel settings are unavailable on this page.");
      }
      if (!channelState.key) {
        return applyCurrentState();
      }

      settings = storage.withoutChannelOverride(settings, channelState.key);
      await storage.writeSettings(settings, api);
      return applyCurrentState();
    }

    async function start() {
      if (started) {
        return getStatus();
      }

      settings = await storage.readSettings(api);
      await applyCurrentState();
      observeDocument();

      api.storage.onChanged.addListener((changes, areaName) => {
        const nextSettings = storage.settingsFromChange(changes, areaName);
        const saltChanged = storage.channelKeySaltChanged(changes, areaName);
        if (!nextSettings && !saltChanged) {
          return;
        }
        const settingsChanged = nextSettings && !storage.settingsEqual(nextSettings, settings);
        if (nextSettings) {
          settings = nextSettings;
        }
        if (settingsChanged || saltChanged) {
          scheduleApply(0);
        }
      });

      api.runtime.onMessage.addListener((message) => {
        if (!message) {
          return undefined;
        }
        if (message.type === GET_STATUS_MESSAGE) {
          return applyCurrentState();
        }
        if (message.type === SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE) {
          return writeCurrentChannelPreferences(message);
        }
        if (message.type === USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE) {
          return useDefaultChannelPreferences();
        }
        return undefined;
      });

      started = true;
      return getStatus();
    }

    function stop() {
      applyGeneration += 1;
      if (observer) {
        observer.disconnect();
      }
      if (debounceTimer !== null) {
        windowRef.clearTimeout(debounceTimer);
      }
      detector.clearFocusMarkers(documentRef);
      started = false;
      return setState({
        active: false,
        status: "stopped",
        hiddenCount: 0,
        protectedCount: 0
      });
    }

    return {
      applyCurrentState,
      getStatus,
      scheduleApply,
      start,
      stop
    };
  }

  function autoStart() {
    if (
      !namespace.api
      || !namespace.storage
      || !namespace.channelContext
      || !namespace.layoutDetector
      || typeof document === "undefined"
    ) {
      return null;
    }

    const controller = createFocusController({
      document,
      window,
      api: namespace.api,
      storage: namespace.storage,
      channelContext: namespace.channelContext,
      detector: namespace.layoutDetector
    });

    namespace.controller = controller;
    controller.start().catch(() => {
      namespace.layoutDetector.clearFocusMarkers(document);
    });

    return controller;
  }

  const exported = {
    GET_STATUS_MESSAGE,
    SET_CURRENT_CHANNEL_PREFERENCES_MESSAGE,
    USE_DEFAULT_CHANNEL_PREFERENCES_MESSAGE,
    createFocusController
  };

  namespace.content = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }

  autoStart();
})(typeof globalThis !== "undefined" ? globalThis : self);
