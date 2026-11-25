/* global process */
// Supabase REST helper for the macro monitor (gm_ tables in the Gloomberg
// project). Server-side only: the secret key never reaches the browser. The
// tables have row-level security on and no policies, so only this key can
// read or write them. Files starting with "_" are not deployed as endpoints.

const DEFAULT_URL = "https://nncwxgkdwekywydvgitx.supabase.co"; // Gloomberg project (not a secret)

export const supabaseConfigured = () => !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

function headers(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set in Vercel");
  // New-style secret keys (sb_secret_…) go in the apikey header only; legacy
  // service_role JWTs also go in Authorization.
  return { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", ...extra };
}

export async function sb(path, { method = "GET", body, prefer } = {}) {
  const base = process.env.SUPABASE_URL || DEFAULT_URL;
  const r = await fetch(`${base}/rest/v1/${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: headers(prefer ? { Prefer: prefer } : {}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export async function kvGet(key) {
  const rows = await sb(`gm_kv?key=eq.${encodeURIComponent(key)}&select=value,updated_at`);
  return rows?.[0] ? { value: rows[0].value, updatedAt: rows[0].updated_at } : null;
}

export async function kvSet(key, value) {
  await sb("gm_kv?on_conflict=key", { method: "POST", body: [{ key, value, updated_at: new Date().toISOString() }],
    prefer: "resolution=merge-duplicates,return=minimal" });
}

export async function insertAlerts(rows) {
  if (!rows.length) return;
  await sb("gm_alerts?on_conflict=id", { method: "POST", body: rows, prefer: "resolution=ignore-duplicates,return=minimal" });
}

export async function updateAlert(id, patch) {
  await sb(`gm_alerts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch, prefer: "return=minimal" });
}

export const recentAlerts = (days = 7) =>
  sb(`gm_alerts?at=gte.${new Date(Date.now() - days * 86400000).toISOString()}&order=at.desc&limit=200`);

export const listDecisions = (days = 180) =>
  sb(`gm_decisions?created_at=gte.${new Date(Date.now() - days * 86400000).toISOString()}&order=created_at.desc&limit=300`);

export async function insertDecision(d) {
  const rows = await sb("gm_decisions", { method: "POST", body: [d], prefer: "return=representation" });
  return rows?.[0] || null;
}

export async function updateDecision(id, patch) {
  const rows = await sb(`gm_decisions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch, prefer: "return=representation" });
  return rows?.[0] || null;
}
