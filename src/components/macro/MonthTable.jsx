import { printValue } from "../../macroInflation.js";
import { round1 } from "../../macroData.js";
import { C, MONO, SERIF, smallMono, useFs, heat } from "./macroStyles.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlabel = ym => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`.toUpperCase();

// Rows × months of inflation rates. Cells are tinted on a diverging scale
// around `pivot` (cool below, warm above) — the figure itself stays in ink;
// green bold marks a value at the disinflation trigger (row.good). Blank cells
// say why on hover: not yet published, or the base month is missing.
export default function MonthTable({ S, rows, months, pivotFor, label }) {
  const fs = useFs();
  const cols = `minmax(0,1fr) repeat(${months.length},50px)`;
  return (
    <div role="table" aria-label={label}>
      <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 4, ...smallMono(fs, C.faint), fontSize: fs(8), borderBottom: `1px solid ${C.line2}`, paddingBottom: 3 }}>
        <span role="columnheader" />
        {months.map(m => <span role="columnheader" key={m} style={{ textAlign: "right" }}>{mlabel(m)}</span>)}
      </div>
      {rows.map((r, i) => r.section ? (
        <div key={`s${i}`} role="row" style={{ ...smallMono(fs, C.sub), fontWeight: 600, letterSpacing: "0.08em", padding: "6px 0 1px" }}>{r.section}</div>
      ) : (
        <div role="row" key={`${r.id}-${r.kind}-${i}`} title={r.note || ""}
          style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "1px 0", borderBottom: `1px solid ${C.line2}`, alignItems: "center" }}>
          <span role="cell" style={{ fontFamily: SERIF, fontSize: fs(11.5), color: S[r.id]?.points?.length ? C.ink : C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          {months.map(m => {
            const { v: raw, note } = printValue(S, r, m);
            const v = raw !== null && r.r1 ? round1(raw) : raw;
            const hit = v !== null && r.good?.(v);
            const pv = pivotFor(r);
            return (
              <span role="cell" key={m} title={v === null ? note : ""}
                style={{ fontFamily: MONO, fontSize: fs(10.5), textAlign: "right", padding: "1px 4px", borderRadius: 3,
                  background: v === null ? "transparent" : heat(v, pv.pivot, pv.step),
                  color: v === null ? C.ghost : hit ? C.green : C.ink, fontWeight: hit ? 700 : 400 }}>
                {v === null ? "n/a" : `${v.toFixed(1)}%`}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
