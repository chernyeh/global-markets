import MonthTable from "./MonthTable.jsx";
import { EURO_ROWS } from "../../data/macroInflation.js";
import { lastMonths } from "../../macroInflation.js";
import { C, card, kickerStyle, smallMono, useFs } from "./macroStyles.js";

// Euro area tints around the ECB's 2% target (m/m around ≈0.17%).
const pivotFor = r => (r.id === "ezCoreMom" ? { pivot: 0.17, step: 0.1 } : { pivot: 2, step: 1 });
const rows = EURO_ROWS.map(r => (r.section ? r : { ...r, kind: "level" }));

export default function EuroHicpCard({ series: S }) {
  const fs = useFs();
  const months = lastMonths(S.ezHicp, 4);
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>EURO AREA HICP · y/y</span>
        <span style={smallMono(fs)}>Eurostat, ECOICOP ver.2 (PRIMARY)</span>
      </div>
      {months.length
        ? <MonthTable S={S} rows={rows} months={months} pivotFor={pivotFor} label="Euro-area HICP" />
        : <div style={smallMono(fs, C.sub)}>{S.ezHicp?.error || "No data yet."}</div>}
      <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>
        Tint around the ECB's 2% target. The ECB's own HICP series stopped at Dec 2025 when Eurostat moved to ECOICOP ver.2; these are Eurostat's replacement series.
      </div>
    </div>
  );
}
