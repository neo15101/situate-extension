const API = "https://situate.info/rational/api/similar";
const FULL = "https://situate.info/rational/search";
const TIMEOUT_MS = 8000;

const status = document.getElementById("status");
const results = document.getElementById("results");
const openFull = document.getElementById("open-full");

function safeHref(u) {
  try {
    const x = new URL(u);
    return (x.protocol === "https:" || x.protocol === "http:") ? x.href : "#";
  } catch {
    return "#";
  }
}

function renderRow(r) {
  const li = document.createElement("li");

  const a = document.createElement("a");
  a.href = safeHref(r.url);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = r.title || "(untitled)";
  li.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "meta";

  const left = document.createElement("span");
  left.textContent = `${r.author || "Unknown"} · ${r.source}`;
  meta.appendChild(left);

  const score = document.createElement("span");
  score.className = "score";
  score.textContent = typeof r.score === "number" ? r.score.toFixed(3) : "";
  meta.appendChild(score);

  li.appendChild(meta);
  return li;
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url;
  if (!url) {
    status.textContent = "No URL on this tab.";
    status.classList.add("error");
    return;
  }
  openFull.href = `${FULL}?url=${encodeURIComponent(url)}`;
  openFull.classList.remove("loading");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(`${API}?url=${encodeURIComponent(url)}&limit=20`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const rows = data.results || [];
    if (rows.length === 0) {
      status.textContent = "Not in corpus, or no similar posts found.";
      return;
    }
    status.textContent = `${rows.length} similar posts`;
    for (const row of rows) results.appendChild(renderRow(row));
  } catch (e) {
    status.textContent = e.name === "AbortError" ? "Timed out." : `Error: ${e.message}`;
    status.classList.add("error");
  } finally {
    clearTimeout(timer);
  }
})();
