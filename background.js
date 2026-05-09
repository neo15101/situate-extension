import { canonicalize, isAllowedHost, fnv1a32 } from "./canonicalize.js";

const HASH_URL       = "https://situate.info/url_hashes.bin";
const DOMAIN_MAP_URL = "https://situate.info/rational/api/domain_map";
const REFRESH_DAYS   = 1;
const REFRESH_MS     = REFRESH_DAYS * 24 * 60 * 60 * 1000;

let hashSet = null;
let domainToPub = null;
let hashLoadPromise = null;
let hashRefreshPromise = null;
let domainMapLoadPromise = null;

// Self-tests: hash agreement with the Python writer + platform little-endianness
// (url_hashes.bin is written as LE u32; new Uint32Array reads platform-native).
if (fnv1a32("test") !== 0xafd071e5) console.error("Situate: fnv1a32 self-check FAILED");
if (new Uint32Array(new Uint8Array([1,0,0,0]).buffer)[0] !== 1) console.error("Situate: platform is big-endian; url_hashes.bin will be misread");

async function loadDomainMap() {
  if (domainToPub) return domainToPub;
  if (!domainMapLoadPromise) {
    domainMapLoadPromise = (async () => {
      const cached = await chrome.storage.local.get("domain_to_pub");
      if (cached.domain_to_pub) {
        domainToPub = cached.domain_to_pub;
        return domainToPub;
      }
      try {
        const r = await fetch(DOMAIN_MAP_URL);
        const m = await r.json();
        const dmap = m.domain_to_pub || {};
        domainToPub = dmap;
        await chrome.storage.local.set({ domain_to_pub: dmap });
        return dmap;
      } catch {
        return {};  // don't poison the in-memory cache
      }
    })().finally(() => { domainMapLoadPromise = null; });
  }
  return domainMapLoadPromise;
}

async function refreshHashes() {
  if (hashRefreshPromise) return hashRefreshPromise;
  hashRefreshPromise = (async () => {
    try {
      const buf = await fetch(HASH_URL).then(r => r.arrayBuffer());
      const arr = Array.from(new Uint32Array(buf));
      await chrome.storage.local.set({ url_hashes: arr, hashes_fetched_at: Date.now() });
      hashSet = new Set(arr);
      try {
        const r = await fetch(DOMAIN_MAP_URL);
        const m = await r.json();
        domainToPub = m.domain_to_pub || {};
        await chrome.storage.local.set({ domain_to_pub: domainToPub });
      } catch {}
    } catch (e) {
      console.warn("Situate: hash refresh failed", e);
    }
  })().finally(() => { hashRefreshPromise = null; });
  return hashRefreshPromise;
}

async function loadHashes() {
  if (hashSet) return hashSet;
  if (!hashLoadPromise) {
    hashLoadPromise = (async () => {
      const { url_hashes, hashes_fetched_at } =
        await chrome.storage.local.get(["url_hashes", "hashes_fetched_at"]);
      if (Array.isArray(url_hashes)) {
        hashSet = new Set(url_hashes);
        if (Date.now() - (hashes_fetched_at || 0) > REFRESH_MS) refreshHashes();
        return hashSet;
      }
      await refreshHashes();
      return hashSet;
    })().finally(() => { hashLoadPromise = null; });
  }
  return hashLoadPromise;
}

async function setIcon(tabId, filled) {
  const path = filled
    ? { 16: "icons/16-filled.png", 32: "icons/32-filled.png", 48: "icons/48-filled.png" }
    : { 16: "icons/16-empty.png",  32: "icons/32-empty.png",  48: "icons/48-empty.png"  };
  try { await chrome.action.setIcon({ tabId, path }); } catch {}
  try {
    await chrome.action.setTitle({
      tabId,
      title: filled ? "In corpus — click for similar" : "Situate (not in corpus)"
    });
  } catch {}
}

async function updateForTab(tabId, url) {
  if (!url) return setIcon(tabId, false);
  const dmap = await loadDomainMap();
  if (!isAllowedHost(url, dmap)) return setIcon(tabId, false);
  const key = canonicalize(url, dmap);
  if (!key) return setIcon(tabId, false);
  const set = await loadHashes();
  setIcon(tabId, !!(set && set.has(fnv1a32(key))));
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" || info.url) updateForTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateForTab(tabId, tab.url);
  } catch {}
});

chrome.runtime.onInstalled.addListener(refreshHashes);
chrome.alarms.create("refresh", { periodInMinutes: REFRESH_DAYS * 24 * 60 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "refresh") refreshHashes(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "refresh") {
    refreshHashes().then(() => sendResponse({ ok: true }));
    return true;  // keep channel open for async sendResponse
  }
});

// Eager preload at SW boot so the first tab event doesn't pay cold-start.
loadDomainMap();
loadHashes();
