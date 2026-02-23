/**
 * Grouping engine — maps URLs to friendly domain-based groups.
 *
 * Strategy:
 * 1. Check curated map for well-known domains → friendly name + brand color
 * 2. Handle subdomain awareness (docs.google.com ≠ mail.google.com)
 * 3. Fallback: prettify unknown domains
 */

const DOMAIN_MAP = {
  "github.com": { name: "GitHub", color: "#24292F" },
  "gitlab.com": { name: "GitLab", color: "#FC6D26" },
  "bitbucket.org": { name: "Bitbucket", color: "#0052CC" },
  "stackoverflow.com": { name: "Stack Overflow", color: "#F48024" },
  "reddit.com": { name: "Reddit", color: "#FF4500" },
  "twitter.com": { name: "Twitter / X", color: "#1DA1F2" },
  "x.com": { name: "Twitter / X", color: "#1DA1F2" },
  "youtube.com": { name: "YouTube", color: "#FF0000" },
  "linkedin.com": { name: "LinkedIn", color: "#0A66C2" },
  "facebook.com": { name: "Facebook", color: "#1877F2" },
  "instagram.com": { name: "Instagram", color: "#E4405F" },
  "wikipedia.org": { name: "Wikipedia", color: "#000000" },
  "medium.com": { name: "Medium", color: "#000000" },
  "dev.to": { name: "DEV Community", color: "#0A0A0A" },
  "notion.so": { name: "Notion", color: "#000000" },
  "figma.com": { name: "Figma", color: "#F24E1E" },
  "dribbble.com": { name: "Dribbble", color: "#EA4C89" },
  "amazon.com": { name: "Amazon", color: "#FF9900" },
  "netflix.com": { name: "Netflix", color: "#E50914" },
  "spotify.com": { name: "Spotify", color: "#1DB954" },
  "slack.com": { name: "Slack", color: "#4A154B" },
  "discord.com": { name: "Discord", color: "#5865F2" },
  "twitch.tv": { name: "Twitch", color: "#9146FF" },
  "npmjs.com": { name: "npm", color: "#CB3837" },
  "vercel.com": { name: "Vercel", color: "#000000" },
  "netlify.com": { name: "Netlify", color: "#00C7B7" },
  "aws.amazon.com": { name: "AWS", color: "#FF9900" },
  "console.cloud.google.com": { name: "Google Cloud", color: "#4285F4" },
  "portal.azure.com": { name: "Azure", color: "#0078D4" },

  // Google sub-services (keyed by full hostname)
  "docs.google.com": { name: "Google Docs", color: "#4285F4" },
  "sheets.google.com": { name: "Google Sheets", color: "#0F9D58" },
  "slides.google.com": { name: "Google Slides", color: "#F4B400" },
  "drive.google.com": { name: "Google Drive", color: "#4285F4" },
  "mail.google.com": { name: "Gmail", color: "#EA4335" },
  "calendar.google.com": { name: "Google Calendar", color: "#4285F4" },
  "meet.google.com": { name: "Google Meet", color: "#00897B" },
  "maps.google.com": { name: "Google Maps", color: "#34A853" },
  "translate.google.com": { name: "Google Translate", color: "#4285F4" },
  "google.com": { name: "Google Search", color: "#4285F4" },
  "www.google.com": { name: "Google Search", color: "#4285F4" },
};

// Palette for unknown domains
const FALLBACK_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F43F5E",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#A855F7",
  "#D946EF",
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Extract domain key from a URL.
 * Returns the full hostname for known sub-services (e.g. "docs.google.com"),
 * or the root domain for everything else.
 */
function getDomainKey(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, "");

    // Check full hostname first (for sub-service matching)
    if (DOMAIN_MAP[u.hostname]) return u.hostname;
    if (DOMAIN_MAP[hostname]) return hostname;

    // Two-part TLDs
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join(".");
      // Check if root is in the map
      if (DOMAIN_MAP[rootDomain]) return rootDomain;
      return rootDomain;
    }

    return hostname;
  } catch {
    return "other";
  }
}

/**
 * Prettify a raw domain into a display name.
 * e.g. "dev.to" → "Dev.to", "my-blog.netlify.app" → "My Blog"
 */
function prettifyDomain(domain) {
  // Remove TLD for common patterns
  const withoutTld = domain.replace(
    /\.(com|org|net|io|dev|app|co|me|tv)$/i,
    "",
  );
  return withoutTld
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Given a URL and existing groups, return the target group (existing or new stub).
 * Used as `groupResolver` for `ShelveStorage.saveTabs()`.
 */
function resolveGroup(tabEntry, existingGroups) {
  const domainKey = getDomainKey(tabEntry.url);
  const mapped = DOMAIN_MAP[domainKey];

  const friendlyName = mapped ? mapped.name : prettifyDomain(domainKey);
  const color = mapped
    ? mapped.color
    : FALLBACK_COLORS[hashString(domainKey) % FALLBACK_COLORS.length];

  // Find existing group by domain key
  let group = existingGroups.find((g) => g.domain === domainKey);
  if (group) return group;

  // Create new group stub (will be pushed into the groups array by saveTabs)
  group = {
    id: (
      globalThis.ShelveStorage?.generateId ??
      (() => Date.now().toString(36) + Math.random().toString(36).slice(2))
    )(),
    name: friendlyName,
    domain: domainKey,
    color,
    createdAt: Date.now(),
    isAutoGenerated: true,
    tabs: [],
  };
  existingGroups.push(group);
  return group;
}

if (typeof globalThis !== "undefined") {
  globalThis.ShelveGrouping = {
    resolveGroup,
    getDomainKey,
    prettifyDomain,
    DOMAIN_MAP,
  };
}
