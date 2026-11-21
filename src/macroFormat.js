// Number formatting for the Macro tab. Units follow the registry
// (src/data/macroSeries.js): "%" yields, "bp" spreads, "$" USD prices, "px"
// other-unit prices, "fx" exchange rates, "idx" index levels, "x" ratios.

import { SOURCE_META } from "./data/macroSeries.js";

// Hover text for a row or tile: source, reliability tier, key, date, notes.
export function sourceTitle(s) {
  if (!s) return "";
  if (!s.points?.length) return `${s.label}: ${s.error || "no data"}`;
  const meta = s.srcUsed === "derived" ? { label: `derived from ${(s.inputs || []).join(" & ")}`, tier: "" } : SOURCE_META[s.srcUsed] || {};
  return [
    `${s.label} — ${meta.label || s.srcUsed}${meta.tier ? ` (${meta.tier})` : ""}${s.srcKey ? ` · ${s.srcKey}` : ""}`,
    `as of ${s.lastDate}${s.fallback ? " · fallback source (*)" : ""}${s.carried ? " · last stored value (source failed this refresh)" : ""}`,
    s.thr?.length ? `reference: ${s.thr.map(t => t.label).join(", ")}` : null,
    s.note || null,
  ].filter(Boolean).join("\n");
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtLevel(s, v = s?.last) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const dp = s.dp ?? 2;
  switch (s.unit) {
    case "%": return `${v.toFixed(dp)}%`;
    case "bp": return `${Math.round(v)}bp`;
    case "$": return `$${v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
    case "idx": case "px": case "fx": case "x":
    default: return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
}

export function fmtChg(s, v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  const a = Math.abs(v);
  if (s.chg === "pct") return `${sign}${a.toFixed(a >= 10 ? 0 : 1)}%`;
  if (s.chg === "bp") return `${sign}${a.toFixed(0)}bp`;
  return `${sign}${a.toFixed(Math.min(s.dp ?? 2, 2))}`;
}

// True when the latest daily move passed the series' alert threshold.
export const bigMove = s => !!(s?.move && s.chg1d !== null && s.chg1d !== undefined &&
  (s.upOnly ? s.chg1d >= s.move : Math.abs(s.chg1d) >= s.move));

export const fmtDate = d => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : "—");
export const fmtMonth = d => (d ? `${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}` : "—");
export const fmtStamp = ms => {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
// The as-of label for a series: month for monthly series, day otherwise.
export const asOfLabel = s => (!s?.lastDate ? "—" : s.freq === "M" ? fmtMonth(s.lastDate) : fmtDate(s.lastDate));
