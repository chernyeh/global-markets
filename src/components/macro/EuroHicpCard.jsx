import MonthTable from "./MonthTable.jsx";
import { EURO_ROWS } from "../../data/macroInflation.js";
import { lastMonths } from "../../macroInflation.js";
import { C, card, kickerStyle, smallMono, useFs } from "./macroStyles.js";
import { InfoTip } from "./SeriesTable.jsx";

// Euro area tints around the ECB's 2% target (m/m around ≈0.17%).
const pivotFor = r => (r.id === "ezCoreMom" ? { pivot: 0.17, step: 0.1 } : { pivot: 2, step: 1 });
const rows = EURO_ROWS.map(r => (r.section ? r : { ...r, kind: "level" }));

export default function EuroHicpCard({ series: S }) {
  const fs = useFs();
  const months = lastMonths(S.ezHicp, 4);
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>EURO-AREA INFLATION · y/y<InfoTip tip={{ t: "Euro-area HICP", d: "Harmonised consumer prices from Eurostat (PRIMARY), ECOICOP ver.2 series. The ECB's own HICP series stopped at Dec 2025 when Eurostat moved to ver.2; these are the replacements.",
          r: "Cells are tinted around the ECB's 2% target: warm above, cool below. Hover a row name for what it covers." }} /></span>
        <span style={smallMono(fs)}>Eurostat · PRIMARY</span>
      </div>
      {months.length
        ? <MonthTable S={S} rows={rows} months={months} pivotFor={pivotFor} label="Euro-area HICP" />
        : <div style={smallMono(fs, C.sub)}>{S.ezHicp?.error || "No data yet."}</div>}
    </div>
  );
}
