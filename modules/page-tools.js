export function domainOf(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch { return null; }
}

export function groupByDomain(tabs) {
  const domains = new Map();
  for (const tab of tabs) {
    const domain = domainOf(tab.url);
    if (!domain || tab.pinned) continue;
    if (!domains.has(domain)) domains.set(domain, []);
    domains.get(domain).push(tab);
  }
  return [...domains].filter(([, items]) => items.length > 1);
}

export async function groupDomainTabs() {
  if (!await chrome.permissions.contains({ permissions: ["tabs", "tabGroups"] })) throw new Error("Sekme gruplama izni verilmedi.");
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groups = groupByDomain(tabs);
  const existing = await chrome.tabGroups.query({ windowId: tabs[0]?.windowId });
  const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  let count = 0;
  for (const [domain, items] of groups) {
    const reusable = existing.find(group => group.title === domain && tabs.filter(tab => tab.groupId === group.id).every(tab => domainOf(tab.url) === domain && !tab.pinned));
    const groupId = await chrome.tabs.group({ tabIds: items.map(tab => tab.id), ...(reusable ? { groupId: reusable.id } : {}) });
    const hash = [...domain].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    await chrome.tabGroups.update(groupId, { title: domain, color: colors[hash % colors.length] });
    count += items.length;
  }
  return { groups: groups.length, tabs: count };
}

export async function captureFullPage(tabId) {
  if (!await chrome.permissions.contains({ permissions: ["debugger", "downloads"] })) throw new Error("Ekran görüntüsü izni verilmedi.");
  const tab = await chrome.tabs.get(tabId);
  if (!domainOf(tab.url)) throw new Error("Normal bir web sayfasında tekrar dene.");
  const target = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(target, "1.3"); attached = true;
    const { cssContentSize } = await chrome.debugger.sendCommand(target, "Page.getLayoutMetrics");
    const width = Math.ceil(cssContentSize.width), height = Math.ceil(cssContentSize.height);
    const { data } = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true, fromSurface: true,
      clip: { x: 0, y: 0, width, height, scale: 1 }
    });
    if (!data) throw new Error("Görüntü oluşturulamadı.");
    const filename = `${domainOf(tab.url).replace(/[^a-z0-9.-]/gi, "_")}-${Date.now()}.png`;
    const downloadId = await chrome.downloads.download({ url: `data:image/png;base64,${data}`, filename });
    return { width, height, filename, downloadId };
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(() => {});
  }
}
