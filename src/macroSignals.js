// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — signal evaluation and scenario tally
// ═══════════════════════════════════════════════════════════════════════════════
// evaluateSignals(resolved, { manual, pasted }) → { [signalId]: result }
//   result = { status, value, detail, asOf, lean? }
//   status: "met" | "partial" | "not" | "na" (no data) | "unset" (manual, not yet set)
// Definitions and wording live in src/data/macroSignals.js.

import { SIGNALS, SCENARIOS } from "./data/macroSignals.js";
import { monthlyChanges, round1, valueAtOrBefore, isoDay } from "./macroData.js";
import { breadth } from "./macroInflation.js";
import { rule10Signal } from "./macroRule10.js";

const DAY = 86400000;
export const PASTE_LIFE_MS = 21 * DAY;
const f2 = v => (v === null || v === undefined ? "—" : v.toFixed(2));
const sgn = (v, dp = 0) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}`);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monLabel = ym => MON[Number(ym.slice(5, 7)) - 1];
const dayLabel = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;

const na = (S, ids) => {
  const missing = ids.filter(id => !S[id]?.points?.length);
  if (!missing.length) return null;
  const needsKey = missing.some(id => (S[id]?.error || "").includes("FRED_API_KEY") ||
    (S[id]?.inputs || []).some(k => (S[k]?.error || "").includes("FRED_API_KEY")));
  return { status: "na", value: needsKey ? "needs FRED key" : "no data", detail: missing.map(id => `${S[id]?.label || id}: ${S[id]?.error || "unavailable"}`).join(" · ") };
};

// Change over the last `n` observations (in raw units).
const sessionsChange = (pts, n) => (pts.length > n ? pts[pts.length - 1][1] - pts[pts.length - 1 - n][1] : null);
const windowPts = (pts, days) => {
  if (!pts.length) return [];
  const from = isoDay(Date.parse(`${pts[pts.length - 1][0]}T00:00:00Z`) - days * DAY);
  return pts.filter(p => p[0] >= from);
};

function oatBundNow(S, pasted) {
  const m = S.oatBund;
  const p = pasted?.oatBund;
  const monthly = m?.points?.length ? { v: m.last, label: `${monLabel(m.lastDate.slice(0, 7))} avg, ECB`, asOf: m.lastDate } : null;
  // A paste wins when it is dated in a later month than the latest monthly
  // average, and lapses after 21 days so an old paste can't masquerade as current.
  const fresh = p && typeof p.v === "number" && p.at && Date.now() - p.at < PASTE_LIFE_MS;
  const pastedDay = fresh ? isoDay(p.at) : null;
  if (pastedDay && (!monthly || pastedDay.slice(0, 7) > monthly.asOf.slice(0, 7))) {
    return { v: p.v, label: `pasted ${dayLabel(pastedDay)}`, asOf: pastedDay };
  }
  return monthly;
}

const EVAL = {
  s2(S) {
    const miss = na(S, ["coreCpi"]); if (miss) return miss;
    const ch = monthlyChanges(S.coreCpi.points).filter(c => c.mom !== null);
    if (ch.length < 2) return { status: "na", value: "too few prints" };
    const last3 = ch.slice(-3);
    const vals = last3.map(c => round1(c.mom));
    const [a, b] = vals.slice(-2);
    const consecutive = last3.length >= 2;
    const status = consecutive && a <= 0.2 && b <= 0.2 ? "met" : b <= 0.2 ? "partial" : "not";
    return { status, value: `${vals.map(v => v.toFixed(1)).join(" · ")} (${monLabel(last3[0].month)}–${monLabel(last3[last3.length - 1].month)})`,
      lean: a >= 0.3 && b >= 0.3 ? ["sticky"] : undefined, asOf: last3[last3.length - 1].month };
  },
  s3(S) {
    const miss = na(S, ["corePce"]); if (miss) return miss;
    const ch = monthlyChanges(S.corePce.points).filter(c => c.ann3m !== null).slice(-4);
    if (ch.length < 4) return { status: "na", value: "too few prints" };
    const a = ch.map(c => c.ann3m);
    const d1 = a[3] < a[2], d2 = a[2] < a[1], d3 = a[1] < a[0];
    return { status: d1 && d2 && d3 ? "met" : d1 && d2 ? "partial" : "not",
      value: `3m ann ${a.map(v => v.toFixed(1)).join(" → ")}`, asOf: ch[3].month,
      detail: `${monLabel(ch[0].month)}–${monLabel(ch[3].month)}; each arrow should point lower` };
  },
  s4(S) {
    const b = breadth(S);
    const L = b.latest;
    if (!L) {
      const err = S.sa_SEHC?.error || "";
      return { status: "na", value: /BLS_API_KEY|FRED_API_KEY|quota/.test(err) ? "needs BLS key" : "no data",
        detail: "19 Nov note (Aug–Oct): ≈70% by weight · ≈50% by count · ≈45% ex-OER above 3%" };
    }
    const prev = b.ann[b.ann.length - 2], three = b.ann[b.ann.length - 4];
    const status = L.w < 50 && (!three || L.w < three.w) ? "met"
      : (prev && L.w <= prev.w - 5) || L.w < 60 ? "partial" : "not";
    return { status, asOf: L.month, lean: L.w >= 70 ? ["sticky"] : undefined,
      value: `${L.w.toFixed(0)}% by weight · ${L.n.toFixed(0)}% by count · ${L.exOer.toFixed(0)}% ex-OER (3m ann., ${monLabel(L.month)})`,
      detail: `${L.covN} items, ${L.covW.toFixed(1)}pp of CPI${three ? `; 3 months earlier ${three.w.toFixed(0)}% by weight` : ""}` };
  },
  s17(S, { pasted }) {
    return rule10Signal(S, pasted?.consensus || {}, new Date().toISOString().slice(0, 10));
  },
  s5(S) {
    const miss = na(S, ["tp10y"]); if (miss) return miss;
    const t = S.tp10y;
    return { status: t.last < 0.8 ? "met" : t.last < 0.9 || (t.chg1m !== null && t.chg1m <= -15) ? "partial" : "not",
      value: `${f2(t.last)}% (1m ${sgn(t.chg1m)}bp)`, asOf: t.lastDate };
  },
  s7(S) {
    const miss = na(S, ["brent"]); if (miss) return miss;
    const pts = S.brent.points;
    let below = 0;
    for (let i = pts.length - 1; i >= 0 && pts[i][1] < 90; i--) below++;
    const c = S.brentCurve;
    let easing = null, curveTxt = "curve n/a";
    if (c?.points?.length) {
      const m1 = valueAtOrBefore(c.points, isoDay(Date.parse(`${c.lastDate}T00:00:00Z`) - 30 * DAY));
      if (m1) { easing = c.last < m1[1]; curveTxt = `M1–M6 ${sgn(c.last, 2)} (1m ago ${sgn(m1[1], 2)})`; }
    }
    const status = below >= 5 && easing === true ? "met" : below > 0 ? "partial" : "not";
    return { status, value: `$${f2(S.brent.last)} · ${below} session${below === 1 ? "" : "s"} < $90 · ${curveTxt}`, asOf: S.brent.lastDate };
  },
  s8(S, { pasted }) {
    const x = oatBundNow(S, pasted);
    if (!x) return { status: "na", value: "no data — paste a daily spread" };
    return { status: x.v < 100 ? "met" : x.v < 120 ? "partial" : "not", value: `${Math.round(x.v)}bp (${x.label})`, asOf: x.asOf };
  },
  s8b(S, { pasted }) {
    const x = oatBundNow(S, pasted);
    if (!x) return { status: "na", value: "no data — paste a daily spread" };
    return { status: x.v > 200 ? "met" : x.v > 175 ? "partial" : "not", value: `${Math.round(x.v)}bp (${x.label})`, asOf: x.asOf };
  },
  s10(S) {
    const miss = na(S, ["bei10y"]); if (miss) return miss;
    const b = S.bei10y;
    return { status: b.last > 2.5 ? "met" : b.last > 2.4 ? "partial" : "not", value: `${f2(b.last)}% (1m ${sgn(b.chg1m)}bp)`, asOf: b.lastDate };
  },
  s11(S) {
    const miss = na(S, ["real10y"]); if (miss) return miss;
    const r = S.real10y;
    return { status: r.last > 3.15 ? "met" : r.last >= 3.0 ? "partial" : "not", value: `${f2(r.last)}% (${Math.round((3.15 - r.last) * 100)}bp below record)`, asOf: r.lastDate };
  },
  s12(S) {
    const miss = na(S, ["ust10y"]); if (miss) return miss;
    const y = S.ust10y;
    const gap = Math.round((5.36 - y.last) * 100);
    return { status: y.last > 5.36 ? "met" : y.last >= 5.25 ? "partial" : "not",
      value: `${f2(y.last)}% (${gap >= 0 ? `${gap}bp below` : `${-gap}bp above`} 5.36)`, asOf: y.lastDate };
  },
  s13(S) {
    const miss = na(S, ["igOas", "hyOas"]); if (miss) return miss;
    const ig = S.igOas, hy = S.hyOas;
    const igHit = ig.chg1m !== null && ig.chg1m >= 20, hyHit = hy.chg1m !== null && hy.chg1m >= 50;
    return { status: igHit && hyHit ? "met" : igHit || hyHit ? "partial" : "not",
      value: `IG ${Math.round(ig.last)}bp (1m ${sgn(ig.chg1m)}) · HY ${Math.round(hy.last)}bp (1m ${sgn(hy.chg1m)})`, asOf: hy.lastDate };
  },
  s14(S) {
    const miss = na(S, ["ust2y", "ust10y"]); if (miss) return miss;
    const d2 = sessionsChange(S.ust2y.points, 5), d10 = sessionsChange(S.ust10y.points, 5);
    if (d2 === null || d10 === null) return { status: "na", value: "too few sessions" };
    const b2 = d2 * 100, b10 = d10 * 100, steep = b10 - b2;
    return { status: b2 <= -20 && steep >= 10 ? "met" : b2 <= -10 && steep >= 5 ? "partial" : "not",
      value: `5 sessions: 2y ${sgn(b2)}bp, 10y ${sgn(b10)}bp (curve ${sgn(steep)}bp)`, asOf: S.ust2y.lastDate };
  },
  s16(S) {
    const miss = na(S, ["hyOas"]); if (miss) return miss;
    const hy = windowPts(S.hyOas.points, 92);
    let peakIdx = 0;
    hy.forEach((p, i) => { if (p[1] > hy[peakIdx][1]) peakIdx = i; });
    const peak = hy[peakIdx][1];
    const lowBefore = Math.min(...hy.slice(0, peakIdx + 1).map(p => p[1]));
    const last = hy[hy.length - 1][1];
    const gapped = peak - lowBefore >= 100;
    const offPeak = gapped && last <= peak * 0.9;
    const breadth = S.ewRatio?.chg1m !== null && S.ewRatio?.chg1m !== undefined ? S.ewRatio.chg1m > 0 : null;
    let calmer = null;
    if (S.vix?.points?.length && S.spx?.points?.length) {
      const v = windowPts(S.vix.points, 92), s = windowPts(S.spx.points, 92);
      calmer = S.vix.last <= 0.75 * Math.max(...v.map(p => p[1])) && S.spx.last <= 1.03 * Math.min(...s.map(p => p[1]));
    }
    const mark = b => (b === null ? "–" : b ? "✓" : "✗");
    const status = gapped && offPeak && breadth ? "met" : gapped || (breadth && calmer) ? "partial" : "not";
    return { status, asOf: S.hyOas.lastDate,
      value: `${mark(gapped)} spreads gapped · ${mark(offPeak)} off peak · ${mark(breadth)} breadth · ${mark(calmer)} calmer lows`,
      detail: `HY OAS 3m low→peak ${Math.round(lowBefore)}→${Math.round(peak)}bp, now ${Math.round(last)}bp` };
  },
  s18(S) {
    const miss = na(S, ["usdsgd"]); if (miss) return miss;
    const pts = S.usdsgd.points;
    const d = pts.length > 10 ? (pts[pts.length - 1][1] / pts[pts.length - 11][1] - 1) * 100 : null;
    if (d === null) return { status: "na", value: "too few sessions" };
    return { status: d >= 2 ? "met" : d >= 1 ? "partial" : "not", value: `${S.usdsgd.last.toFixed(4)} (10 sessions ${sgn(d, 1)}%)`, asOf: S.usdsgd.lastDate };
  },
};

export function evaluateSignals(S, { manual = {}, pasted = {} } = {}) {
  const out = {};
  for (const sig of SIGNALS) {
    if (sig.auto && EVAL[sig.id]) {
      try { out[sig.id] = EVAL[sig.id](S, { pasted }); }
      catch (e) { out[sig.id] = { status: "na", value: "evaluation error", detail: e.message }; }
    } else {
      const m = manual[sig.id];
      out[sig.id] = m?.status
        ? { status: m.status, value: m.note || "set by you", asOf: m.at ? isoDay(m.at) : null, manual: true }
        : { status: "unset", value: sig.preset || "your call — click to set", manual: true };
    }
  }
  return out;
}

// Evidence for and against each scenario. Weights stay the reader's judgement;
// this only counts what the signals say.
export function scenarioTally(results) {
  const t = Object.fromEntries(SCENARIOS.map(s => [s.id, { for: [], partial: [], against: [] }]));
  for (const sig of SIGNALS) {
    const r = results[sig.id];
    if (!r) continue;
    if (r.status === "met") {
      (sig.supports || []).forEach(id => t[id]?.for.push(sig.n));
      (sig.contradicts || []).forEach(id => t[id]?.against.push(sig.n));
    } else if (r.status === "partial") {
      (sig.supports || []).forEach(id => t[id]?.partial.push(sig.n));
    }
    (r.lean || []).forEach(id => { if (!t[id]?.for.includes(sig.n)) t[id]?.for.push(sig.n); });
  }
  return t;
}
