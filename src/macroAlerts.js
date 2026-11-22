// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — in-app alerts (Phase 1; push via Telegram is Phase 4)
// ═══════════════════════════════════════════════════════════════════════════════
// updateAlerts(state, { results, series, health }) → next state. Pure function:
// the hook persists the state and shows browser notifications for new alerts.
//
// Kinds
//   signal  an auto signal changed status. To "met" = ACT; to "partial" = WATCH;
//           easing back = INFO. A 24h cooldown per signal stops a value hovering
//           at a threshold from firing repeatedly (it only re-fires if more severe).
//   move    a series' latest daily move passed its `move` threshold — once per
//           series per data date. INFO.
//   source  a data source started failing — once per source per day. INFO.
// The first run records a baseline and raises nothing, so opening the page for
// the first time doesn't flood the inbox with every signal already in place.

import { SIGNAL_MAP } from "./data/macroSignals.js";
import { SOURCE_META } from "./data/macroSeries.js";

const DAY = 86400000;
const MAX_ALERTS = 120;
export const SEV_RANK = { info: 0, watch: 1, act: 2 };
const RANK = { na: -1, unset: -1, not: 0, partial: 1, met: 2 };
const STATUS_WORD = { met: "met", partial: "partly met", not: "not met" };

export const emptyAlertState = () => ({ baseline: false, last: {}, alerts: [], moves: {}, srcDown: {}, flips: 0 });

const fmtMove = (s, v) => (s.chg === "pct" ? `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`
  : s.chg === "bp" ? `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}bp`
  : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`);

export function updateAlerts(prev, { results, series, health, now = Date.now() }) {
  const st = { ...emptyAlertState(), ...(prev || {}) };
  const last = { ...st.last };
  const moves = { ...st.moves };
  const srcDown = { ...st.srcDown };
  const fresh = [];
  let flips = st.flips || 0;
  const today = new Date(now).toISOString().slice(0, 10);

  // Signals
  for (const [id, r] of Object.entries(results || {})) {
    const sig = SIGNAL_MAP[id];
    if (!sig?.auto) continue;
    const before = last[id];
    if (r.status === "na") continue;          // data gap: keep the last known status
    last[id] = r.status;
    if (!st.baseline || before === undefined || before === r.status) continue;
    flips++;
    const up = RANK[r.status] > RANK[before];
    const sev = r.status === "met" ? "act" : up ? "watch" : "info";
    const recent = st.alerts.find(a => a.kind === "signal" && a.ref === id && now - a.at < DAY);
    if (recent && SEV_RANK[recent.sev] >= SEV_RANK[sev]) continue;
    fresh.push({
      kind: "signal", ref: id, sev,
      title: `Signal ${sig.n} ${up ? "now" : "no longer"} ${STATUS_WORD[up ? r.status : before]}: ${sig.label}`,
      detail: `${r.value}${up ? "" : ` (now ${STATUS_WORD[r.status]})`}`,
      action: r.status === "met" ? sig.action : null,
      guard: up ? sig.guard : null,
    });
  }

  // Daily moves
  for (const s of Object.values(series || {})) {
    if (!s.move || s.chg1d === null || s.chg1d === undefined || !s.lastDate || s.hidden) continue;
    const hit = s.upOnly ? s.chg1d >= s.move : Math.abs(s.chg1d) >= s.move;
    if (!hit || moves[s.id] === s.lastDate) continue;
    moves[s.id] = s.lastDate;
    if (!st.baseline) continue;
    fresh.push({ kind: "move", ref: s.id, sev: "info",
      title: `${s.label} ${fmtMove(s, s.chg1d)} on ${s.lastDate}`,
      detail: `Threshold ${s.upOnly ? "+" : "±"}${s.move}${s.chg === "pct" ? "%" : "bp"} for a daily move.` });
  }

  // Sources
  for (const [src, h] of Object.entries(health || {})) {
    const down = !!h.error || (h.requested > 0 && h.ok === 0);
    if (!down) { delete srcDown[src]; continue; }
    if (srcDown[src] === today) continue;
    srcDown[src] = today;
    if (!st.baseline) continue;
    const firstErr = h.error || Object.values(h.errors || {})[0] || "no data";
    fresh.push({ kind: "source", ref: src, sev: "info",
      title: `${SOURCE_META[src]?.label || src} unavailable`,
      detail: `${firstErr}. Tiles fall back to another source where one is listed; otherwise they show the last stored value with its date.` });
  }

  const stamped = fresh.map((a, i) => ({ ...a, id: `${now}-${i}`, at: now, read: false }));
  return {
    baseline: true, last, moves, srcDown, flips,
    alerts: [...stamped, ...st.alerts].slice(0, MAX_ALERTS),
    newAlerts: stamped,
  };
}

export const unreadCount = st => (st?.alerts || []).filter(a => !a.read).length;
