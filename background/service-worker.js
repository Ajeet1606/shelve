/**
 * Shelve — Background Service Worker (MV3)
 *
 * Responsibilities:
 * - Context menu creation & handling
 * - Keyboard shortcut handling
 * - Tab save/close orchestration
 * - Badge text updates
 * - Message handling from popup / dashboard
 */

importScripts(
  "../utils/constants.js",
  "../utils/storage.js",
  "../utils/grouping.js",
);

const { MSG, CTX, BLOCKED_URLS } = SHELVE_CONSTANTS;

/* ========== Install / Startup ========== */

chrome.runtime.onInstalled.addListener(() => {
  // Create context menus
  chrome.contextMenus.create({
    id: CTX.SAVE_TAB,
    title: "Shelve this tab",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: CTX.SAVE_ALL,
    title: "Shelve all tabs in this window",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: CTX.SAVE_LINK,
    title: "Shelve this link",
    contexts: ["link"],
  });

  // Initialize storage if first install
  chrome.storage.local.get(["groups", "settings"], (data) => {
    if (!data.groups) {
      chrome.storage.local.set({
        groups: [],
        sessions: [],
        settings: { theme: "system" },
      });
    }
  });

  updateBadge();
});

// Also update badge on browser startup
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

/* ========== Context Menu Handler ========== */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CTX.SAVE_TAB) {
    await saveAndCloseTabs([tab]);
  } else if (info.menuItemId === CTX.SAVE_ALL) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    await saveAndCloseTabs(tabs);
  } else if (info.menuItemId === CTX.SAVE_LINK && info.linkUrl) {
    // Save the link URL (don't close any tab)
    await ShelveStorage.saveTabs(
      [{ url: info.linkUrl, title: info.linkUrl, favIconUrl: "" }],
      { groupResolver: ShelveGrouping.resolveGroup },
    );
    updateBadge();
  }
});

/* ========== Keyboard Shortcuts ========== */

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-all-tabs") {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    await saveAndCloseTabs(tabs);
  } else if (command === "save-current-tab") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) await saveAndCloseTabs([tab]);
  }
});

/* ========== Message Handler (popup / dashboard → service worker) ========== */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case MSG.SAVE_ALL_TABS: {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return await saveAndCloseTabs(tabs);
    }

    case MSG.SAVE_CURRENT_TAB: {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) return await saveAndCloseTabs([tab]);
      return { saved: 0, duplicates: 0 };
    }

    case MSG.GET_STATS: {
      const count = await ShelveStorage.getTotalTabCount();
      const sessions = await ShelveStorage.getSessions();
      return { totalTabs: count, lastSession: sessions[0] ?? null };
    }

    case MSG.RESTORE_TAB: {
      if (message.url) {
        await chrome.tabs.create({ url: message.url });
      }
      // Optionally remove the tab from storage after restoring
      if (message.removeAfterRestore && message.groupId && message.tabId) {
        await ShelveStorage.removeTab(message.groupId, message.tabId);
        updateBadge();
      }
      return { ok: true };
    }

    case MSG.RESTORE_GROUP: {
      const group = await ShelveStorage.getGroupById(message.groupId);
      if (group) {
        for (const tab of group.tabs) {
          await chrome.tabs.create({ url: tab.url });
        }
        if (message.removeAfterRestore) {
          await ShelveStorage.deleteGroup(message.groupId);
          updateBadge();
        }
      }
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

/* ========== Core: Save & Close ========== */

async function saveAndCloseTabs(tabs) {
  // Filter out blocked URLs and pinned tabs
  const saveable = tabs.filter((tab) => {
    if (tab.pinned) return false;
    if (!tab.url) return false;
    return !BLOCKED_URLS.some((prefix) => tab.url.startsWith(prefix));
  });

  if (saveable.length === 0) return { saved: 0, duplicates: 0 };

  const entries = saveable.map((t) => ({
    url: t.url,
    title: t.title || t.url,
    favIconUrl: t.favIconUrl || "",
  }));

  const result = await ShelveStorage.saveTabs(entries, {
    groupResolver: ShelveGrouping.resolveGroup,
  });

  // Record session
  if (result.saved > 0) {
    const groups = await ShelveStorage.getGroups();
    const groupIds = groups.map((g) => g.id);
    await ShelveStorage.createSession(result.saved, groupIds);
  }

  // Close the saved tabs
  const tabIds = saveable.map((t) => t.id).filter(Boolean);
  if (tabIds.length > 0) {
    // Ensure at least one tab remains in the window
    const allWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const remainingCount = allWindowTabs.length - tabIds.length;
    if (remainingCount <= 0) {
      // Create a new tab before closing everything
      await chrome.tabs.create({ url: "chrome://newtab" });
    }
    await chrome.tabs.remove(tabIds);
  }

  updateBadge();
  return result;
}

/* ========== Badge ========== */

async function updateBadge() {
  const count = await ShelveStorage.getTotalTabCount();
  const text = count > 0 ? String(count) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
}

// Also update badge whenever storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.groups) {
    updateBadge();
  }
});
