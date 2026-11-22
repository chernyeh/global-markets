import MonthTable from "./MonthTable.jsx";
import { US_PRINT_ROWS } from "../../data/macroInflation.js";
import { lastMonths } from "../../macroInflation.js";
import { SOURCE_META } from "../../data/macroSeries.js";
import { C, SERIF, card, kickerStyle, useFs } from "./macroStyles.js";
import { InfoTip } from "./SeriesTable.jsx";

// m/m rows tint around 0.25% (≈3% a year); rates around 3%.
const pivotFor = r => (r.kind === "mom" ? { pivot: 0.25, step: 0.1 } : { pivot: 3, step: 1 });

export default function InflationCard({ series: S }) {
  const fs = useFs();
  const base = S.coreCpi?.points?.length ? S.coreCpi : S.cpiNsa;
  const months = lastMonths(base, 4);
  const cpiSrc = S.coreCpi?.srcUsed ? SOURCE_META[S.coreCpi.srcUsed]?.label : null;
  const keyMissing = !base?.points?.length && /BLS|quota|FRED_API_KEY/.test(S.coreCpi?.error || "");
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>US INFLATION · MONTHLY PRINTS<InfoTip tip={{ t: "US inflation prints", d: `m/m and 3-month annualised rates use seasonally adjusted indices; y/y uses unadjusted indices, as BLS publishes. ${cpiSrc ? `CPI and PPI via ${cpiSrc}` : "BLS (PRIMARY), FRED fallback"}; PCE and alternative cores via FRED (BEA, Cleveland, Atlanta and Dallas Feds).`,
          r: "Warm tint = above 3% a year (0.25% m/m), cool = below. Green bold = core m/m at the ≤0.2% trigger. \"n/a\" = base month missing or not yet published (hover the cell)." }} /></span>
      </div>
      {!months.length ? (
        <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.5 }}>
          {keyMissing
            ? <>Needs the free <b>BLS_API_KEY</b> (or <b>FRED_API_KEY</b>) in Vercel → Settings → Environment Variables, then redeploy. BLS refuses keyless requests once a shared server IP has used its daily quota.</>
            : "No data yet."}
        </div>
      ) : (
        <MonthTable S={S} rows={US_PRINT_ROWS} months={months} pivotFor={pivotFor} label="US inflation prints" />
      )}
    </div>
  );
}
