<div align="center">
  <img src="icons/icon128.png" alt="Shelve" width="80" />
  <h1>Shelve</h1>
  <p><strong>Declutter your browser — save, organize, and restore tabs with one click.</strong></p>
  <p>
    <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" />
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-10B981" />
    <img alt="Zero Dependencies" src="https://img.shields.io/badge/Dependencies-Zero-6366F1" />
    <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow" />
  </p>
</div>

---

## What is Shelve?

Shelve is a Chrome extension that helps you tame browser tab overload. Instead of having 30+ tabs slowing down your browser, shelve them with a single click — they're saved, organized by domain, and ready to restore whenever you need them.

**Think of it as a bookshelf for your browser tabs.**

### Key Features

- **One-click save** — Shelve all tabs or just the current one via popup, keyboard shortcut, or right-click menu
- **Auto-grouping by domain** — Tabs are automatically organized into groups like "GitHub", "Google Docs", "YouTube" etc. with 35+ curated domain mappings and brand colors
- **Full-text search** — Instantly find any shelved tab by title, URL, tag, or group name
- **Duplicate detection** — URLs are normalized and deduplicated on save — no more duplicates
- **Session history** — Every save is timestamped so you can see when you shelved what
- **Export / Import** — Full JSON export and import with merge support
- **Light & Dark mode** — Follows your system theme or set it manually
- **Badge counter** — Always see how many tabs you've shelved right on the toolbar icon
- **Zero dependencies** — Pure vanilla JS, no build step, no frameworks, no bloat

---

## Screenshots

<!-- Add screenshots here -->
<!-- ![Popup](screenshots/popup.png) -->
<!-- ![Dashboard](screenshots/dashboard.png) -->

---

## Installation

### From source (Developer mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/Ajeet1606/shelve.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned `shelve/` folder

5. The Shelve icon appears in your toolbar — you're ready to go!

> **Note:** There is no build step. The extension runs directly from source.

---

## Usage

### Shelving tabs

| Method | Action |
|--------|--------|
| **Popup → "Shelve All Tabs"** | Saves & closes all non-pinned tabs in the current window |
| **Popup → "Shelve This Tab"** | Saves & closes just the active tab |
| **Keyboard:** `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` | Shelve all tabs |
| **Keyboard:** `Cmd+Shift+X` (Mac) / `Ctrl+Shift+X` | Shelve current tab |
| **Right-click → "Shelve this tab"** | Saves & closes the current page |
| **Right-click → "Shelve all tabs in this window"** | Saves & closes all tabs |
| **Right-click a link → "Shelve this link"** | Saves the link URL without closing anything |

### Restoring tabs

- Open the **Dashboard** (click "Open Dashboard" in the popup)
- Click any tab title to restore it (opens in a new tab and removes from shelve)
- Click the **restore icon** on a group header to restore all tabs in that group
- Use the **search bar** (or press `/`) to find a specific tab

### Dashboard views

| View | Purpose |
|------|---------|
| **All Tabs** | Browse shelved tabs organized in auto-generated domain groups. Search, restore, or delete individually or in bulk. |
| **Sessions** | Chronological history of every shelve action with timestamps and tab counts. |
| **Settings** | Theme selection (System / Light / Dark), keyboard shortcut reference, export/import data, danger zone (delete all). |

---

## How It Works

### Architecture

```
┌──────────────┐     messages      ┌────────────────────┐
│    Popup     │ ◄──────────────► │   Service Worker    │
│  (popup/)    │                  │  (background/)      │
└──────────────┘                  │                     │
                                  │  • Context menus    │
┌──────────────┐     messages     │  • Keyboard cmds    │
│  Dashboard   │ ◄──────────────► │  • Tab save/close   │
│ (dashboard/) │                  │  • Badge updates    │
└──────────────┘                  └────────┬───────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ chrome.storage    │
                                  │    .local         │
                                  │                   │
                                  │ groups[]          │
                                  │ sessions[]        │
                                  │ settings{}        │
                                  └──────────────────┘
```

- **Service Worker** (`background/service-worker.js`) — The "backend". Handles all Chrome API calls, context menus, keyboard shortcuts, and writes to storage. All mutations go through here.
- **Popup** (`popup/`) — Lightweight UI for quick-save actions. Sends messages to the service worker.
- **Dashboard** (`dashboard/`) — Full-page management UI. Reads from `chrome.storage.local` and listens to `chrome.storage.onChanged` for live updates.
- **Utils** (`utils/`) — Shared logic for storage operations, domain-based grouping, and constants.

### Data Model

All data lives in `chrome.storage.local`:

```js
{
  groups: [
    {
      id: "uuid",
      name: "GitHub",            // Friendly display name
      domain: "github.com",      // Domain key for auto-grouping
      color: "#24292F",           // Brand color
      createdAt: 1708700000000,
      isAutoGenerated: true,      // Created by auto-grouping (vs. user-created)
      tabs: [
        {
          id: "uuid",
          url: "https://github.com/user/repo",
          title: "user/repo: A cool project",
          favIconUrl: "https://github.com/favicon.ico",
          savedAt: 1708700000000,
          tags: []
        }
      ]
    }
  ],
  sessions: [
    {
      id: "uuid",
      savedAt: 1708700000000,
      tabCount: 8,
      groupIds: ["uuid1", "uuid2"]
    }
  ],
  settings: {
    theme: "system"  // "system" | "light" | "dark"
  }
}
```

