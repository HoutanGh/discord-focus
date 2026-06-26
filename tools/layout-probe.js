(function runDiscordFocusLayoutProbe() {
  "use strict";

  const allowedClassPrefixes = [
    "base_",
    "chat_",
    "chatContent_",
    "channelTextArea_",
    "content_",
    "guilds_",
    "layer_",
    "membersWrap_",
    "menu_",
    "nowPlayingColumn_",
    "popout_",
    "profilePanel_",
    "quickSwitcher_",
    "sidebar_",
    "sidebarList_",
    "threadSidebar_",
    "toolbar_"
  ];
  const allowedListIds = ["guildsnav", "chat-messages", "quick-switcher-results"];

  function classPrefixes(element) {
    if (typeof element.className !== "string") {
      return [];
    }

    const classNames = element.className.split(/\s+/).filter(Boolean);
    return allowedClassPrefixes.filter((prefix) => {
      return classNames.some((className) => className.startsWith(prefix));
    });
  }

  function safeListId(element) {
    const value = element.getAttribute("data-list-id");
    if (!value) {
      return null;
    }
    return allowedListIds.find((allowed) => value === allowed || value.startsWith(`${allowed}-`)) || null;
  }

  function roundedRect(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  const rows = [...document.querySelectorAll("[class], [role], [data-list-id]")].map((element) => {
    const parent = element.parentElement;
    return {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || null,
      classPrefixes: classPrefixes(element),
      dataListId: safeListId(element),
      parent: parent ? parent.tagName.toLowerCase() : null,
      parentClassPrefixes: parent ? classPrefixes(parent) : [],
      rect: roundedRect(element)
    };
  }).filter((row) => {
    return row.role || row.classPrefixes.length > 0 || row.dataListId;
  });

  console.table(rows);
  return rows;
})();
