(function attachLayoutDetector(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};

  const ATTR_ACTIVE = "data-discord-focus-active";
  const ATTR_HIDDEN = "data-discord-focus-hidden";
  const ATTR_PROTECTED = "data-discord-focus-protected";
  const ATTR_ROOT = "data-discord-focus-root";

  const MESSAGE_LIST_SELECTORS = [
    '[data-list-id="chat-messages"]',
    '[data-list-id^="chat-messages"]',
    '[role="log"][aria-live]'
  ];

  const COMPOSER_SELECTORS = [
    '[class^="channelTextArea_"]',
    '[class*=" channelTextArea_"]',
    'form [role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][contenteditable="true"]'
  ];

  const TRANSIENT_SELECTORS = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[data-list-id="quick-switcher-results"]',
    '[class^="popout_"]',
    '[class*=" popout_"]',
    '[class^="menu_"]',
    '[class*=" menu_"]',
    '[class^="quickSwitcher_"]',
    '[class*=" quickSwitcher_"]'
  ];

  function uniqueElements(items) {
    return [...new Set(items.filter((item) => item && item.nodeType === 1))];
  }

  function queryAll(documentRef, selectors) {
    return selectors.flatMap((selector) => [...documentRef.querySelectorAll(selector)]);
  }

  function classList(element) {
    if (!element || typeof element.className !== "string") {
      return [];
    }
    return element.className.split(/\s+/).filter(Boolean);
  }

  function hasClassPrefix(element, prefix) {
    return classList(element).some((name) => name.startsWith(prefix));
  }

  function hasAnyClassPrefix(element, prefixes) {
    return prefixes.some((prefix) => hasClassPrefix(element, prefix));
  }

  function findByClassPrefix(documentRef, prefixes) {
    return [...documentRef.querySelectorAll("[class]")].filter((element) => {
      return hasAnyClassPrefix(element, prefixes);
    });
  }

  function closestByClassPrefix(element, prefixes, stopAt) {
    let current = element;
    while (current && current.nodeType === 1 && current !== stopAt) {
      if (hasAnyClassPrefix(current, prefixes)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function closestTag(element, tagName) {
    let current = element;
    const expected = tagName.toUpperCase();
    while (current && current.nodeType === 1) {
      if (current.tagName === expected) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function isRelatedToProtected(candidate, protectedNodes) {
    return protectedNodes.some((node) => {
      return candidate === node || candidate.contains(node) || node.contains(candidate);
    });
  }

  function canHide(candidate, protectedNodes, documentRef) {
    if (!candidate || candidate.nodeType !== 1) {
      return false;
    }

    const rootElement = documentRef.documentElement;
    if (candidate === rootElement || candidate === documentRef.body) {
      return false;
    }

    return !isRelatedToProtected(candidate, protectedNodes);
  }

  function composerContainerFor(anchor) {
    return closestByClassPrefix(anchor, ["channelTextArea_"])
      || closestTag(anchor, "form")
      || anchor;
  }

  function findMessageLists(documentRef) {
    return uniqueElements(queryAll(documentRef, MESSAGE_LIST_SELECTORS));
  }

  function findComposers(documentRef) {
    return uniqueElements(queryAll(documentRef, COMPOSER_SELECTORS).map(composerContainerFor));
  }

  function findTransientProtectedNodes(documentRef) {
    return uniqueElements(queryAll(documentRef, TRANSIENT_SELECTORS));
  }

  function findFirstSafeCandidate(candidates, protectedNodes, documentRef) {
    return candidates.find((candidate) => canHide(candidate, protectedNodes, documentRef)) || null;
  }

  function findServerRailCandidates(documentRef) {
    const guildList = documentRef.querySelector('ul[data-list-id="guildsnav"]');
    if (!guildList) {
      return [];
    }

    return uniqueElements([
      closestByClassPrefix(guildList, ["guilds_"]),
      guildList.parentElement,
      closestTag(guildList, "nav"),
      guildList
    ]);
  }

  function findSidebarContainer(sidebarList) {
    let current = sidebarList;
    let best = sidebarList;
    let depth = 0;

    while (current && current.nodeType === 1 && depth < 6) {
      if (
        hasAnyClassPrefix(current, ["sidebar_", "sidebarList_"])
        || current.tagName === "ASIDE"
        || current.getAttribute("role") === "navigation"
      ) {
        best = current;
      }

      current = current.parentElement;
      depth += 1;
    }

    return best;
  }

  function findChannelSidebars(documentRef) {
    return uniqueElements(
      findByClassPrefix(documentRef, ["sidebarList_"]).map(findSidebarContainer)
    );
  }

  function findConversationRoots(messageLists, composers) {
    const anchors = [...messageLists, ...composers];
    return uniqueElements(anchors.map((anchor) => {
      const chatRoot = closestByClassPrefix(anchor, ["chat_", "threadSidebar_"]);
      if (chatRoot) {
        return chatRoot;
      }

      const contentRoot = closestByClassPrefix(anchor, ["chatContent_"]);
      return contentRoot && contentRoot.parentElement ? contentRoot.parentElement : contentRoot;
    }));
  }

  function findHeaders(roots) {
    return uniqueElements(roots.flatMap((rootNode) => {
      return rootNode ? [...rootNode.querySelectorAll("header")] : [];
    }));
  }

  function findPageHeaders(documentRef) {
    const mount = documentRef.querySelector("#app-mount") || documentRef.body;
    return uniqueElements([...mount.querySelectorAll("header")]);
  }

  function findMemberPanels(documentRef) {
    return uniqueElements(findByClassPrefix(documentRef, [
      "membersWrap_",
      "nowPlayingColumn_",
      "profilePanel_"
    ]));
  }

  function markerValue(reason) {
    return reason.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  function addHideCandidate(map, reason, candidate, protectedNodes, documentRef) {
    if (canHide(candidate, protectedNodes, documentRef)) {
      map.set(candidate, reason);
    }
  }

  function detectLayout(documentRef) {
    const messageLists = findMessageLists(documentRef);
    const composers = findComposers(documentRef);
    const transientNodes = findTransientProtectedNodes(documentRef);
    const protectedNodes = uniqueElements([...messageLists, ...composers, ...transientNodes]);

    if (messageLists.length === 0 || composers.length === 0) {
      return {
        supported: false,
        status: "unsupported",
        rootNodes: [],
        protectedNodes,
        hiddenNodes: [],
        hiddenReasons: []
      };
    }

    const hidden = new Map();
    const roots = findConversationRoots(messageLists, composers);

    addHideCandidate(
      hidden,
      "serverRail",
      findFirstSafeCandidate(findServerRailCandidates(documentRef), protectedNodes, documentRef),
      protectedNodes,
      documentRef
    );

    findChannelSidebars(documentRef).forEach((sidebar) => {
      addHideCandidate(hidden, "channelSidebar", sidebar, protectedNodes, documentRef);
    });

    uniqueElements([...findHeaders(roots), ...findPageHeaders(documentRef)]).forEach((header) => {
      addHideCandidate(hidden, "header", header, protectedNodes, documentRef);
    });

    findMemberPanels(documentRef).forEach((panel) => {
      addHideCandidate(hidden, "memberPanel", panel, protectedNodes, documentRef);
    });

    const hiddenNodes = [...hidden.keys()];
    const hiddenReasons = [...hidden.values()];
    const expectedReasons = ["serverRail", "channelSidebar", "header"];
    const foundRequiredReasons = expectedReasons.filter((reason) => hiddenReasons.includes(reason));
    const status = hiddenNodes.length === 0
      ? "supported-no-hide-targets"
      : foundRequiredReasons.length < expectedReasons.length
        ? "partial"
        : "active";

    return {
      supported: true,
      status,
      rootNodes: roots,
      protectedNodes,
      hiddenNodes,
      hiddenReasons
    };
  }

  function clearFocusMarkers(documentRef) {
    documentRef.documentElement.removeAttribute(ATTR_ACTIVE);
    documentRef.querySelectorAll(`[${ATTR_HIDDEN}], [${ATTR_PROTECTED}], [${ATTR_ROOT}]`).forEach((node) => {
      node.removeAttribute(ATTR_HIDDEN);
      node.removeAttribute(ATTR_PROTECTED);
      node.removeAttribute(ATTR_ROOT);
    });
  }

  function applyFocus(documentRef) {
    clearFocusMarkers(documentRef);

    const result = detectLayout(documentRef);
    if (!result.supported) {
      return result;
    }

    result.protectedNodes.forEach((node) => {
      node.setAttribute(ATTR_PROTECTED, "true");
    });

    result.rootNodes.forEach((node) => {
      node.setAttribute(ATTR_ROOT, "conversation");
    });

    result.hiddenNodes.forEach((node, index) => {
      node.setAttribute(ATTR_HIDDEN, markerValue(result.hiddenReasons[index]));
    });

    documentRef.documentElement.setAttribute(ATTR_ACTIVE, "true");
    return result;
  }

  const exported = {
    ATTR_ACTIVE,
    ATTR_HIDDEN,
    ATTR_PROTECTED,
    ATTR_ROOT,
    applyFocus,
    clearFocusMarkers,
    detectLayout,
    hasClassPrefix
  };

  namespace.layoutDetector = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