### Auto-Grouping

When tabs are saved, each URL is mapped to a domain group:

1. **Curated map** — 35+ well-known domains have friendly names and brand colors (e.g., `docs.google.com` → "Google Docs", `github.com` → "GitHub")
2. **Subdomain awareness** — Google sub-services (`mail.google.com`, `docs.google.com`, `drive.google.com`) are separate groups, not lumped together
3. **Fallback** — Unknown domains are prettified (`my-cool-app.netlify.app` → "My Cool App") and assigned a deterministic color from a palette

### Duplicate Detection

Before saving, each URL is normalized:
- Fragment (`#hash`) stripped
- Trailing slashes removed
- Query parameters sorted alphabetically
- Lowercased

If the normalized URL already exists in any group, the tab is **skipped** and a "duplicates skipped" count is shown.

---

## Project Structure

```
shelve/
├── manifest.json               # Chrome extension manifest (V3)
├── .gitignore
├── README.md
│
├── background/
│   └── service-worker.js       # MV3 service worker — all Chrome API logic
│
├── popup/
│   ├── popup.html              # Extension popup markup
│   ├── popup.css               # Popup styles (light/dark)
│   └── popup.js                # Popup interactions
│
├── dashboard/
│   ├── dashboard.html          # Full-page dashboard markup
│   ├── dashboard.css           # Dashboard styles (sidebar, cards, responsive)
│   └── dashboard.js            # Dashboard logic (views, search, CRUD, export)
│
├── utils/
│   ├── constants.js            # Message types, context menu IDs, blocked URLs
│   ├── storage.js              # All chrome.storage.local CRUD operations
│   └── grouping.js             # Domain → friendly name mapping & group resolver
│
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

**Zero external dependencies.** No `node_modules`, no build step, no framework.

---

## Contributing

Contributions are welcome! Here's how to get started:

### Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/shelve.git
   cd shelve
   ```
3. **Load the extension** in Chrome:
   - Go to `chrome://extensions`
   - Enable Developer mode
   - Click "Load unpacked" → select the `shelve/` folder
4. Make your changes — the extension reloads when you click the refresh icon on `chrome://extensions`

### Development workflow

Since there's no build step, development is straightforward:

1. Edit any file
2. Go to `chrome://extensions` and click the **refresh icon** (🔄) on the Shelve card
3. Re-open the popup or dashboard to see changes
4. For service worker changes, the refresh automatically restarts it

> **Tip:** Open `chrome://extensions` → click "service worker" link on the Shelve card to see console logs from the background script. Use the browser DevTools on the popup/dashboard for their logs.

### Code conventions

- **Vanilla JS** — No frameworks, no transpilation. Write code that runs directly in Chrome.
- **ES2020+** — Use modern syntax (`async/await`, `??`, `?.`, `crypto.randomUUID()`). Chrome extensions target modern Chrome, so no polyfills needed.
- **Module pattern** — Utils expose themselves via `globalThis` (e.g., `globalThis.ShelveStorage`). The service worker uses `importScripts()` to load them.
- **Event-driven** — All storage mutations happen through the service worker or `ShelveStorage` utils. UI surfaces react to `chrome.storage.onChanged` events.
- **CSS custom properties** — All colors use `--var` tokens defined in `:root`. Support light/dark via `prefers-color-scheme` media query and `[data-theme]` attribute override.

### Where to contribute

| Area | Ideas |
|------|-------|
| **Features** | Drag-and-drop tab reordering, inline group renaming, tab tagging, Markdown export, undo/redo |
| **Grouping** | Add more domains to the curated map in `utils/grouping.js`, improve domain prettification |
| **UI/UX** | Better icons, animations, empty states, onboarding flow |
| **Accessibility** | Keyboard navigation, ARIA labels, focus management |
| **Performance** | Optimize rendering for users with 1000+ saved tabs |
| **Testing** | Unit tests for `storage.js` and `grouping.js` utilities |
| **Bugs** | Check the [Issues tab](https://github.com/Ajeet1606/shelve/issues) |

### Submitting changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes with clear, focused commits
3. Test the extension manually in Chrome
4. Push and open a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Describe what you changed and why in the PR description

---

## Permissions

Shelve requests these Chrome permissions:

| Permission | Why |
|------------|-----|
| `tabs` | Access tab titles, URLs, and favicons to save them |
| `storage` | Persist shelved tabs in `chrome.storage.local` |
| `contextMenus` | Add "Shelve this tab" / "Shelve all tabs" to right-click menu |

**No remote servers. No analytics. No tracking.** All data stays in your browser's local storage.

---

## Roadmap

- [ ] Drag-and-drop tab reordering between groups
- [ ] Inline group renaming
- [ ] Tab tagging with custom labels
- [ ] Command palette (`Cmd+K`) for quick actions
- [ ] Undo/redo for delete and restore actions
- [ ] Bulk select and operations
- [ ] Markdown and CSV export formats
- [ ] Sync across devices via `chrome.storage.sync`
- [ ] Migrate to React + TypeScript + Vite for scalability

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ☕ and too many open tabs.</p>
  <p>
    <a href="https://github.com/Ajeet1606/shelve">⭐ Star on GitHub</a> · 
    <a href="https://github.com/Ajeet1606/shelve/issues">🐛 Report a bug</a> · 
    <a href="https://github.com/Ajeet1606/shelve/issues">💡 Request a feature</a>
  </p>
</div>
