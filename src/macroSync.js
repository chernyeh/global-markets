// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — sync with the server store (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════════
// The app key (GM_APP_KEY, a passphrase you set in Vercel) is kept in this
// browser only and sent as x-gm-key; without it nothing private is read or
// written, and the monitor keeps working from local storage as before.

const KEY_LS = "gm_app_key";

export function getAppKey() {
  try { return localStorage.getItem(KEY_LS) || ""; } catch { return ""; }
}
export function storeAppKey(k) {
  try { if (k) localStorage.setItem(KEY_LS, k); else localStorage.removeItem(KEY_LS); } catch { /* storage blocked */ }
}

export async function storeApi(kind, { method = "GET", body, query = {} } = {}) {
  const qs = new URLSearchParams({ kind, ...query }).toString();
  const r = await fetch(`/api/store?${qs}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-gm-key": getAppKey() },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

// Server alerts (pushed while the app was closed) merged into the in-app inbox.
// A browser alert for the same signal and severity within a day is the same
// event: keep one entry and mark it pushed.
export function mergeServerAlerts(local = [], server = [], readServer = []) {
  const read = new Set(readServer);
  const out = local.map(a => ({ ...a }));
  for (const s of server) {
    const at = Date.parse(s.at);
    const twin = out.find(a => a.kind === s.kind && a.ref === s.ref && a.sev === s.sev && Math.abs(a.at - at) < 86400000);
    if (twin) { if (s.pushed) twin.pushed = true; continue; }
    out.push({ id: s.id, at, kind: s.kind, ref: s.ref, sev: s.sev, title: s.title, detail: s.detail, action: s.action, guard: s.guard,
      read: read.has(s.id), pushed: s.pushed, pushError: s.push_error, server: true });
  }
  return out.sort((a, b) => b.at - a.at);
}

export const dueDecisions = (decisions, today = new Date().toISOString().slice(0, 10)) =>
  (decisions || []).filter(d => d.decision === "deferred" && !d.resolved && d.due_date && d.due_date <= today);
