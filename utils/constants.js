/**
 * Shared constants used across the extension.
 */

const SHELVE_CONSTANTS = {
  // Messages between popup/dashboard ↔ service worker
  MSG: {
    SAVE_ALL_TABS: "SAVE_ALL_TABS",
    SAVE_CURRENT_TAB: "SAVE_CURRENT_TAB",
    GET_STATS: "GET_STATS",
    RESTORE_TAB: "RESTORE_TAB",
    RESTORE_GROUP: "RESTORE_GROUP",
  },

  // Context menu IDs
  CTX: {
    SAVE_TAB: "shelve-save-tab",
    SAVE_ALL: "shelve-save-all",
    SAVE_LINK: "shelve-save-link",
  },

  // Limits
  MAX_SESSIONS: 50,

  // URLs to never save
  BLOCKED_URLS: [
    "chrome://",
    "chrome-extension://",
    "about:",
    "edge://",
    "brave://",
    "devtools://",
  ],
};

if (typeof globalThis !== "undefined") {
  globalThis.SHELVE_CONSTANTS = SHELVE_CONSTANTS;
}
