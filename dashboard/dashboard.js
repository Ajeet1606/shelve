/**
 * Shelve — Dashboard Script
 *
 * Full-page tab management UI.
 * Reads from chrome.storage.local, listens for changes, renders groups/tabs.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ========== State ========== */

let groups = [];
let sessions = [];
let settings = { theme: "system" };
let activeView = "tabs";
let searchQuery = "";

/* ========== Elements ========== */

const sidebarTabCount = $("#sidebarTabCount");
const searchInput = $("#searchInput");
const emptyState = $("#emptyState");
const searchResults = $("#searchResults");
const searchResultsList = $("#searchResultsList");
const searchResultsTitle = $("#searchResultsTitle");
const clearSearchBtn = $("#clearSearch");
const groupsContainer = $("#groupsContainer");
const sessionsList = $("#sessionsList");
const toastEl = $("#toast");

/* ========== Init ========== */

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  render();
  setupEventListeners();
  setupStorageListener();
});

/* ========== Data loading ========== */

async function loadData() {
  groups = await ShelveStorage.getGroups();
  sessions = await ShelveStorage.getSessions();
  const data = await chrome.storage.local.get(["settings"]);
  settings = data.settings ?? { theme: "system" };
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local") return;
    if (changes.groups) {
      groups = changes.groups.newValue ?? [];
    }
    if (changes.sessions) {
      sessions = changes.sessions.newValue ?? [];
    }
    if (changes.settings) {
      settings = changes.settings.newValue ?? { theme: "system" };
      applyTheme();
    }
    render();
  });
}

/* ========== Rendering ========== */

function render() {
  const totalTabs = groups.reduce((sum, g) => sum + g.tabs.length, 0);
  sidebarTabCount.textContent = totalTabs;

  // Show/hide topbar elements based on active view
  const shelveAllBtn = $("#shelveAllBtn");
  const searchWrapper = $(".search-wrapper");
  if (activeView === "tabs") {
    shelveAllBtn.hidden = false;
    searchWrapper.hidden = false;
  } else {
    shelveAllBtn.hidden = true;
    searchWrapper.hidden = true;
  }

  if (activeView === "tabs") {
    renderTabsView();
  } else if (activeView === "sessions") {
    renderSessionsView();
  } else if (activeView === "settings") {
    renderSettingsView();
  }
}

function renderTabsView() {
  const totalTabs = groups.reduce((sum, g) => sum + g.tabs.length, 0);

  // Handle search
  if (searchQuery) {
    const results = ShelveStorage.searchTabs(groups, searchQuery);
    groupsContainer.hidden = true;
    emptyState.hidden = true;
    searchResults.hidden = false;
    searchResultsTitle.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${searchQuery}"`;
    searchResultsList.innerHTML = results
      .map((tab) =>
        renderTabRowHTML(tab, tab.groupId, {
          showGroup: true,
          groupName: tab.groupName,
        }),
      )
      .join("");
    return;
  }

  searchResults.hidden = true;

  if (totalTabs === 0) {
    emptyState.hidden = false;
    groupsContainer.hidden = true;
    groupsContainer.innerHTML = "";
    return;
  }

  emptyState.hidden = true;
  groupsContainer.hidden = false;

  // Sort groups: most recently added tabs first
  const sorted = [...groups].sort((a, b) => {
    const aLatest = a.tabs.length
      ? Math.max(...a.tabs.map((t) => t.savedAt))
      : a.createdAt;
    const bLatest = b.tabs.length
      ? Math.max(...b.tabs.map((t) => t.savedAt))
      : b.createdAt;
    return bLatest - aLatest;
  });

  groupsContainer.innerHTML = sorted
    .map((group) => renderGroupHTML(group))
    .join("");
}

