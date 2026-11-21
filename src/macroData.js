// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — fetching and resolving the indicator registry
// ═══════════════════════════════════════════════════════════════════════════════
// fetchMacro() asks /api/macro for every source in the registry (one request per
// source and history length). resolveMacro() turns the raw responses into one
// series per registry entry: first source with data wins, scale applied, derived
// series computed, and the latest level and changes worked out.

import { MACRO_SERIES } from "./data/macroSeries.js";

const DAY = 86400000;
export const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const dayMs = d => Date.parse(`${d}T00:00:00Z`);

// History requested per frequency: daily ≈13 months; monthly 3 years so that
// m/m, 3-month annualised and y/y can all be computed with a gap or two.
const START_DAYS = { D: 400, M: 1100 };

// Group registry sources into requests: { src, start, ids }.
export function buildRequests(registry = MACRO_SERIES, now = Date.now()) {
  const groups = {};
  for (const def of Object.values(registry)) {
    for (const [src, key] of def.src || []) {
      const freq = def.freq || "D";
      // Treasury, MoF and Yahoo return a fixed history; one request each.
      const k = ["treasury", "mof", "yahoo", "cbw"].includes(src) ? src : `${src}|${freq}`;
      (groups[k] ||= { src, start: isoDay(now - START_DAYS[freq] * DAY), ids: new Set() }).ids.add(key);
    }
  }
  groups.cbw = { src: "cbw", start: null, ids: new Set(["fed", "ecb"]) };
  return Object.values(groups).map(g => ({ ...g, ids: [...g.ids] }));
}

async function fetchOne(req, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const qs = `src=${encodeURIComponent(req.src)}&ids=${encodeURIComponent(req.ids.join(","))}${req.start ? `&start=${req.start}` : ""}`;
  try {
    const r = await fetch(`/api/macro?${qs}`, { signal: ctl.signal });
    const body = await r.json().catch(() => null);
    if (!r.ok || !body) throw new Error(body?.error || `HTTP ${r.status}`);
    return body;
  } finally { clearTimeout(timer); }
}

// → { fetchedAt, sources: { [src]: { series, paths, errors, tier, fetchedAt } }, health: { [src]: {...} } }
export async function fetchMacro({ timeoutMs = 32000 } = {}) {
  const reqs = buildRequests();
  const res = await Promise.allSettled(reqs.map(r => fetchOne(r, timeoutMs)));
  const sources = {}, health = {};
  reqs.forEach((req, i) => {
    const s = (sources[req.src] ||= { series: {}, paths: {}, errors: {} });
    const h = (health[req.src] ||= { requested: 0, ok: 0, errors: {}, error: null, fetchedAt: null });
    h.requested += req.ids.length;
    const r = res[i];
    if (r.status === "fulfilled") {
      Object.assign(s.series, r.value.series || {});
      Object.assign(s.paths, r.value.paths || {});
      Object.assign(s.errors, r.value.errors || {});
      Object.assign(h.errors, r.value.errors || {});
      h.ok += Object.keys(r.value.series || r.value.paths || {}).length;
      h.fetchedAt = r.value.fetchedAt || Date.now();
      s.tier = r.value.tier;
    } else {
      h.error = r.reason?.name === "AbortError" ? "timeout" : (r.reason?.message || "request failed");
      req.ids.forEach(id => { h.errors[id] = h.error; });
    }
  });
  return { fetchedAt: Date.now(), sources, health };
}

// Merge a fresh fetch into the stored one: a source that failed this time keeps
// its last good series (marked by their own asOf dates), so a transient outage
// shows stale-but-dated data rather than blanks.
export function mergeMacro(prev, next) {
  if (!prev?.sources) return next;
  const sources = { ...next.sources };
  for (const [src, old] of Object.entries(prev.sources)) {
    const cur = sources[src] || { series: {}, paths: {}, errors: {} };
    sources[src] = {
      ...cur,
      series: { ...old.series, ...cur.series },
      paths: { ...old.paths, ...cur.paths },
      carried: Object.keys(old.series || {}).filter(k => !cur.series?.[k]),
    };
  }
  return { ...next, sources };
}

// ─── Resolution ───────────────────────────────────────────────────────────
const clean = pts => (pts || []).filter(p => p && p[0] && typeof p[1] === "number" && Number.isFinite(p[1]));

function combine(op, A, B, scale = 1) {
  const bm = new Map(B.map(p => [p[0], p[1]]));
  return A.filter(p => bm.has(p[0])).map(([d, a]) => {
    const b = bm.get(d);
    const v = op === "sub" ? (a - b) * scale : b ? (a / b) * scale : null;
    return [d, v];
  }).filter(p => p[1] !== null);
}

