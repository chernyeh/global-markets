// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST — pure calculations, shared by the browser and the server check
// ═══════════════════════════════════════════════════════════════════════════════
// No React, no fetch: price statistics from a daily close series, the price
// levels set in Gloomberg (watchlist alert price, thesis Munger/entry/exit/
// invalidation, holding target/stop), alert rules, group baskets and news counts.

import { majorCurrency, termRegex } from "./data/watchMarkets.js";

const DAY = 86400000;
const num = v => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const pct = (a, b) => (a !== null && b ? (a / b - 1) * 100 : null);
const r4 = v => (v === null ? null : Number(v.toPrecision(6)));

// ─── Prices ─────────────────────────────────────────────────────────────────
// `s` = { points: [["YYYY-MM-DD", close|null], ...], currency, time } as the
// Yahoo adapter in api/macro.js returns it. Minor-unit quotes (GBp) become
// major units so they compare with levels stored in Gloomberg.
export function seriesStats(s) {
  if (!s?.points?.length) return null;
  const { ccy, div } = majorCurrency(s.currency);
  const pts = s.points.filter(p => typeof p[1] === "number" && Number.isFinite(p[1]) && p[1] > 0).map(p => [p[0], p[1] / div]);
  const n = pts.length;
  if (n < 2) return null;
  const last = pts[n - 1][1];
  const lastDate = pts[n - 1][0];
  const back = k => (n - 1 - k >= 0 ? pts[n - 1 - k][1] : null);
  const yr = lastDate.slice(0, 4);
  let prevYr = null;
  for (let i = n - 1; i >= 0; i--) if (pts[i][0] < `${yr}-01-01`) { prevYr = pts[i][1]; break; }
  const win = pts.slice(-252).map(p => p[1]);
  const hi52 = Math.max(...win), lo52 = Math.min(...win);
  // Today's move against the spread of the 60 sessions before it.
  const rets = [];
  for (let i = Math.max(1, n - 61); i < n - 1; i++) rets.push(Math.log(pts[i][1] / pts[i - 1][1]));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const r1 = Math.log(last / back(1));
  const spark = [];
  for (let i = n - 1; i >= 0 && spark.length < 53; i -= 5) spark.unshift([pts[i][0], r4(pts[i][1])]);
  return {
    last: r4(last), prev: r4(back(1)), lastDate, time: s.time || null, currency: ccy,
    chg1d: pct(last, back(1)), chg1w: pct(last, back(5)), chg1m: pct(last, back(21)), chg3m: pct(last, back(63)),
    ytd: pct(last, prevYr), chg1y: n >= 200 ? pct(last, pts[Math.max(0, n - 253)][1]) : null,
    hi52: r4(hi52), lo52: r4(lo52), pos52: hi52 > lo52 ? (last - lo52) / (hi52 - lo52) : null, offHi: pct(last, hi52),
    z1d: rets.length >= 30 && sd > 0 ? r1 / sd : null, spark, n,
  };
}

export const daysSince = (isoDate, now = Date.now()) => (isoDate ? Math.floor((now - Date.parse(`${isoDate}T00:00:00Z`)) / DAY) : null);

// A price is stale when the market should have traded since: more than
// 5 calendar days covers a weekend plus a holiday or two.
export const isStale = (q, now = Date.now()) => !!q?.lastDate && daysSince(q.lastDate, now) > 5;

// ─── Levels ─────────────────────────────────────────────────────────────────
// side: buy = triggers at or below (Gloomberg's alert_price is a target BUY
// price, triggered when price drops to/below it); sell = at or above;
// risk = at or below, and worse than a buy level.
const sameCcy = (a, b) => !a || !b || majorCurrency(a).ccy === majorCurrency(b).ccy;

