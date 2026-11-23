// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — "Macro read" (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════
// On demand, the brief model (header picker: Sonnet or Opus) reads a compact
// digest of everything on the page and writes a conclusions-first read. The
// digest carries every number with its source and date, so the model never has
// to recall one; the prompt forbids numbers that aren't in it.

import { SIGNALS, SCENARIOS } from "./data/macroSignals.js";
import { FOMC_MEETINGS, ECB_MEETINGS, BOJ_MEETINGS, buildCalendar, daysUntil } from "./data/macroCalendar.js";
import { breadth } from "./macroInflation.js";
import { withShifts, hawkDove, rosterFor } from "./macroSpeech.js";
import { monthlyChanges, round1 } from "./macroData.js";
import { fmtChg } from "./macroFormat.js";
import { leadStats, leadSummary, fmtD, sgnBp } from "./macroLeadBanks.js";

const f = (v, dp = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(dp));
const sg = (v, dp = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}`);

export const MACRO_READ_SYSTEM = `You are the macro strategist on a portfolio manager's cover page. Write a "Macro read" from the DIGEST only.

Format (plain text, no headings beyond these labels, compact):
BOTTOM LINE: one sentence — the single most important thing the data says today about the yield-peak question and the scenarios.
- 4 to 6 bullets, most important first. Each bullet: what changed or stands out, the numbers (with their source in brackets, e.g. [UST], [CBW], [Atlanta Fed], [BLS], [Eurostat], [Waller, CNBC 18 Nov]), and what it implies for the playbook's signals or scenarios.
WATCH NEXT: the 2–3 dated events in the digest that would most change the picture, with what outcome would matter.
GAPS: any key data the digest marks missing (one line; omit if none).
BIAS CHECK: one line — if any signal is met or a scenario's evidence has shifted, name the pre-committed action and whether waiting is fortification rather than diligence; else say no decision is due.

