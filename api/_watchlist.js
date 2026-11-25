/* global process */
// Watchlist data layer: reads and writes Gloomberg's own tables in the shared
// Supabase project, so a name added, edited or removed here shows up in
// Gloomberg and the other way round. Server-side only (secret key).
//
// Gloomberg tables used (owned by chernyeh/gloomberg — schema not changed here):
//   watchlist           read + write (add / edit / remove, same fields and rules
//                       as Gloomberg's own form: upper-case ticker, unique per
//                       user, reason/notes changes timestamped and logged)
//   watchlist_notes_log write (a row per reason/notes change, as Gloomberg does)
//   holdings            read only (ticker, labels, target/stop — no quantities or costs)
//   theses              read only (latest per ticker: levels, dates, summary)
//   deferred_decisions  read only (open deferrals per ticker)
//   dividend_data       read only (declared ex-dates from today)
//   digest_companies    read only (TSE liquidity tier for .T names)
// This app's own data (why tracked, group, local name, benchmark, mute,
// alert prefs and state) lives in gm_kv: watch_meta, watch_prefs, watch_alert_state.

import { sb, kvGet, kvSet } from "./_supabase.js";
import { get } from "./macro.js";
import { DEFAULT_PREFS } from "../src/watchCalc.js";
import { PURPOSES } from "../src/data/watchMarkets.js";

const DEFAULT_URL = "https://nncwxgkdwekywydvgitx.supabase.co";
const enc = encodeURIComponent;
const str = (v, n) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim().slice(0, n));
const numOrNull = v => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const TICKER_RE = /^[A-Z0-9^=.&-]{1,20}$/;

// ─── Which Gloomberg user ────────────────────────────────────────────────────
// Gloomberg is single-user: every row carries the same user_id. Take it from
// GLOOMBERG_USER_ID when set, else from the rows themselves (refusing if they
// disagree, so a write can never land under the wrong user).
let cachedUid = null;
export async function gbUserId() {
  if (process.env.GLOOMBERG_USER_ID) return process.env.GLOOMBERG_USER_ID;
  if (cachedUid) return cachedUid;
  for (const t of ["watchlist", "holdings", "theses"]) {
    const rows = await sb(`${t}?select=user_id&limit=500`);
    const ids = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))];
    if (ids.length > 1) throw new Error("Gloomberg has more than one user — set GLOOMBERG_USER_ID in Vercel");
    if (ids.length === 1) { cachedUid = ids[0]; return cachedUid; }
  }
  throw new Error("No Gloomberg user found — set GLOOMBERG_USER_ID in Vercel");
}

const THESIS_COLS = ["ticker", "company_name", "conviction_score", "date_completed", "price_currency", "price_at_analysis", "munger_price",
  "entry_price", "entry_price_currency", "exit_price", "prob_weighted_value", "bear_price", "base_price", "bull_price",
  "invalidation_trigger_price", "invalidation_trigger_note", "next_results_date", "next_review_date", "action_verb", "action_and_deadline",
  "thesis_summary", "anchor_multiple", "anchor_multiple_basis", "anchor_multiple_period", "reward_to_risk_ratio", "quality_tier", "updated_at"].join(",");
const WATCH_COLS = "id,ticker,name,sector,country,asset_type,reason_added,notes,alert_price,buy_trigger,added_date,conviction_score,updated_at,reason_updated_at,notes_updated_at";

