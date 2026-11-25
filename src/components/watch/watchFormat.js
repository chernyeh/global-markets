// Number and date formatting for the Watchlist names board.
import { C } from "../macro/macroStyles.js";

export const ok = v => v !== null && v !== undefined && Number.isFinite(v);

export const fmtPx = v => (!ok(v) ? "—" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
  : v >= 100 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toPrecision(3));
export const fmtPct = (v, dp = 1) => (!ok(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : dp)}%`);
export const fmtPp = v => (!ok(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}pp`);
export const fmtX = v => (!ok(v) || v <= 0 ? "—" : v >= 100 ? `${v.toFixed(0)}x` : `${v.toFixed(1)}x`);
export function fmtBig(v) {
  if (!ok(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDay = d => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : "—");
export const fmtDayY = d => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}` : "—");

export const chgColor = v => (!ok(v) ? C.ghost : v > 0 ? C.green : v < 0 ? C.red : C.sub);

export const LANG_TAG = { ja: "JA", "zh-HK": "ZH", "zh-TW": "ZH", "zh-CN": "ZH", fr: "FR", de: "DE", es: "ES", it: "IT", nl: "NL", id: "ID", th: "TH", ko: "KO" };
