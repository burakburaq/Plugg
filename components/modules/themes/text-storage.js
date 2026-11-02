export async function textStorageKey(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported page");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parsed.origin));
  return `themes:text:${[...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function mergeTextEntries(existing, changes) {
  const result = new Map();
  for (const entry of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(changes) ? changes : [])]) {
    if (typeof entry?.selector === "string" && typeof entry.original === "string" && typeof entry.text === "string") {
      result.set(JSON.stringify([entry.selector, entry.original]), { selector: entry.selector, original: entry.original, text: entry.text });
    }
  }
  return [...result.values()];
}

export function hasTextChanges(entries, saved) {
  const previous = new Map(mergeTextEntries([], saved).map(item => [JSON.stringify([item.selector, item.original]), item.text]));
  return entries.some(item => (previous.get(JSON.stringify([item.selector, item.original])) ?? item.original) !== item.text);
}

export async function loadTextEntries(url) {
  const key = await textStorageKey(url);
  const data = await chrome.storage.local.get(key);
  return { key, entries: mergeTextEntries([], data[key]) };
}