// ─── Read everything the board needs in one go ───────────────────────────────
export async function loadCoverage() {
  const uid = await gbUserId();
  const u = `user_id=eq.${enc(uid)}`;
  const today = new Date().toISOString().slice(0, 10);
  const [watch, holdRaw, thesesRaw, defer, divs, metaRec, prefsRec] = await Promise.all([
    sb(`watchlist?${u}&select=${WATCH_COLS}&order=ticker`),
    sb(`holdings?${u}&select=id,ticker,name,sector,country,asset_type,category,currency,target_price,stop_loss,conviction_score,quantity`),
    sb(`theses?${u}&select=${THESIS_COLS}&order=date_completed.desc.nullslast,updated_at.desc`),
    sb(`deferred_decisions?${u}&resolved=eq.false&select=ticker,defer_date,decision_type`).catch(() => []),
    sb(`dividend_data?${u}&ex_date=gte.${today}&select=ticker,ex_date,payment_date,amount,currency&order=ex_date`).catch(() => []),
    kvGet("watch_meta"), kvGet("watch_prefs"),
  ]);
  // Holdings: positions still held, without quantities or costs.
  const hold = (holdRaw || []).filter(h => h.ticker && !(Number(h.quantity) <= 0))
    .map(h => Object.fromEntries(Object.entries(h).filter(([k]) => k !== "quantity")));
  // Latest thesis per ticker (rows arrive newest first); long text trimmed.
  const theses = {};
  for (const t of thesesRaw || []) {
    const k = String(t.ticker || "").toUpperCase();
    if (!k || theses[k]) continue;
    theses[k] = { ...t, thesis_summary: str(t.thesis_summary, 700), action_and_deadline: str(t.action_and_deadline, 300), invalidation_trigger_note: str(t.invalidation_trigger_note, 300) };
  }
  const deferrals = {};
  for (const d of defer || []) {
    const k = String(d.ticker || "").toUpperCase();
    if (!k) continue;
    const cur = deferrals[k] || { count: 0, oldest: null };
    cur.count++; if (!cur.oldest || d.defer_date < cur.oldest) cur.oldest = d.defer_date;
    deferrals[k] = cur;
  }
  const exDiv = {};
  for (const d of divs || []) { const k = String(d.ticker || "").toUpperCase(); if (k && !exDiv[k]) exDiv[k] = d; }
  // TSE liquidity tier (Gloomberg's digest feed) for Tokyo names.
  const codes = [...new Set([...(watch || []), ...hold].map(r => String(r.ticker || "").toUpperCase()).filter(t => /^\d{4}[A-Z]?\.T$/.test(t)).map(t => t.slice(0, -2)))];
  let liquidity = {};
  if (codes.length) {
    try {
      const rows = await sb(`digest_companies?code=in.(${codes.map(enc).join(",")})&select=code,liquidity:data->liquidity`);
      liquidity = Object.fromEntries((rows || []).filter(r => r.liquidity).map(r => [`${r.code}.T`, r.liquidity]));
    } catch { /* optional */ }
  }
  return {
    watch: watch || [], hold, theses, deferrals, exDiv, liquidity,
    meta: metaRec?.value?.t || {}, prefs: { ...DEFAULT_PREFS, ...(prefsRec?.value || {}) },
  };
}

export const recentWatchAlerts = (days = 7) =>
  sb(`gm_alerts?kind=eq.watch&at=gte.${new Date(Date.now() - days * 86400000).toISOString()}&order=at.desc&limit=100`).catch(() => []);

// ─── Writes to Gloomberg's watchlist ─────────────────────────────────────────
function cleanItem(b) {
  const alert = numOrNull(b.alert_price);
  return {
    name: str(b.name, 200), sector: str(b.sector, 80), country: str(b.country, 80), asset_type: str(b.asset_type, 40),
    reason_added: str(b.reason_added, 4000), notes: str(b.notes, 8000),
    alert_price: alert !== null && alert > 0 ? alert : null, buy_trigger: str(b.buy_trigger, 1000),
  };
}

const friendly = e => (/23505|duplicate key|watchlist_user_id_ticker_key/i.test(e.message) ? new Error("That ticker is already on the Gloomberg watchlist") : e);

export async function addItem(body) {
  const uid = await gbUserId();
  const ticker = String(body.ticker || "").toUpperCase().trim();
  if (!TICKER_RE.test(ticker)) throw new Error("Ticker missing or not in Yahoo format (e.g. AAPL, 7203.T, D05.SI)");
  const row = { ...cleanItem(body), ticker, user_id: uid };
  if (!row.name) throw new Error("Name is required");
  try {
    const out = await sb("watchlist", { method: "POST", body: [row], prefer: "return=representation" });
    return out?.[0] || null;
  } catch (e) { throw friendly(e); }
}