// Value on the last date at or before `date`.
export function valueAtOrBefore(points, date) {
  for (let i = points.length - 1; i >= 0; i--) if (points[i][0] <= date) return points[i];
  return null;
}

function withStats(def, points) {
  const n = points.length;
  if (!n) return { ...def, points, last: null };
  const [lastDate, last] = points[n - 1];
  const prev = n > 1 ? points[n - 2] : null;
  const m1 = valueAtOrBefore(points, isoDay(dayMs(lastDate) - 30 * DAY));
  const diff = (a, b) => {
    if (b === null || b === undefined) return null;
    if (def.chg === "pct") return b ? (a / b - 1) * 100 : null;
    if (def.chg === "bp" && def.unit === "%") return (a - b) * 100;
    return a - b;
  };
  // Monthly series: the previous observation *is* the 1-month change; there is no daily one.
  if (def.freq === "M") {
    return { ...def, points, last, lastDate, prevDate: prev?.[0] || null, chg1d: null, chg1m: prev ? diff(last, prev[1]) : null };
  }
  return {
    ...def, points, last, lastDate,
    prevDate: prev?.[0] || null,
    chg1d: prev ? diff(last, prev[1]) : null,
    chg1m: m1 && m1[0] !== lastDate ? diff(last, m1[1]) : null,
  };
}

// → { [id]: { ...def, id, points, last, lastDate, chg1d, chg1m, srcUsed, srcKey, fallback, asOf } }
export function resolveMacro(raw, registry = MACRO_SERIES) {
  const out = {};
  const sources = raw?.sources || {};
  // Plain series first…
  for (const [id, def] of Object.entries(registry)) {
    if (def.derived) continue;
    let used = null;
    for (let i = 0; i < (def.src || []).length; i++) {
      const [src, key] = def.src[i];
      const s = sources[src]?.series?.[key];
      const pts = clean(s?.points);
      if (pts.length) {
        const scaled = def.scale ? pts.map(([d, v]) => [d, v * def.scale]) : pts;
        used = { points: scaled, srcUsed: src, srcKey: key, fallback: i > 0, time: s.time || null,
                 carried: (sources[src]?.carried || []).includes(key) };
        break;
      }
    }
    const firstErr = (def.src || []).map(([src, key]) => sources[src]?.errors?.[key]).find(Boolean) || null;
    out[id] = { id, ...withStats(def, used?.points || []), srcUsed: used?.srcUsed || null, srcKey: used?.srcKey || null,
                fallback: !!used?.fallback, time: used?.time || null, carried: !!used?.carried, error: used ? null : firstErr };
  }
  // …then derived ones (inputs may themselves be fallbacks).
  for (const [id, def] of Object.entries(registry)) {
    if (!def.derived) continue;
    const { op, a, b, scale, sameSrc } = def.derived;
    const A = out[a]?.points || [], B = out[b]?.points || [];
    // sameSrc: both legs must come from the same source (e.g. two futures contracts),
    // never a futures price against a spot fallback.
    const mismatch = sameSrc && out[a]?.srcUsed && out[b]?.srcUsed && out[a].srcUsed !== out[b].srcUsed;
    const pts = A.length && B.length && !mismatch ? combine(op, A, B, scale) : [];
    out[id] = { id, ...withStats(def, pts), srcUsed: "derived", inputs: [a, b],
                fallback: !!(out[a]?.fallback || out[b]?.fallback),
                error: pts.length ? null : `needs ${[a, b].filter(k => !out[k]?.points?.length).join(" and ")}` };
  }
  return out;
}

// ─── Monthly index transforms (CPI, PCE) ────────────────────────────────────
// m/m % for each month that has the previous month too. Missing months (e.g.
// Oct 2025, not collected during the shutdown) leave a gap instead of a value
// computed across two months.
const monthKey = d => d.slice(0, 7);
const prevMonth = ym => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const monthsBack = (ym, n) => { let k = ym; for (let i = 0; i < n; i++) k = prevMonth(k); return k; };

export function monthlyChanges(points) {
  const byMonth = new Map(points.map(([d, v]) => [monthKey(d), v]));
  return points.map(([d, v]) => {
    const ym = monthKey(d);
    const p1 = byMonth.get(prevMonth(ym));
    const p3 = byMonth.get(monthsBack(ym, 3));
    const p12 = byMonth.get(monthsBack(ym, 12));
    return {
      month: ym,
      mom: p1 ? (v / p1 - 1) * 100 : null,
      ann3m: p3 ? (Math.pow(v / p3, 4) - 1) * 100 : null,
      yoy: p12 ? (v / p12 - 1) * 100 : null,
    };
  });
}

// BLS publishes m/m to one decimal; compare thresholds on the published figure.
export const round1 = v => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
