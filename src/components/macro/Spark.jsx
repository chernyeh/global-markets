import { useState } from "react";
import { C, MONO } from "./macroStyles.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;

// Sparkline with a hover crosshair. Muted line, latest point in the accent,
// threshold lines dashed and recessive. A threshold stretches the y-range only
// when it sits within one data-range of the line, so a far-off line doesn't
// flatten the trend.
export default function Spark({ points = [], width = 72, height = 22, thr = [], fmt = v => String(v), days = 183, monthly = false }) {
  const [hover, setHover] = useState(null);
  const lastDate = points.length ? points[points.length - 1][0] : null;
  const from = lastDate ? new Date(Date.parse(`${lastDate}T00:00:00Z`) - (monthly ? 760 : days) * 86400000).toISOString().slice(0, 10) : null;
  const pts = from ? points.filter(p => p[0] >= from) : [];
  if (pts.length < 2) return <span style={{ display: "inline-block", width, height }} aria-hidden="true" />;

  const vals = pts.map(p => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const range = hi - lo || Math.abs(hi) * 0.02 || 1;
  const lines = thr.filter(t => t.v >= lo - range && t.v <= hi + range);
  lines.forEach(t => { lo = Math.min(lo, t.v); hi = Math.max(hi, t.v); });
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const n = pts.length;
  const x = i => 1 + (i / (n - 1)) * (width - 4);
  const y = v => height - 1 - ((v - lo) / (hi - lo)) * (height - 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const h = hover !== null ? pts[hover] : null;

  return (
    <span style={{ position: "relative", display: "inline-block", width, height, verticalAlign: "middle" }}>
      <svg width={width} height={height} role="img"
        aria-label={`${pts.length} points from ${label(pts[0][0])} to ${label(pts[n - 1][0])}, latest ${fmt(pts[n - 1][1])}`}
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - 1) / (width - 4)) * (n - 1)))));
        }}
        onMouseLeave={() => setHover(null)}>
        {lines.map(t => (
          <line key={t.v} x1={0} x2={width} y1={y(t.v)} y2={y(t.v)} stroke={C.red} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 2" />
        ))}
        <path d={d} fill="none" stroke={C.slate} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(pts[n - 1][1])} r={2.2} fill={C.red} />
        {h && <>
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />
          <circle cx={x(hover)} cy={y(h[1])} r={2.4} fill="#fff" stroke={C.ink} strokeWidth={1.2} />
        </>}
      </svg>
      {h && (
        <span style={{ position: "absolute", bottom: height + 4, left: Math.min(Math.max(x(hover) - 50, -40), width - 60), zIndex: 30,
          background: C.ink, color: "#fff", fontFamily: MONO, fontSize: 9, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {monthly ? `${MON[Number(h[0].slice(5, 7)) - 1]} ${h[0].slice(0, 4)}` : label(h[0])} · {fmt(h[1])}
        </span>
      )}
    </span>
  );
}