// Same rule as Gloomberg's form: a changed reason or note gets its timestamp
// and a row in watchlist_notes_log.
export async function updateItem(id, body) {
  const uid = await gbUserId();
  const cur = (await sb(`watchlist?id=eq.${enc(id)}&user_id=eq.${enc(uid)}&select=id,reason_added,notes`))?.[0];
  if (!cur) throw new Error("Not on the watchlist any more — it may have been removed in Gloomberg");
  const clean = cleanItem(body);
  const patch = {};
  for (const k of Object.keys(clean)) if (k in body) patch[k] = clean[k];
  if ("name" in patch && !patch.name) delete patch.name;
  const now = new Date().toISOString();
  const reasonChanged = "reason_added" in patch && (patch.reason_added || null) !== (cur.reason_added || null);
  const notesChanged = "notes" in patch && (patch.notes || null) !== (cur.notes || null);
  if (reasonChanged) patch.reason_updated_at = now;
  if (notesChanged) patch.notes_updated_at = now;
  patch.updated_at = now;
  const out = await sb(`watchlist?id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, { method: "PATCH", body: patch, prefer: "return=representation" });
  if (reasonChanged || notesChanged) {
    const row = out?.[0] || {};
    await sb("watchlist_notes_log", { method: "POST", body: [{ watchlist_id: id, user_id: uid, reason_text: row.reason_added ?? null, notes_text: row.notes ?? null }],
      prefer: "return=minimal" }).catch(() => { /* fire-and-forget, as in Gloomberg */ });
  }
  return out?.[0] || null;
}

// Hard delete, as Gloomberg does; the full row comes back so the app can
// offer an undo that puts it back with the same id and dates.
export async function removeItem(id) {
  const uid = await gbUserId();
  const out = await sb(`watchlist?id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, { method: "DELETE", prefer: "return=representation" });
  if (!out?.length) throw new Error("Not found — it may already have been removed in Gloomberg");
  return out[0];
}

const RESTORE_COLS = ["id", "ticker", "name", "sector", "country", "asset_type", "reason_added", "notes", "alert_price", "buy_trigger", "added_date",
  "created_at", "updated_at", "reason_updated_at", "notes_updated_at", "deep_dive", "conviction_score"];
export async function restoreItem(snapshot) {
  const uid = await gbUserId();
  const row = Object.fromEntries(RESTORE_COLS.filter(k => snapshot?.[k] !== undefined).map(k => [k, snapshot[k]]));
  if (!row.id || !TICKER_RE.test(String(row.ticker || ""))) throw new Error("Nothing to restore");
  try {
    const out = await sb("watchlist", { method: "POST", body: [{ ...row, user_id: uid }], prefer: "return=representation" });
    return out?.[0] || null;
  } catch (e) { throw friendly(e); }
}

// ─── This app's own per-name settings ────────────────────────────────────────
const PURPOSE_IDS = new Set(PURPOSES.map(p => p.id));
function cleanMeta(m) {
  const out = {};
  if ("purpose" in m) out.purpose = (Array.isArray(m.purpose) ? m.purpose : []).filter(p => PURPOSE_IDS.has(p));
  for (const [k, n] of [["group", 60], ["local", 80], ["localShort", 40], ["bench", 20], ["q", 160]]) if (k in m) out[k] = str(m[k], n);
  if ("aliases" in m) out.aliases = (Array.isArray(m.aliases) ? m.aliases : String(m.aliases || "").split(/[|,]/)).map(a => str(a, 60)).filter(Boolean).slice(0, 6);
  // Where a local name / short names came from: "ai" (suggested) or "user" (edited — never re-suggested).
  if ("localSrc" in m) out.localSrc = ["ai", "user"].includes(m.localSrc) ? m.localSrc : null;
  if ("aliasSrc" in m) out.aliasSrc = ["ai", "user"].includes(m.aliasSrc) ? m.aliasSrc : null;
  if ("mute" in m) out.mute = !!m.mute;
  if (out.bench && !TICKER_RE.test(out.bench.toUpperCase())) out.bench = null;
  if (out.bench) out.bench = out.bench.toUpperCase();
  return out;
}