function renderGroupHTML(group) {
  const tabsHTML = group.tabs
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((tab) => renderTabRowHTML(tab, group.id))
    .join("");

  return `
    <div class="group-card" data-group-id="${group.id}">
      <div class="group-header" data-action="toggle-group" data-group-id="${group.id}">
        <span class="group-color" style="background: ${escapeHtml(group.color)}"></span>
        <span class="group-name">${escapeHtml(group.name)}</span>
        <span class="group-count">${group.tabs.length} tab${group.tabs.length === 1 ? "" : "s"}</span>
        <div class="group-actions">
          <button class="group-action-btn" data-action="restore-group" data-group-id="${group.id}" title="Restore all tabs">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2v5h5M14 14V9H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 6.5A6 6 0 004 3L2 5m10 6l2 2A6 6 0 015 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="group-action-btn delete" data-action="delete-group" data-group-id="${group.id}" title="Delete group">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <svg class="group-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="group-tabs">
        ${tabsHTML}
      </div>
    </div>`;
}

function renderTabRowHTML(tab, groupId, opts = {}) {
  const favicon = tab.favIconUrl
    ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="tab-favicon-placeholder" style="display:none">●</span>`
    : `<span class="tab-favicon-placeholder">●</span>`;

  const groupBadge = opts.showGroup
    ? `<span class="tab-group-badge">${escapeHtml(opts.groupName || "")}</span>`
    : "";

  const shortUrl = truncateUrl(tab.url, 60);

  return `
    <div class="tab-row" data-tab-id="${tab.id}" data-group-id="${groupId}">
      ${favicon}
      <div class="tab-info">
        <a class="tab-title" href="${escapeHtml(tab.url)}" data-action="restore-tab" data-tab-id="${tab.id}" data-group-id="${groupId}" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</a>
        <div class="tab-url">${escapeHtml(shortUrl)} ${groupBadge}</div>
      </div>
      <span class="tab-time">${timeAgo(tab.savedAt)}</span>
      <div class="tab-actions">
        <button class="tab-action-btn" data-action="restore-tab" data-tab-id="${tab.id}" data-group-id="${groupId}" title="Open tab">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="tab-action-btn delete" data-action="delete-tab" data-tab-id="${tab.id}" data-group-id="${groupId}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>`;
}

function renderSessionsView() {
  if (sessions.length === 0) {
    sessionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🕐</div>
        <h2>No sessions yet</h2>
        <p>Sessions are recorded each time you shelve tabs.</p>
      </div>`;
    return;
  }

  sessionsList.innerHTML = sessions
    .map(
      (session) => `
    <div class="session-card">
      <span class="session-dot"></span>
      <div class="session-info">
        <div class="session-date">${formatDate(session.savedAt)}</div>
        <div class="session-count">${session.tabCount} tab${session.tabCount === 1 ? "" : "s"} shelved</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function renderSettingsView() {
  const themeSelect = $("#themeSelect");
  if (themeSelect) themeSelect.value = settings.theme;
}

/* ========== Event listeners ========== */

function setupEventListeners() {
  // Navigation
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchToView(btn.dataset.view);
    });
  });

  // Search
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      // Auto-switch to tabs view if on a different view
      if (searchQuery && activeView !== "tabs") {
        switchToView("tabs");
      }
      renderTabsView();
    }, 200);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    renderTabsView();
    searchInput.focus();
  });

  // Keyboard shortcut: / to focus search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.blur();
      if (searchQuery) {
        searchInput.value = "";
        searchQuery = "";
        renderTabsView();
      }
    }
  });

  // Shelve all tabs button in topbar
  $("#shelveAllBtn").addEventListener("click", async () => {
    const result = await chrome.runtime.sendMessage({ type: "SAVE_ALL_TABS" });
    if (result) {
      let msg = `Shelved ${result.saved} tab${result.saved === 1 ? "" : "s"}`;
      if (result.duplicates > 0) msg += ` (${result.duplicates} skipped)`;
      showToast(msg);
    }
  });

  // Delegated clicks on groups/tabs
  document.addEventListener("click", handleDelegatedClick);

  // Export
  $("#exportBtn").addEventListener("click", handleExport);
  $("#settingsExportBtn")?.addEventListener("click", handleExport);

  // Import
  const importFile = $("#importFile");
  $("#importBtn").addEventListener("click", () => importFile.click());
  $("#settingsImportBtn")?.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", handleImport);

  // Theme
  $("#themeSelect")?.addEventListener("change", async (e) => {
    settings.theme = e.target.value;
    await chrome.storage.local.set({ settings });
    applyTheme();
  });

  // Clear all
  $("#clearAllBtn")?.addEventListener("click", async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL shelved tabs? This cannot be undone.",
      )
    )
      return;
    await chrome.storage.local.set({ groups: [], sessions: [] });
    showToast("All data deleted");
  });
}