// A level more than 20× away from the price is almost certainly in the wrong
// unit (pence vs pounds, or a stale split): shown, flagged, never alerted.
export function levelsFor({ watch, hold, thesis }, quoteCcy, price = null) {
  const out = [];
  const add = (key, label, value, side, src, ccy) => {
    const raw = num(value);
    if (raw === null || raw <= 0) return;
    const { ccy: major, div } = majorCurrency(ccy);
    const v = raw / div;
    const dup = out.find(l => l.side === side && Math.abs(l.value / v - 1) < 0.001);
    if (dup) { dup.label = `${dup.label} = ${label}`; return; }
    const unitsOff = !!price && (v / price > 20 || price / v > 20);
    out.push({ key, label, value: v, side, src, ccy: ccy ? major : null, ccyOk: sameCcy(ccy, quoteCcy) && !unitsOff, unitsOff });
  };
  if (watch) add("alert", "alert price", watch.alert_price, "buy", "Gloomberg watchlist");
  if (thesis) {
    const tc = thesis.price_currency;
    add("entry", "entry", thesis.entry_price, "buy", "thesis", thesis.entry_price_currency || tc);
    add("munger", "Munger", thesis.munger_price, "buy", "thesis", tc);
    add("exit", "exit", thesis.exit_price, "sell", "thesis", tc);
    add("inval", "invalidation", thesis.invalidation_trigger_price, "risk", "thesis", tc);
  }
  if (hold) {
    add("target", "target", hold.target_price, "sell", "holding", hold.currency);
    add("stop", "stop-loss", hold.stop_loss, "risk", "holding", hold.currency);
  }
  return out;
}

export const isMet = (lv, price) => (lv.side === "sell" ? price >= lv.value : price <= lv.value);
export const levelDist = (lv, price) => (price && lv.value ? (price / lv.value - 1) * 100 : null);
// The move the price needs to reach the level, as analysts quote upside or
// downside to a target: −3% = it must fall 3%; +12% = 12% upside.
export const moveTo = (lv, price) => (price && lv.value ? (lv.value / price - 1) * 100 : null);

