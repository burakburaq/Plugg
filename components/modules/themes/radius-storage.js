async function hashKey(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `themes:radius:${[...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function radiusStorageKey(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported page");
  return hashKey(parsed.origin);
}

export function mergeRadiusEntries(existing, changes) {
  const result = new Map();
  for (const entry of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(changes) ? changes : [])]) {
    if (typeof entry?.selector === "string" && /^\d+(?:\.\d+)?px$/.test(entry.radius)) result.set(entry.selector, { selector: entry.selector, radius: entry.radius });
  }
  return [...result.values()];
}

export function hasRadiusChanges(entries, saved) {
  const previous = new Map(mergeRadiusEntries([], saved).map(item => [item.selector, item.radius]));
  return entries.some(item => previous.get(item.selector) !== item.radius);
}

export async function loadRadiusEntries(url) {
  const key = await radiusStorageKey(url);
  const legacyKey = await hashKey(new URL(url).href);
  const data = await chrome.storage.local.get([key, legacyKey]);
  const legacy = Array.isArray(data[legacyKey]) ? data[legacyKey] : [];
  const entries = mergeRadiusEntries(legacy, data[key]);
  if (legacy.length) {
    await chrome.storage.local.set({ [key]: entries });
    await chrome.storage.local.remove(legacyKey);
  }
  return { key, entries };
}
