// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — Rule 10 on data releases (Phase 4, signal 17)
// ═══════════════════════════════════════════════════════════════════════════════
// Your rule 10: if good news fails to lift prices, treat it as a red flag (the
// trade is over-owned or the good news was already priced). For each release on
// the calendar with a consensus pasted, after the print:
//   surprise = actual − consensus (published rounding; lower inflation = good)
//   reaction = same-day S&P 500 % and 2y/10y bp (US); 10y Bund bp (euro area)
// Verdicts: good news lifted / FAILED to lift (red flag) / mixed; bad news hurt /
// did NOT hurt (a bottom-type marker from the playbook's "how to tell them
// apart" table); in line. Reaction waits until the day's close is in the data.

import { MACRO_EVENTS, releaseKey } from "./data/macroCalendar.js";
import { monthlyChanges, round1 } from "./macroData.js";

const pointOn = (s, date) => {
  const pts = s?.points || [];
  const i = pts.findIndex(p => p[0] === date);
  return i > 0 ? { v: pts[i][1], prev: pts[i - 1][1] } : null;
};

function actualFor(S, r) {
  const s = S[r.id];
  if (!s?.points?.length) return null;
  if (r.kind === "level") {
    const p = s.points.find(x => x[0].slice(0, 7) === r.ref);
    return p ? round1(p[1]) : null;
  }
  const c = monthlyChanges(s.points).find(x => x.month === r.ref);
  return c && c[r.kind] !== null ? round1(c[r.kind]) : null;
}

function reactionFor(S, e) {
  if (e.release.market === "eu") {
    const b = pointOn(S.bund10, e.date);
    return b ? { bund: (b.v - b.prev) * 100 } : null;
  }
  const spx = pointOn(S.spx, e.date), y10 = pointOn(S.ust10y, e.date), y2 = pointOn(S.ust2y, e.date);
  if (!spx || !y10) return null;
  return { spx: (spx.v / spx.prev - 1) * 100, y10: (y10.v - y10.prev) * 100, y2: y2 ? (y2.v - y2.prev) * 100 : null };
}

const sg = (v, dp = 0, u = "") => (v === null || v === undefined ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}${u}`);

export function releaseOutcomes(S, consensus = {}, today = new Date().toISOString().slice(0, 10)) {
  return MACRO_EVENTS.filter(e => e.release).map(e => {
    const key = releaseKey(e);
    const cons = consensus[key];
    const out = { event: e, key, consensus: cons ?? null, actual: null, surprise: null, reaction: null, verdict: e.date > today ? "upcoming" : "pending", text: "" };
    if (e.date > today) return out;
    out.actual = actualFor(S, e.release);
    if (out.actual === null) { out.text = "awaiting the print in the data"; return out; }
    if (!cons || typeof cons.v !== "number") { out.verdict = "no-consensus"; out.text = `${e.release.label} ${out.actual.toFixed(1)}% — paste the consensus to run the Rule-10 check`; return out; }
    out.surprise = Math.round((out.actual - cons.v) * 10) / 10;
    out.reaction = reactionFor(S, e);
    const good = e.release.better === "lower" ? out.surprise < 0 : out.surprise > 0;
    const bad = e.release.better === "lower" ? out.surprise > 0 : out.surprise < 0;
    const head = `${e.release.label} ${out.actual.toFixed(1)}% vs ${cons.v.toFixed(1)}% consensus${cons.src ? ` (${cons.src})` : ""}`;
    if (!out.reaction) { out.verdict = "pending"; out.text = `${head} — market reaction not in the data yet`; return out; }
    const r = out.reaction;
    const rx = e.release.market === "eu" ? `Bund 10y ${sg(r.bund, 0, "bp")}` : `S&P ${sg(r.spx, 1, "%")}, 10y ${sg(r.y10, 0, "bp")}${r.y2 !== null ? `, 2y ${sg(r.y2, 0, "bp")}` : ""}`;
    // "Lift" = equities up and yields down (US) / Bund yields down (euro area).
    const lifted = e.release.market === "eu" ? r.bund < 0 : r.spx > 0 && r.y10 < 0;
    const failed = e.release.market === "eu" ? r.bund >= 0 : r.spx <= 0 && r.y10 >= 0;
    const hurt = e.release.market === "eu" ? r.bund > 0 : r.spx < 0 || r.y10 > 0;
    if (good) out.verdict = lifted ? "good-lifted" : failed ? "good-failed" : "good-mixed";
    else if (bad) out.verdict = hurt ? "bad-hurt" : "bad-shrugged";
    else out.verdict = "in-line";
    const word = { "good-lifted": "good news lifted prices", "good-failed": "good news FAILED to lift — Rule 10 red flag", "good-mixed": "good news, mixed reaction",
      "bad-hurt": "bad news hurt", "bad-shrugged": "bad news did not hurt — a bottom-type marker", "in-line": "in line" }[out.verdict];
    out.text = `${head} on ${e.date} → ${rx}: ${word}`;
    return out;
  });
}

// Signal 17: the most recent benign surprise in the last 30 days decides it.
export function rule10Signal(S, consensus, today) {
  const outs = releaseOutcomes(S, consensus, today).filter(o => o.verdict !== "upcoming");
  const recent = outs.filter(o => (Date.parse(today) - Date.parse(o.event.date)) / 86400000 <= 30);
  const good = recent.filter(o => o.verdict.startsWith("good-")).sort((a, b) => (a.event.date < b.event.date ? 1 : -1))[0];
  if (good) {
    return { status: good.verdict === "good-failed" ? "met" : good.verdict === "good-mixed" ? "partial" : "not", value: good.text, asOf: good.event.date };
  }
  const waiting = recent.find(o => o.verdict === "pending" && o.surprise !== null && o.surprise < 0);
  if (waiting) return { status: "na", asOf: null, value: `${waiting.text} — check runs once the day's close is in` };
  const shrug = recent.find(o => o.verdict === "bad-shrugged");
  const anyCons = recent.some(o => o.consensus);
  return { status: "na", asOf: null,
    value: shrug ? `no benign surprise in 30 days; note: ${shrug.text}` : anyCons ? "no benign surprise in the last 30 days" : "paste the consensus on the calendar's CPI / PCE / PPI rows to run this check" };
}
