// Small display pieces for the Watchlist names board. Type, colours and
// spacing are the Macro tab's (components/macro/macroStyles.js).
import { C, MONO } from "../macro/macroStyles.js";
import { ok, fmtPct, fmtPp, chgColor } from "./watchFormat.js";

// A percentage change in the board's colours; `strong` = unusual (bold, tinted).
export function Chg({ v, fs, pp = false, strong = false, size = 10.5 }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: fs(size), color: chgColor(v), fontWeight: strong ? 700 : 400,
      ...(strong ? { background: C.amberBg, borderRadius: 3, padding: "0 3px" } : {}) }}>
      {pp ? fmtPp(v) : fmtPct(v)}
    </span>
  );
}

// Where the price sits in its 52-week range: a thin track with a marker.
export function RangeBar({ pos, width = 50 }) {
  if (!ok(pos)) return <span style={{ display: "inline-block", width }} />;
  const x = Math.max(0, Math.min(1, pos)) * (width - 4) + 2;
  const edge = pos >= 0.98 ? C.green : pos <= 0.02 ? C.red : C.ink;
  return (
    <svg width={width} height={10} aria-label={`${Math.round(pos * 100)}% of the 52-week range`} style={{ display: "block" }}>
      <line x1={1} x2={width - 1} y1={5} y2={5} stroke={C.line} strokeWidth={3} strokeLinecap="round" />
      <circle cx={x} cy={5} r={3} fill={edge} />
    </svg>
  );
}
