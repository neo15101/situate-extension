// JS port of corpus/export_static.py:canonicalize().
// Must produce the SAME keys as the Python version, since the keys index
// into the gzipped url_index that lives on Vercel.

const LW_HOSTS = new Set(["lesswrong.com", "greaterwrong.com"]);

function stripWww(host) {
  return host.toLowerCase().replace(/^www\./, "");
}

function canonicalizeLW(u) {
  const host = stripWww(u.hostname);
  if (!LW_HOSTS.has(host)) return null;

  let m = u.pathname.match(/^\/(?:posts|events)\/([A-Za-z0-9]+)/);
  if (!m) m = u.pathname.match(/^\/s\/[A-Za-z0-9]+\/p\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const postId = m[1];

  let commentId = null;
  if (u.hash) {
    const frag = u.hash.replace(/^#/, "");
    if (/^[A-Za-z0-9]+$/.test(frag)) commentId = frag;
  }
  if (!commentId) {
    for (const k of ["commentId", "commentid"]) {
      const v = u.searchParams.get(k);
      if (v && /^[A-Za-z0-9]+$/.test(v)) { commentId = v; break; }
    }
  }
  return commentId ? `lw:comment:${postId}:${commentId}` : `lw:post:${postId}`;
}

function canonicalizeSubstack(u, domainToPub) {
  const host = stripWww(u.hostname);
  if (!host) return null;

  if (host === "substack.com") {
    const m = u.pathname.match(/^\/home\/post\/p-(\d+)/);
    return m ? `sub-id:${m[1]}` : null;
  }

  let pub;
  if (host.endsWith(".substack.com")) {
    pub = host.slice(0, -".substack.com".length);
  } else {
    pub = domainToPub[host];
    if (!pub) return null;
  }
  const m = u.pathname.match(/^\/p\/([^/?#]+)/);
  if (!m) return null;
  const slug = m[1].toLowerCase().replace(/\/$/, "");
  return `sub:${pub}:${slug}`;
}

export function canonicalize(rawUrl, domainToPub) {
  if (!rawUrl) return null;
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  return canonicalizeLW(u) || canonicalizeSubstack(u, domainToPub || {});
}

// FNV-1a 32-bit. Must match corpus/export_static.py:fnv1a32 byte-for-byte.
const _TE = new TextEncoder();
export function fnv1a32(s) {
  const b = _TE.encode(s);
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return h >>> 0;
}

export function isAllowedHost(rawUrl, domainToPub) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  const host = stripWww(u.hostname);
  if (LW_HOSTS.has(host)) return true;
  if (host === "substack.com" || host.endsWith(".substack.com")) return true;
  return !!(domainToPub && domainToPub[host]);
}
