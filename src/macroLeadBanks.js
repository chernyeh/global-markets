// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — lead central banks: moves, flags and alerts
// ═══════════════════════════════════════════════════════════════════════════════
// Pure functions over the resolved series (src/macroData.js) and the Central
// Bank Watch paths, used by the card, the bottom line, the Macro read digest
// and the alert engine (browser and server alike).
//
// Flags, in order of weight:
//   turn      a bank's latest move (≤120 days old) is the opposite way to its
//             previous one — the first hike after cuts, or the reverse
//   resumed   a move after ≥9 months on hold
//   cluster   ≥3 banks moved the same way in 90 days, at least twice as many as
//             moved the other way
//   priced    futures price ≥25bp of hikes (or cuts) over the bank's horizon (CBW)
//   diverge   the cluster points one way while the Fed is priced the other
//   fx        a lead bank's currency moved ≥5% against USD in a month — a move
//             that size feeds imported inflation (if weaker) and can force its hand

import { LEAD_BANKS } from "./data/macroLeadBanks.js";

const DAY = 86400000;
const dms = d => Date.parse(`${d}T00:00:00Z`);
const has = v => v !== null && v !== undefined && Number.isFinite(v);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtD = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;
export const sgnBp = v => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(Math.round(v))}bp`;

// A decision is a change of ≥10bp between consecutive observations. SONIA (the
// BoE fallback) drifts a bp or two from day to day, so smaller steps are noise.
export function policyMoves(points, minBp = 10) {
  const out = [];
  let prev = null;
  for (const [d, v] of points || []) {
    if (!has(v)) continue;
    if (prev && Math.abs(v - prev) * 100 >= minBp - 0.01) out.push({ date: d, from: prev, to: v, bp: Math.round((v - prev) * 100) });
    prev = v;
  }
  return out;
}

// Local currency against USD over a month, + = stronger. USD/xxx quotes are inverted exactly.
function fxStrength(s, inv) {
  if (!has(s?.chg1m)) return null;
  return inv ? (1 / (1 + s.chg1m / 100) - 1) * 100 : s.chg1m;
}

export function bankStats(bank, S, paths, today) {
  const s = bank.rate ? S?.[bank.rate] : null;
  const moves = policyMoves(s?.points);
  const last = moves[moves.length - 1] || null, prev = moves[moves.length - 2] || null;
  const age = last ? Math.round((dms(today) - dms(last.date)) / DAY) : null;
  const gap = last && prev ? Math.round((dms(last.date) - dms(prev.date)) / DAY) : null;
  const turn = !!(last && prev && age <= 120 && Math.sign(last.bp) !== Math.sign(prev.bp));
  const resumed = !!(last && prev && !turn && age <= 120 && gap >= 270);
  const yearAgo = dms(today) - 365 * DAY;
  const y1 = moves.filter(m => dms(m.date) > yearAgo);
  const p = bank.cbw ? paths?.[bank.cbw] : null;
  const upcoming = (p?.meetings || []).filter(m => m.date >= today);
  const fxS = S?.[bank.fx?.id];
  return {
    bank, s, rate: s?.last ?? null, rateDate: s?.lastDate || null, srcUsed: s?.srcUsed || null, fallback: !!s?.fallback, error: s?.error || null,
    moves, last, prev, age, gap, turn, resumed,
    up12: y1.filter(m => m.bp > 0).length, down12: y1.filter(m => m.bp < 0).length, net12: y1.reduce((n, m) => n + m.bp, 0),
    priced: upcoming.length ? { next: upcoming[0], totalBp: p.totalBp, n: upcoming.length, asOf: p.asOf, base: p.baseRate } : null,
    fx1m: fxStrength(fxS, bank.fx?.inv), fxS,
  };
}

export const leadStats = (S, paths, today) => LEAD_BANKS.map(b => bankStats(b, S, paths, today));

export function leadFlags(stats, paths = {}) {
  const recent = stats.filter(x => x.last && x.age <= 90);
  const hikes = recent.filter(x => x.last.bp > 0), cuts = recent.filter(x => x.last.bp < 0);
  const cluster = hikes.length >= 3 && hikes.length >= 2 * cuts.length ? "hike"
    : cuts.length >= 3 && cuts.length >= 2 * hikes.length ? "cut" : null;
  const withPrice = stats.filter(x => has(x.priced?.totalBp));
  const pricedHike = withPrice.filter(x => x.priced.totalBp >= 25).sort((a, b) => b.priced.totalBp - a.priced.totalBp);
  const pricedCut = withPrice.filter(x => x.priced.totalBp <= -25).sort((a, b) => a.priced.totalBp - b.priced.totalBp);
  const fed = paths?.fed?.totalBp;
  // Lead banks moving (or priced) one way while the Fed is priced the other.
  const leanLead = cluster || (pricedHike.length >= 2 && !pricedCut.length ? "hike" : pricedCut.length >= 2 && !pricedHike.length ? "cut" : null);
  const diverge = has(fed) && leanLead && ((leanLead === "hike" && fed <= -10) || (leanLead === "cut" && fed >= 10)) ? leanLead : null;
  const fxStress = stats.filter(x => has(x.fx1m) && Math.abs(x.fx1m) >= 5).sort((a, b) => Math.abs(b.fx1m) - Math.abs(a.fx1m));
  return { hikes, cuts, cluster, turns: stats.filter(x => x.turn), resumed: stats.filter(x => x.resumed), pricedHike, pricedCut, withPrice, fxStress,
    diverge, fed, nRate: stats.filter(x => x.moves.length).length };
}

const names = list => list.map(x => x.bank.name).join(", ");

// One line for the bottom line and the digest.
export function leadSummary(stats, paths) {
  const f = leadFlags(stats, paths);
  const parts = [];
  if (f.nRate) parts.push(`moves in 90d: ${f.hikes.length} hike${f.hikes.length === 1 ? "" : "s"}${f.hikes.length ? ` (${names(f.hikes)})` : ""}, ${f.cuts.length} cut${f.cuts.length === 1 ? "" : "s"}${f.cuts.length ? ` (${names(f.cuts)})` : ""}`);
  if (f.withPrice.length) parts.push(`priced: ${f.withPrice.map(x => `${x.bank.name} ${sgnBp(x.priced.totalBp)}`).join(", ")}`);
  if (f.turns.length) parts.push(`turn: ${f.turns.map(x => `${x.bank.name} ${x.last.bp > 0 ? "hiked" : "cut"} ${fmtD(x.last.date)}`).join(", ")}`);
  if (f.diverge) parts.push(`lead banks lean to ${f.diverge === "hike" ? "hikes" : "cuts"} while the Fed is priced the other way`);
  if (f.fxStress.length) parts.push(`currency stress: ${f.fxStress.map(x => `${x.bank.ccy} ${x.fx1m >= 0 ? "+" : "−"}${Math.abs(x.fx1m).toFixed(1)}% vs USD in 1m`).join(", ")}`);
  return { text: parts.join(" · "), flags: f };
}

// ─── Alerts ────────────────────────────────────────────────────────────────
// A new move by a lead bank (once per bank per move; a date within 5 days of
// the recorded one is the same move seen through another source), and a change
// in the hiking/cutting cluster. Without stored state (first run, or the first
// run after this feature shipped) moves are recorded silently.
export function leadAlertUpdate(prev, S, { today, paths = null }) {
  const known = prev?.lead || null;
  const lead = { ...(known || {}) };
  const fresh = [];
  const stats = leadStats(S, paths, today);
  for (const x of stats) {
    if (!x.last) continue;
    const k = x.bank.id, seen = lead[k];
    if (seen === x.last.date) continue;
    const sameMove = seen && Math.abs(dms(seen) - dms(x.last.date)) <= 5 * DAY;
    lead[k] = x.last.date;
    if (!known || sameMove || x.age > 30) continue;
    const verb = x.last.bp > 0 ? "hiked" : "cut";
    const why = x.turn ? ` — first ${x.last.bp > 0 ? "hike" : "cut"} after ${x.prev.bp > 0 ? "hikes" : "cuts"} (previous move ${fmtD(x.prev.date)})`
      : x.resumed ? ` — first move in ${Math.round(x.gap / 30)} months` : "";
    fresh.push({ kind: "leadcb", ref: k, sev: x.turn || x.resumed ? "watch" : "info",
      title: `${x.bank.name} ${verb} ${sgnBp(x.last.bp)} to ${x.last.to.toFixed(2)}% on ${fmtD(x.last.date)}${why}`,
      detail: `${x.bank.full}. Last 12 months: ${x.up12} hike${x.up12 === 1 ? "" : "s"}, ${x.down12} cut${x.down12 === 1 ? "" : "s"}. Why it matters: ${x.bank.lead.split(/(?<=\.)\s/)[0]} Source: ${x.srcUsed === "bis" ? "BIS policy rates" : x.srcUsed || "n/a"}.` });
  }
  const f = leadFlags(stats, paths);
  const before = prev?.leadCluster ?? null;
  if (known && f.cluster !== before && f.cluster) {
    const list = f.cluster === "hike" ? f.hikes : f.cuts;
    fresh.push({ kind: "leadcb", ref: "cluster", sev: "watch",
      title: `Lead central banks: ${f.cluster === "hike" ? "hiking" : "cutting"} cluster — ${names(list)} in the last 90 days`,
      detail: "Early movers turning together has preceded the Fed and ECB in past cycles (2021 hikes; 2023–24 cuts). Check the Fed card's pricing for whether markets have caught up.",
      guard: "A cluster is a reason to re-check the yield-peak signals, not an action on its own." });
  }
  return { lead, leadCluster: f.cluster, fresh };
}
