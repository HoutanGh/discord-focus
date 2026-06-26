(function attachPopup(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};
  const GET_STATUS_MESSAGE = "discord-focus:get-status";

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

  async function readPageStatus(api) {
    const tabs = await api.tabs.query({
      active: true,
      currentWindow: true
    });
    const activeTab = tabs.find((tab) => Number.isInteger(tab.id));

    if (!activeTab) {
      return { unavailable: true };
    }

    try {
      return await api.tabs.sendMessage(activeTab.id, {
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
    const toggle = documentRef.querySelector("#focus-toggle");
    const status = documentRef.querySelector("#status");

    async function render() {
      const settings = await storage.readSettings(api);
      toggle.checked = settings.focusEnabled;
      const pageStatus = await readPageStatus(api);
      status.textContent = statusText(pageStatus, settings);
    }

    toggle.addEventListener("change", async () => {
      await storage.writeFocusEnabled(toggle.checked, api);
      await render();
    });

    await render();
  }

  const exported = {
    initPopup,
    readPageStatus,
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
