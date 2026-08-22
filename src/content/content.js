(function attachContent(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};
  const GET_STATUS_MESSAGE = "discord-focus:get-status";

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
    debounceMs = 80
  }) {
    let settings = {
      focusEnabled: true,
      hideNavigation: true,
      hideMessageBox: true
    };
    let observer = null;
    let debounceTimer = null;
    let started = false;
    let state = {
      focusEnabled: true,
      hideNavigation: true,
      hideMessageBox: true,
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
        active: state.active,
        status: state.status,
        statusLabel: visibleStatusLabel(state),
        hiddenCount: state.hiddenCount,
        protectedCount: state.protectedCount
      };
    }

    function applyCurrentState() {
      if (!settings.focusEnabled) {
        detector.clearFocusMarkers(documentRef);
        return setState({
          ...settings,
          active: false,
          status: "off",
          hiddenCount: 0,
          protectedCount: 0
        });
      }

      const result = detector.applyFocus(documentRef, {
        hideNavigation: settings.hideNavigation,
        hideComposer: settings.hideMessageBox
      });
      return setState({
        ...settings,
        active: result.supported && result.hiddenNodes.length > 0,
        status: result.status,
        hiddenCount: result.hiddenNodes.length,
        protectedCount: result.protectedNodes.length
      });
    }

    function scheduleApply(delay = debounceMs) {
      if (debounceTimer !== null) {
        windowRef.clearTimeout(debounceTimer);
      }

      debounceTimer = windowRef.setTimeout(() => {
        debounceTimer = null;
        applyCurrentState();
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

    async function start() {
      if (started) {
        return getStatus();
      }

      settings = await storage.readSettings(api);
      applyCurrentState();
      observeDocument();

      api.storage.onChanged.addListener((changes, areaName) => {
        const nextSettings = storage.settingsFromChange(changes, areaName);
        if (!nextSettings) {
          return;
        }

        settings = nextSettings;
        scheduleApply(0);
      });

      api.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== GET_STATUS_MESSAGE) {
          return undefined;
        }

        return getStatus();
      });

      started = true;
      return getStatus();
    }

    function stop() {
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
    if (!namespace.api || !namespace.storage || !namespace.layoutDetector || typeof document === "undefined") {
      return null;
    }

    const controller = createFocusController({
      document,
      window,
      api: namespace.api,
      storage: namespace.storage,
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
    createFocusController
  };

  namespace.content = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }

  autoStart();
})(typeof globalThis !== "undefined" ? globalThis : self);