// The level worth showing in the row: one that is met (risk first, then buy,
// then sell), else the closest by distance.
export function nearestLevel(levels, price) {
  if (!price) return null;
  const ok = levels.filter(l => l.ccyOk);
  const met = ok.filter(l => isMet(l, price));
  const rank = { risk: 0, buy: 1, sell: 2 };
  if (met.length) { const m = met.sort((a, b) => rank[a.side] - rank[b.side])[0]; return { ...m, met: true, dist: levelDist(m, price), move: moveTo(m, price) }; }
  const near = ok.map(l => ({ ...l, met: false, dist: levelDist(l, price), move: moveTo(l, price) })).sort((a, b) => Math.abs(a.move) - Math.abs(b.move));
  return near[0] || null;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
// Fire once when a level is crossed, not while it stays crossed. A crossed
// level re-arms only after the price moves 1% back the other side, so a price
// hovering on the line doesn't ping. Levels and names seen for the first time
// are recorded silently (no flood on the first load or after adding a name).
// A move alert fires once per name per trading day.
export const DEFAULT_PREFS = { tgLevels: true, tgMoves: false, sigma: 3, minMovePct: 2 };

const fmtPx = v => (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 10 ? v.toFixed(2) : v.toPrecision(3));
const fmtPct = v => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}%`;

export function evaluateWatchAlerts(prev, rows, { now = Date.now(), prefs = DEFAULT_PREFS } = {}) {
  const p = { ...DEFAULT_PREFS, ...(prefs || {}) };
  const first = !prev?.init;
  const levels = {}, moves = { ...(prev?.moves || {}) };
  const fresh = [];
  for (const r of rows) {
    const q = r.q;
    if (!q?.last) continue;
    const name = r.name || r.ticker;
    for (const lv of r.levels || []) {
      if (!lv.ccyOk) continue;
      const k = `${r.ticker}|${lv.key}`;
      const was = prev?.levels?.[k];
      let met = isMet(lv, q.last);
      if (was && !met && Math.abs(levelDist(lv, q.last)) < 1) met = true;
      levels[k] = met;
      if (!first && met && was === false && !r.mute) {
        const verb = lv.side === "sell" ? "reached your" : lv.side === "risk" ? "fell through your" : "is at your";
        fresh.push({ id: `${now}-${k}`, at: now, kind: "watch", ref: k, ticker: r.ticker, type: "level", side: lv.side,
          sev: lv.side === "risk" ? "act" : "watch",
          title: `${name} ${verb} ${lv.label} (${q.currency || ""} ${fmtPx(lv.value)})`.replace(/\s+/g, " "),
          detail: `${r.ticker} at ${q.currency || ""} ${fmtPx(q.last)}${q.chg1d !== null ? `, ${fmtPct(q.chg1d)} on the day` : ""}. Level from ${lv.src}.` });
      }
    }
    if (q.z1d !== null && Math.abs(q.z1d) >= p.sigma && Math.abs(q.chg1d || 0) >= p.minMovePct) {
      if (!first && moves[r.ticker] !== q.lastDate && !r.mute) {
        const rel = r.benchQ?.chg1d !== null && r.benchQ?.chg1d !== undefined ? ` (${r.benchLabel || "index"} ${fmtPct(r.benchQ.chg1d)})` : "";
        fresh.push({ id: `${now}-${r.ticker}|move`, at: now, kind: "watch", ref: `${r.ticker}|move`, ticker: r.ticker, type: "move", sev: "info",
          title: `${name} ${fmtPct(q.chg1d)} — a ${Math.abs(q.z1d).toFixed(1)}σ move`,
          detail: `${r.ticker} at ${q.currency || ""} ${fmtPx(q.last)} on ${q.lastDate}${rel}. σ = spread of the previous 60 daily moves.` });
      }
      moves[r.ticker] = q.lastDate;
    }
  }
  // Keep only a month of move markers.
  const cutoff = new Date(now - 31 * DAY).toISOString().slice(0, 10);
  Object.keys(moves).forEach(t => { if (moves[t] < cutoff) delete moves[t]; });
  return { state: { init: true, levels, moves, at: now }, fresh };
}

export const pushable = (a, prefs = DEFAULT_PREFS) => {
  const p = { ...DEFAULT_PREFS, ...(prefs || {}) };
  return a.type === "move" ? !!p.tgMoves : !!p.tgLevels;
};

// ─── Groups ─────────────────────────────────────────────────────────────────
// Equal-weighted average of members' moves — a basket you can read as a gauge.
const FIELDS = ["chg1d", "chg1w", "chg1m", "ytd", "rel1m"];
export function basket(rows) {
  const out = { n: rows.length };
  for (const f of FIELDS) {
    const vals = rows.map(r => (f === "rel1m" ? r.rel1m : r.q?.[f])).filter(v => v !== null && v !== undefined && Number.isFinite(v));
    out[f] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    if (f === "chg1d") out.priced = vals.length;
  }
  return out;
}

// ─── News ───────────────────────────────────────────────────────────────────
export const normTitle = t => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 70);

export function mergeNews(lists) {
  const seen = new Set(), out = [];
  for (const it of lists.flat()) {
    const k = normTitle(it.title);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(it);
  }
  return out.sort((a, b) => b.ts - a.ts);
}

// Unusual flow: at least 3 stories in 24h and 2.5× the daily rate of the six days before.
// `server` = counts over the whole feed before it was trimmed for display:
// { n24, n7, perDay, capped }. perDay is the usual daily rate (null when a busy
// name's 100-story page covers under 1.5 days, so no baseline exists).
export function newsStats(items, now = Date.now(), server = null) {
  const n24 = Math.max(items.filter(i => now - i.ts <= DAY).length, server?.n24 || 0);
  const n7 = Math.max(items.filter(i => now - i.ts <= 7 * DAY).length, server?.n7 || 0);
  const perDay = server && "perDay" in server ? server.perDay : (n7 - n24) / 6;
  const surge = perDay !== null && n24 >= 3 && n24 >= 2.5 * Math.max(1, perDay);
  return { n24, n7, perDay, capped: !!server?.capped, surge };
}

// Stories from the app's own feeds that name the company.
export function feedMatches(articles, terms, now = Date.now()) {
  const re = termRegex(terms);
  if (!re) return [];
  const out = [];
  for (const a of articles) {
    const ts = a.pubDate ? Date.parse(a.pubDate) : a.fetchedAt || null;
    const t = Number.isFinite(ts) ? ts : null;
    if (!t || now - t > 7 * DAY) continue;
    const title = a.translatedTitle || a.title;
    if (re.test(title) || (a.translatedTitle && re.test(a.title))) {
      out.push({ title, link: a.link, outlet: a.source, ts: t, lang: a.translatedTitle ? "local" : "en", feed: true });
    }
  }
  return out;
}
