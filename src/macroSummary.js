// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — the bottom line (plain answers, computed from the page's data)
// ═══════════════════════════════════════════════════════════════════════════════
// Six questions answered from the same numbers the cards below use — no model
// involved, so it is always current and never invents anything. The optional
// AI "Macro read" sits beside it for narrative.

import { SIGNALS, SIGNAL_GROUPS } from "./data/macroSignals.js";
import { buildCalendar, daysUntil, fmtDay, nextFomc, nextEcb, nextBoj } from "./data/macroCalendar.js";
import { monthlyChanges, round1 } from "./macroData.js";
import { leadStats, leadSummary } from "./macroLeadBanks.js";

export const UST10_HIGH = 5.36; // 7 Oct 2026 closing high (playbook rev 54); signal 12 uses the same level
const has = v => v !== null && v !== undefined && Number.isFinite(v);
const sgn = (v, dp = 0) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}`;
const firstSentence = s => String(s || "").split(/(?<=[.;:])\s/)[0].replace(/[.;:]$/, "");

export function groupCounts(results) {
  return Object.fromEntries(SIGNAL_GROUPS.map(g => {
    const sigs = SIGNALS.filter(s => s.group === g.id);
    const st = sigs.map(s => results[s.id]?.status);
    return [g.id, { total: sigs.length, met: st.filter(x => x === "met").length, partial: st.filter(x => x === "partial").length,
      unset: st.filter(x => x === "unset").length }];
  }));
}

// The market-implied move for a bank's next decision: the first priced row
// dated within three days of the official decision day (sources differ by a day).
export function nextPriced(path, decisionDay) {
  if (!path?.meetings?.length || !decisionDay) return null;
  const row = path.meetings.find(m => Math.abs(daysUntil(m.date, decisionDay)) <= 3);
  return row ? { ...row, date: decisionDay } : null;
}
const pricedText = (name, p) => {
  if (!p) return `${name}: n/a`;
  const dir = p.stepBp >= 0 ? "hike" : "cut";
  return `${name} ${fmtDay(p.date)}: ${has(p.pct) ? `${p.pct.toFixed(0)}% odds of a ${dir}` : `${sgn(p.stepBp)}bp priced`}`;
};

export function bottomLine({ S, results, paths, today, userEvents = [], due = [] }) {
  const g = groupCounts(results);
  const rows = [];

  // 1. Have bond yields peaked?
  const y = S.ust10y;
  const warn = SIGNALS.filter(s => s.group === "notin" && results[s.id]?.status === "met");
  let a, tone;
  if (warn.length) { a = "No — warning signs are on"; tone = "bad"; }
  else if (g.peak.met >= 4) { a = "Likely — most peak checks are met"; tone = "good"; }
  else if (g.peak.met + g.peak.partial >= 2) { a = "Early signs only"; tone = "warn"; }
  else { a = "Not confirmed yet"; tone = "neutral"; }
  const gap = has(y?.last) ? Math.round((UST10_HIGH - y.last) * 100) : null;
  rows.push({ id: "peak", q: "Have bond yields peaked?", a, tone,
    detail: [has(y?.last) && `10y ${y.last.toFixed(2)}%, ${gap >= 0 ? `${gap}bp below` : `${-gap}bp above`} the 5.36% high`,
      `peak checks met ${g.peak.met} of ${g.peak.total}`, `warnings ${g.notin.met} of ${g.notin.total}${warn.length ? ` (#${warn.map(s => s.n).join(", #")})` : ""}`].filter(Boolean).join(" · "),
    tip: { t: "Why this is the first question", d: "The playbook's regime is an inflation shock: the equity low comes when bond yields peak, not when the Fed cuts. The answer counts the board's peak checks and warnings below.",
      r: "\"Likely\" needs 4 of the 6 peak checks met and no warning; any warning met = \"No\"." } });

  // 2. What should I do?
  const met = SIGNALS.filter(s => results[s.id]?.status === "met");
  rows.push({ id: "act", q: "What does the playbook say to do?",
    a: met.length ? `${met.length} trigger${met.length > 1 ? "s" : ""} met — act on ${met.length > 1 ? "them" : "it"}, subject to the guard` : "Nothing new — no trigger is met, so no change to positioning",
    tone: met.length ? "act" : "neutral",
    detail: met.length ? met.map(s => `#${s.n} ${s.label}`).join(" · ") : `${g.peak.partial + g.notin.partial + g.risk.partial + g.defence.partial} partly met; ${Object.values(g).reduce((n, x) => n + x.unset, 0)} are your call to set`,
    extra: due.length ? `⏰ ${due.length} deferred decision${due.length > 1 ? "s" : ""} due — review in Alerts` : null,
    tip: met.length
      ? { t: "What the met triggers say to do", d: met.map(s => `#${s.n} ${s.label}: ${firstSentence(s.action)}.`).join(" "), r: "Each has a \"no action unless\" guard on the board — check it before acting, then log the decision on the alert." }
      : { t: "Triggers, not forecasts", d: "Each board row is a condition the playbook names in advance, with the action to take and a \"no action unless\" guard against acting on one print.",
        r: "Click a row on the board for its action and guard; log what you did on the alert." } });

  // 3. Central banks
  const nf = nextFomc(today), ne = nextEcb(today), nb = nextBoj(today);
  const pf = nextPriced(paths?.fed, nf?.end), pe = nextPriced(paths?.ecb, ne?.date), pb = nextPriced(paths?.boj, nb?.end);
  const tot = ["fed", "ecb", "boj"].map(b => paths?.[b]?.totalBp).filter(has);
  const lead = leadSummary(leadStats(S, paths, today), paths);
  rows.push({ id: "cb", q: "What will central banks do?",
    a: tot.length && tot.every(v => v > 0) ? "All three are still priced to hike" : tot.some(v => v < 0) ? "Mixed — some cuts priced" : "Next moves",
    tone: tot.length && tot.every(v => v > 0) ? "warn" : "neutral",
    detail: [pricedText("Fed", pf), pricedText("ECB", pe), pricedText("BoJ", pb)].join(" · "),
    extra: [["fed", "ecb", "boj"].map(b => has(paths?.[b]?.totalBp) ? `${b === "fed" ? "Fed" : b === "ecb" ? "ECB" : "BoJ"} ${sgn(paths[b].totalBp)}bp over ${paths[b].meetings.length} meetings` : null).filter(Boolean).join(" · "),
      lead.text && `Lead banks — ${lead.text}`].filter(Boolean).join(" · ") || null,
    tip: { t: "Market pricing, not forecasts", d: "Odds and basis points implied by overnight-index swaps (Central Bank Watch). Odds at later meetings are cumulative — don't add them. The lead-bank line counts the early movers' actual moves (BIS) and their futures pricing.",
      r: "Details, SOFR options and the officials' tone are in the Fed, ECB and BoJ cards; the early movers are in Lead central banks below them." } });

  // 4. Inflation
  const cc = S.coreCpi?.points?.length ? monthlyChanges(S.coreCpi.points).filter(c => c.mom !== null).slice(-3) : [];
  const last3 = cc.map(c => round1(c.mom));
  const hot = last3.length && last3.every(v => v >= 0.3);
  rows.push({ id: "infl", q: "Is inflation cooling?",
    a: !last3.length ? "US core CPI not loaded (needs BLS or FRED key)" : last3[last3.length - 1] <= 0.2 ? "Some cooling in the latest US core print" : hot ? "Not yet — US core still running hot" : "Mixed",
    tone: !last3.length ? "neutral" : hot ? "bad" : last3[last3.length - 1] <= 0.2 ? "good" : "warn",
    detail: [last3.length && `US core CPI m/m ${last3.map(v => v.toFixed(1)).join(" → ")} (target pace ≈0.2)`,
      has(S.ezCore?.last) && `euro core ${S.ezCore.last.toFixed(1)}% y/y`, has(S.ezHicp?.last) && `euro headline ${S.ezHicp.last.toFixed(1)}%`].filter(Boolean).join(" · "),
    tip: { t: "The disinflation trigger", d: "The playbook names two core CPI prints at ≤0.2% m/m (signal 2) as the trigger for the yield peak. 0.3% a month ≈ 3.7% a year." } });

  // 5. Credit and risk
  const hy = S.hyOas, vix = S.vix;
  const hyUp = has(hy?.chg1m) && hy.chg1m >= 25;
  rows.push({ id: "credit", q: "Is credit cracking?",
    a: !has(hy?.last) ? "HY spread not loaded (needs FRED key)" : results.s13?.status === "met" ? "Yes — credit stress is spreading" : hyUp ? "Widening — watch" : "No sign of a crack yet",
    tone: results.s13?.status === "met" ? "bad" : hyUp ? "warn" : "neutral",
    detail: [has(hy?.last) && `HY spread ${Math.round(hy.last)}bp${has(hy.chg1m) ? ` (${sgn(hy.chg1m)}bp in 1m)` : ""}`, has(S.igOas?.last) && `IG ${Math.round(S.igOas.last)}bp`,
      has(vix?.last) && `VIX ${vix.last.toFixed(1)}`].filter(Boolean).join(" · "),
    tip: { t: "The 2007 template", d: "In a credit-led bear market spreads widen before equities fully crack. Signal 13 tracks it; the credit-accident scenario depends on it." } });

  // 6. Next events
  const next = buildCalendar(userEvents).filter(e => !e.minor && e.date >= today && daysUntil(e.date, today) <= 21).slice(0, 5);
  rows.push({ id: "next", q: "What's next?", a: next.length ? `${next.length} key date${next.length > 1 ? "s" : ""} in the next 3 weeks` : "Nothing major in the next 3 weeks", tone: "neutral",
    detail: next.map(e => `${e.approx ? "≈" : ""}${fmtDay(e.date)} ${e.label.replace(/ · meeting .*$/, "").replace(/ — .*$/, "")}`).join(" · "),
    tip: "Full list, with consensus boxes for the Rule-10 check, in the calendar further down." });
  return rows;
}
