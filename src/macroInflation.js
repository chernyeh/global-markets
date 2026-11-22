// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — inflation detail logic (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════
// breadth(S)      core-services breadth by month: share of items above 3%, by
//                 weight, by count and excluding OER — on 3-month annualised SA
//                 changes (timely) and on y/y NSA changes (as BLS publishes).
// gasBaseEffects  what a flat pump price does to gasoline's y/y and to its
//                 contribution to headline CPI over the coming months.

import { BREADTH_ITEMS, BREADTH_THRESHOLD } from "./data/macroInflation.js";
import { monthlyChanges } from "./macroData.js";

const changesFor = s => (s?.points?.length ? new Map(monthlyChanges(s.points).map(c => [c.month, c])) : null);
const isNsa = s => String(s?.srcKey || "").startsWith("CUUR");

// → { items: [{ ...item, mom:[{month,v}], ann3m, yoy, month, nsaFallback }], months: [{ month, basis, w, n, exOer, covW, covN }], latest }
export function breadth(S, { months = 6 } = {}) {
  const items = BREADTH_ITEMS.map(it => {
    const sa = S[`sa_${it.code}`], nsa = S[`nsa_${it.code}`];
    return { ...it, saCh: changesFor(sa), nsaCh: changesFor(nsa), nsaFallback: isNsa(sa), srcUsed: sa?.srcUsed || nsa?.srcUsed || null };
  });
  const allMonths = [...new Set(items.flatMap(it => [...(it.saCh?.keys() || []), ...(it.nsaCh?.keys() || [])]))].sort();
  const recent = allMonths.slice(-months);
  const measure = (month, basis) => {
    let w = 0, covW = 0, n = 0, covN = 0, wx = 0, covWx = 0;
    for (const it of items) {
      const v = basis === "ann3m" ? it.saCh?.get(month)?.ann3m : it.nsaCh?.get(month)?.yoy;
      if (v === null || v === undefined) continue;
      const above = v > BREADTH_THRESHOLD;
      covW += it.weight; covN++;
      if (above) { w += it.weight; n++; }
      if (it.code !== "SEHC") { covWx += it.weight; if (above) wx += it.weight; }
    }
    // Need most of the basket for a share to mean anything.
    if (covN < Math.ceil(items.length * 0.7)) return null;
    return { month, basis, w: (w / covW) * 100, n: (n / covN) * 100, exOer: covWx ? (wx / covWx) * 100 : null, covW, covN };
  };
  const series = basis => recent.map(m => measure(m, basis)).filter(Boolean);
  const ann = series("ann3m"), yoy = series("yoy");
  const latestMonth = ann.length ? ann[ann.length - 1].month : null;
  const rows = items.map(it => {
    const m = latestMonth;
    const moms = m ? [2, 1, 0].map(k => {
      const ym = shiftMonth(m, -k);
      return { month: ym, v: it.saCh?.get(ym)?.mom ?? null };
    }) : [];
    return { ...it, saCh: undefined, nsaCh: undefined, mom: moms,
      ann3m: m ? it.saCh?.get(m)?.ann3m ?? null : null,
      yoy: lastWith(it.nsaCh, "yoy") };
  });
  return { items: rows, ann, yoy, latest: ann[ann.length - 1] || null, latestYoy: yoy[yoy.length - 1] || null };
}

function shiftMonth(ym, k) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return d.toISOString().slice(0, 7);
}
function lastWith(map, key) {
  if (!map) return null;
  const vals = [...map.values()].filter(c => c[key] !== null && c[key] !== undefined);
  return vals.length ? { month: vals[vals.length - 1].month, v: vals[vals.length - 1][key] } : null;
}

// Gasoline base effects. price: assumed flat pump price ($/gal); weight:
// gasoline's CPI weight (%). For each coming month, gasoline y/y at that price
// against the year-ago average price, and the contribution to headline CPI
// y/y (weight × y/y). Compared with the latest actual month.
export function gasBaseEffects(S, { price, weight, months = 8 }) {
  const s = S.gasAvg;
  if (!s?.points?.length || !(price > 0) || !(weight > 0)) return null;
  const byMonth = new Map(s.points.map(([d, v]) => [d.slice(0, 7), v]));
  const lastM = s.lastDate.slice(0, 7);
  // Compare with the latest month that has a y/y — Oct 2026's base (Oct 2025)
  // was not collected, so the reference can be a month earlier.
  let refM = null, actualYoy = null;
  for (let k = 0; k < 4 && refM === null; k++) {
    const m = shiftMonth(lastM, -k), now = byMonth.get(m), ago = byMonth.get(shiftMonth(m, -12));
    if (now && ago) { refM = m; actualYoy = (now / ago - 1) * 100; }
  }
  const actualContrib = actualYoy !== null ? (weight / 100) * actualYoy : null;
  const rows = [];
  for (let k = 1; k <= months; k++) {
    const m = shiftMonth(lastM, k);
    const base = byMonth.get(shiftMonth(m, -12)) ?? null;
    const yoy = base ? (price / base - 1) * 100 : null;
    const contrib = yoy !== null ? (weight / 100) * yoy : null;
    rows.push({ month: m, base, yoy, contrib, vsLatest: contrib !== null && actualContrib !== null ? contrib - actualContrib : null });
  }
  return { lastMonth: lastM, lastPrice: s.last, refMonth: refM, actualYoy, actualContrib, rows };
}

// Value for one table row in one month. kind "level" reads a series that is
// already a rate; mom / ann3m / yoy are computed from an index. Returns
// { v, note } — note explains a blank (base month missing vs not published).
const changeCache = new WeakMap();
function changesOf(s) {
  if (!s?.points?.length) return null;
  let m = changeCache.get(s);
  if (!m) { m = new Map(monthlyChanges(s.points).map(c => [c.month, c])); changeCache.set(s, m); }
  return m;
}
export function printValue(S, row, month) {
  const s = S[row.id];
  if (!s?.points?.length) return { v: null, note: s?.error || "no data" };
  if (row.kind === "level") {
    const p = s.points.find(x => x[0].slice(0, 7) === month);
    return p ? { v: p[1] } : { v: null, note: "not yet published" };
  }
  const c = changesOf(s)?.get(month);
  if (!c) return { v: null, note: "not yet published" };
  const v = c[row.kind];
  return v === null || v === undefined ? { v: null, note: "base month missing — not computed (Oct 2025 was not collected)" } : { v };
}

// The last n months for which a series has data.
export function lastMonths(s, n = 4) {
  return s?.points?.length ? [...new Set(s.points.map(p => p[0].slice(0, 7)))].slice(-n) : [];
}