async function handleDelegatedClick(e) {
  const target = e.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const groupId = target.dataset.groupId;
  const tabId = target.dataset.tabId;

  switch (action) {
    case "toggle-group": {
      const card = target.closest(".group-card");
      card.classList.toggle("collapsed");
      break;
    }

    case "restore-tab": {
      e.preventDefault();
      const tab = findTab(groupId, tabId);
      if (tab) {
        await chrome.runtime.sendMessage({
          type: "RESTORE_TAB",
          url: tab.url,
          groupId,
          tabId,
          removeAfterRestore: true,
        });
        showToast("Tab restored");
      }
      break;
    }

    case "delete-tab": {
      await ShelveStorage.removeTab(groupId, tabId);
      showToast("Tab deleted");
      // Storage listener will re-render
      break;
    }

    case "restore-group": {
      e.stopPropagation();
      await chrome.runtime.sendMessage({
        type: "RESTORE_GROUP",
        groupId,
        removeAfterRestore: true,
      });
      showToast("Group restored");
      break;
    }

    case "delete-group": {
      e.stopPropagation();
      const group = groups.find((g) => g.id === groupId);
      if (
        group &&
        confirm(`Delete "${group.name}" and its ${group.tabs.length} tab(s)?`)
      ) {
        await ShelveStorage.deleteGroup(groupId);
        showToast("Group deleted");
      }
      break;
    }
  }
}

/* ========== Export / Import ========== */

async function handleExport() {
  const json = await ShelveStorage.exportData();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shelve-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Data exported");
}

async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    await ShelveStorage.importData(text, "merge");
    showToast("Data imported successfully");
  } catch (err) {
    showToast("Import failed: " + err.message);
  }

  // Reset input
  e.target.value = "";
}

/* ========== Theme ========== */

function applyTheme() {
  // The CSS uses prefers-color-scheme by default.
  // For explicit theme overrides, we'd add a class to <html>.
  // For simplicity in V1, we rely on system preference + CSS media query.
  // User selects "light" or "dark" → set a data attribute.
  document.documentElement.removeAttribute("data-theme");
  if (settings.theme === "light" || settings.theme === "dark") {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }
}

/* ========== Helpers ========== */

function findTab(groupId, tabId) {
  const group = groups.find((g) => g.id === groupId);
  return group?.tabs.find((t) => t.id === tabId) ?? null;
}

function showToast(message, duration = 2500) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, duration);
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateUrl(url, maxLen) {
  try {
    const u = new URL(url);
    let display = u.hostname + u.pathname;
    if (display.length > maxLen) display = display.slice(0, maxLen) + "…";
    return display;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + "…" : url;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function switchToView(viewName) {
  $$(".nav-item").forEach((b) => b.classList.remove("active"));
  const navBtn = $(`.nav-item[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add("active");
  activeView = viewName;
  $$(".view").forEach((v) => {
    v.classList.remove("active");
    v.hidden = true;
  });
  const target = $(`#view${capitalize(activeView)}`);
  target.classList.add("active");
  target.hidden = false;
  render();
}
