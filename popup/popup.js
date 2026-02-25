/**
 * Shelve — Popup Script
 */

const $ = (sel) => document.querySelector(sel);

/* ---------- Elements ---------- */
const tabCountEl = $("#tabCount");
const shelveAllBtn = $("#shelveAll");
const shelveCurrentBtn = $("#shelveCurrent");
const recentEl = $("#recentActivity");
const openDashboardBtn = $("#openDashboard");
const toastEl = $("#toast");

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", loadStats);

/* ---------- Load stats ---------- */
async function loadStats() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATS" });
  if (response) {
    tabCountEl.textContent = response.totalTabs ?? 0;

    if (response.lastSession) {
      const ago = timeAgo(response.lastSession.savedAt);
      recentEl.querySelector(".recent-text").textContent =
        `Last stowed ${response.lastSession.tabCount} tab${response.lastSession.tabCount === 1 ? "" : "s"} — ${ago}`;
    }
  }
}

/* ---------- Shelve all tabs ---------- */
shelveAllBtn.addEventListener("click", async () => {
  shelveAllBtn.disabled = true;
  shelveAllBtn.textContent = "Summoning…";

  const result = await chrome.runtime.sendMessage({ type: "SAVE_ALL_TABS" });

  if (result) {
    let msg = `Mischief managed! ${result.saved} tab${result.saved === 1 ? "" : "s"} stowed`;
    if (result.duplicates > 0) {
      msg += ` (${result.duplicates} already shelved)`;
    }
    showToast(msg);
    await loadStats();
  }

  shelveAllBtn.disabled = false;
  shelveAllBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" fill="currentColor"/>
    </svg>
    Accio All Tabs`;
});

/* ---------- Shelve current tab ---------- */
shelveCurrentBtn.addEventListener("click", async () => {
  shelveCurrentBtn.disabled = true;

  const result = await chrome.runtime.sendMessage({ type: "SAVE_CURRENT_TAB" });

  if (result) {
    if (result.duplicates > 0) {
      showToast("Already in the library");
    } else if (result.saved > 0) {
      showToast("Mischief managed!");
    } else {
      showToast("Nothing to conjure");
    }
    await loadStats();
  }

  shelveCurrentBtn.disabled = false;
});

/* ---------- Open dashboard ---------- */
openDashboardBtn.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard/dashboard.html"),
  });
  window.close();
});

/* ---------- Toast ---------- */
function showToast(message, duration = 2000) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  // Force reflow
  void toastEl.offsetWidth;
  toastEl.classList.add("show");

  setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, duration);
}

/* ---------- Time ago helper ---------- */
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