Rules: use only numbers and facts in the DIGEST; never introduce outside data or forecasts. Label any judgement as "judgement". Write for a professional investor; no generic caveats. Maximum 260 words.`;

export function buildMacroDigest({ series: S, results, tally, scen, paths, mpt, speech, today, userEvents = [] }) {
  const lines = [`DATE: ${today}`];
  const row = (id, label = S[id]?.label) => {
    const s = S[id];
    if (!s?.points?.length) return `${label}: n/a (${s?.error || "no data"})`;
    const unit = s.unit === "%" ? "%" : s.unit === "bp" ? "bp" : "";
    const ch = s.freq === "M" ? `1m ${fmtChg(s, s.chg1m)}` : `1d ${fmtChg(s, s.chg1d)}, 1m ${fmtChg(s, s.chg1m)}`;
    return `${label}: ${f(s.last, s.dp ?? 2)}${unit} (${ch}; ${s.srcUsed}, ${s.lastDate})`;
  };
  lines.push("MARKETS:");
  ["ust2y", "ust10y", "real10y", "bei10y", "tp10y", "c2s10s", "bund10", "oatBund", "jgb10", "hyOas", "igOas", "vix", "brent", "ttf", "gasStore", "gold", "dxy", "usdsgd"]
    .forEach(id => S[id] && lines.push(`  ${row(id)}`));
  if (S.gasStore?.thr?.length) lines.push(`  EU gas storage 5y same-day average: ${f(S.gasStore.thr[S.gasStore.thr.length - 1].v, 1)}%`);

  lines.push("SIGNALS (playbook; * thresholds illustrative):");
  for (const sig of SIGNALS) {
    const r = results[sig.id];
    if (!r) continue;
    lines.push(`  #${sig.n} ${sig.label} — ${r.status}${r.manual ? " (set by PM)" : ""}: ${r.value}${r.status === "met" ? ` → action: ${sig.action}` : ""}`);
  }
  lines.push(`SCENARIOS (PM weights${scen?.setAt ? `, set ${new Date(scen.setAt).toISOString().slice(0, 10)}` : ", playbook 20 Nov"}):`);
  for (const sc of SCENARIOS) {
    const t = tally[sc.id] || {};
    lines.push(`  ${sc.label} ${scen?.weights?.[sc.id] ?? sc.weight}% — evidence for #${(t.for || []).join(",#") || "none"}; against #${(t.against || []).join(",#") || "none"}`);
  }

  lines.push("POLICY PRICING:");
  const cbw = (p, name) => {
    if (!p?.meetings?.length) return `  ${name} (Central Bank Watch): n/a`;
    const m0 = p.meetings[0];
    return `  ${name} (CBW, data ${p.asOf || "date not stated"}): ${sg(m0.stepBp, 1)}bp priced for ${m0.date} (${f(m0.pct, 0)}% move); ${sg(p.totalBp)}bp over ${p.meetings.length} meetings`;
  };
  lines.push(cbw(paths?.fed, "Fed"), cbw(paths?.ecb, "ECB"), cbw(paths?.boj, "BoJ"));
  if (mpt?.windows?.length) {
    const w = mpt.windows.slice(0, 4).map(x => {
      const prior = mpt.prior?.windows?.find(p => p.start === x.start);
      return `${x.start.slice(0, 7)} mean ${f(x.mean / 100, 2)}% (wk ${sg(prior ? x.mean - prior.mean : null)}bp, P(hike) ${f(x.pHike, 0)}%)`;
    }).join("; ");
    lines.push(`  Fed (Atlanta Fed SOFR options, ${mpt.asOf}, range ${mpt.targetRange}): ${w}`);
  }
  if (S.ffLo?.last !== null && S.ffLo?.last !== undefined) lines.push(`  Fed target ${f(S.ffLo.last)}–${f(S.ffHi?.last)}%`);
  if (S.dfr?.last !== null && S.dfr?.last !== undefined) lines.push(`  ECB deposit rate ${f(S.dfr.last)}%`);
  if (paths?.boj?.currentRate) lines.push(`  BoJ policy rate ${f(paths.boj.currentRate)}% (CBW); JGB 2y ${f(S.jgb2?.last, 3)}%, 10y ${f(S.jgb10?.last, 3)}% (MoF); USD/JPY ${f(S.usdjpy?.last, 2)}`);

  // Early movers: secondary to the big three, but a turn here has preceded them.
  const ls = leadStats(S, paths, today);
  lines.push(`LEAD CENTRAL BANKS (early movers; rates BIS, pricing CBW): ${leadSummary(ls, paths).text || "n/a"}`);
  for (const x of ls) {
    const bits = [x.bank.rate ? (x.rate !== null ? `rate ${f(x.rate)}% (${x.srcUsed}, ${x.rateDate})` : "rate n/a") : "S$NEER policy (no rate)"];
    if (x.last) bits.push(`last move ${sgnBp(x.last.bp)} on ${fmtD(x.last.date)}${x.turn ? " (TURN)" : x.resumed ? " (after a long hold)" : ""}; 12m ${x.up12} hikes/${x.down12} cuts`);
    if (x.priced) bits.push(`priced ${sgnBp(x.priced.next.stepBp)} for ${x.priced.next.date} (${f(x.priced.next.pct, 0)}% odds), ${sgnBp(x.priced.totalBp)} total (CBW ${x.priced.asOf || "n.d."})`);
    if (x.fx1m !== null) bits.push(`${x.bank.ccy} ${sg(x.fx1m, 1)}% vs USD 1m`);
    lines.push(`  ${x.bank.name}: ${bits.join("; ")}`);
  }

  lines.push("INFLATION:");
  if (S.coreCpi?.points?.length) {
    const ch = monthlyChanges(S.coreCpi.points).filter(c => c.mom !== null).slice(-3);
    lines.push(`  US core CPI m/m (BLS, SA): ${ch.map(c => `${c.month} ${f(round1(c.mom), 1)}`).join(", ")}`);
  } else lines.push("  US CPI: n/a (needs BLS or FRED key)");
  const b = breadth(S);
  if (b.latest) lines.push(`  Core-services breadth above 3% (3m ann., ${b.latest.month}): ${f(b.latest.w, 0)}% by weight, ${f(b.latest.n, 0)}% by count, ${f(b.latest.exOer, 0)}% ex-OER`);
  if (S.ezHicp?.points?.length) lines.push(`  Euro HICP ${f(S.ezHicp.last, 1)}%, core ${f(S.ezCore?.last, 1)}%, services ${f(S.ezServ?.last, 1)}% (Eurostat, ${S.ezHicp.lastDate.slice(0, 7)}); Italy ${f(S.itHicp?.last, 1)}%`);

  const items = withShifts(Object.values(speech?.items || {})).filter(it => it.relevant);
  for (const bank of ["fed", "ecb", "boj"]) {
    const h = hawkDove(items, bank, { now: Date.parse(`${today}T12:00:00Z`) });
    const recent = items.filter(it => it.bank === bank).sort((a, b) => b.ts - a.ts).slice(0, 5);
    lines.push(`${bank.toUpperCase()} SPEAKERS (hawk–dove index −2..+2, 21 days, weighted): ${h.value === null ? "n/a" : f(h.value, 2)} from ${h.n} statements`);
    for (const it of recent) {
      const r = rosterFor(it.speaker, it.bank);
      lines.push(`  ${it.date} ${it.speaker}${r ? ` (${r.role}${r.v26 ? ", 2026 voter" : ""})` : ""} via ${(it.outlets || [it.outlet]).slice(0, 3).join(", ")}: stance ${sg(it.stance)}${it.shift ? `, shift ${sg(it.shift)} vs ${it.prev.date}` : ""}${it.quote ? ` — “${it.quote}”` : ` — ${it.title}`}`);
    }
  }

  lines.push("NEXT 21 DAYS:");
  buildCalendar(userEvents).filter(e => !e.minor && e.date >= today && daysUntil(e.date, today) <= 21)
    .forEach(e => lines.push(`  ${e.date}${e.approx ? " (approx)" : ""} ${e.label}`));
  const nf = FOMC_MEETINGS.find(m => m.end >= today && !m.noDecision), ne = ECB_MEETINGS.find(m => m.date >= today), nb = BOJ_MEETINGS.find(m => m.end >= today);
  if (nf) lines.push(`  next FOMC decision ${nf.end}; next ECB decision ${ne?.date}; next BoJ decision ${nb?.end}`);
  return lines.join("\n");
}