// patches: { TICKER: { field: value } } — merged into what is stored.
export async function setMeta(patches) {
  const cur = (await kvGet("watch_meta"))?.value?.t || {};
  for (const [t, m] of Object.entries(patches || {}).slice(0, 200)) {
    const k = String(t).toUpperCase();
    if (!TICKER_RE.test(k) || !m || typeof m !== "object") continue;
    const next = { ...(cur[k] || {}), ...cleanMeta(m) };
    Object.keys(next).forEach(f => (next[f] === null || next[f] === undefined || (Array.isArray(next[f]) && !next[f].length) || next[f] === false) && delete next[f]);
    if (Object.keys(next).length) cur[k] = next; else delete cur[k];
  }
  const value = { t: cur, savedAt: Date.now() };
  if (JSON.stringify(value).length > 200000) throw new Error("watchlist settings too large");
  await kvSet("watch_meta", value);
  return cur;
}

export async function setPrefs(body) {
  const cur = (await kvGet("watch_prefs"))?.value || {};
  const sigma = Number(body.sigma);
  const next = { ...DEFAULT_PREFS, ...cur,
    ...("tgLevels" in body ? { tgLevels: !!body.tgLevels } : {}),
    ...("tgMoves" in body ? { tgMoves: !!body.tgMoves } : {}),
    ...(Number.isFinite(sigma) && sigma >= 2 && sigma <= 6 ? { sigma } : {}) };
  await kvSet("watch_prefs", next);
  return next;
}

// ─── Valuations: Yahoo v7 quote through Gloomberg's own proxy ────────────────
// Yahoo's v7 quote (P/E, P/B, earnings date) needs a session cookie and crumb.
// Gloomberg's yahoo-proxy edge function (same Supabase project, deployed with
// verify_jwt off) already handles that, so this app reuses it rather than
// keep a second copy of the cookie logic. If it fails, the valuation
// columns show "—" and the error appears in the page's source line.
const V7_FIELDS = "symbol,currency,longName,shortName,trailingPE,forwardPE,priceToBook,marketCap,trailingAnnualDividendYield,dividendYield," +
  "earningsTimestamp,earningsTimestampStart,earningsTimestampEnd,isEarningsDateEstimate,averageDailyVolume3Month,epsForward,epsTrailingTwelveMonths,financialCurrency";

export async function fetchFundamentals(symbols, signal) {
  const base = process.env.SUPABASE_URL || DEFAULT_URL;
  const proxy = u => `${base}/functions/v1/yahoo-proxy?url=${enc(u)}`;
  const out = {}, errors = {};
  for (let i = 0; i < symbols.length; i += 25) {
    const batch = symbols.slice(i, i + 25);
    let got = false, lastErr = "no data";
    for (const host of ["query1", "query2"]) {
      try {
        const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${batch.map(enc).join(",")}&fields=${V7_FIELDS}`;
        const j = await (await get(proxy(url), { signal, timeoutMs: 12000, headers: { Accept: "application/json" } })).json();
        const rows = j?.quoteResponse?.result || [];
        if (!rows.length) { lastErr = j?.quoteResponse?.error?.description || j?.finance?.error?.description || "empty answer"; continue; }
        for (const q of rows) {
          const dy = q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : q.dividendYield ?? null;
          const earn = q.earningsTimestamp || q.earningsTimestampStart || null;
          out[q.symbol] = {
            pe: q.trailingPE ?? null, fpe: q.forwardPE ?? null, pb: q.priceToBook ?? null, mcap: q.marketCap ?? null, dy,
            earn: earn ? new Date(earn * 1000).toISOString().slice(0, 10) : null, earnEst: !!q.isEarningsDateEstimate,
            adv: q.averageDailyVolume3Month ?? null, ccy: q.currency || null, name: q.longName || q.shortName || null,
          };
        }
        got = true; break;
      } catch (e) { lastErr = e.name === "AbortError" ? "timeout" : e.message; }
    }
    if (!got) batch.forEach(s => { errors[s] = lastErr; });
  }
  return { out, errors };
}
