import { monthlyChanges, round1 } from "../../macroData.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs } from "./macroStyles.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlabel = ym => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

// US headline inflation prints from FRED. Core CPI m/m is shown on the
// published one-decimal basis (what signal 2 tests). A blank month means the
// base month is missing — Oct 2025 was not collected in the shutdown — and is
// never bridged by interpolation.
export default function InflationCard({ series }) {
  const fs = useFs();
  const tr = id => (series[id]?.points?.length ? new Map(monthlyChanges(series[id].points).map(c => [c.month, c])) : null);
  const core = tr("coreCpi"), head = tr("cpi"), pce = tr("corePce");
  const months = core ? [...core.keys()].slice(-4) : [];
  const rows = [
    { label: "Core CPI m/m", m: core, k: "mom", r1: true, thr: v => v <= 0.2 },
    { label: "Core CPI 3m ann.", m: core, k: "ann3m" },
    { label: "Core CPI y/y", m: core, k: "yoy" },
    { label: "CPI y/y", m: head, k: "yoy" },
    { label: "Core PCE m/m", m: pce, k: "mom" },
    { label: "Core PCE 3m ann.", m: pce, k: "ann3m" },
  ];
  const needsKey = !core && (series.coreCpi?.error || "").includes("FRED_API_KEY");
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div style={{ ...kickerStyle(fs), marginBottom: 6 }}>US INFLATION · PRINTS</div>
      {!core ? (
        <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.5 }}>
          {needsKey ? <>Needs the free <b>FRED_API_KEY</b> in Vercel (Settings → Environment Variables), then redeploy. Signals 2, 3, 5, 13 and 16 use it.</> : "No data yet."}
        </div>
      ) : (
        <div role="table" aria-label="US inflation prints">
          <div role="row" style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${months.length},48px)`, gap: 6, ...smallMono(fs, C.faint), fontSize: fs(8), borderBottom: `1px solid ${C.line2}`, paddingBottom: 3 }}>
            <span role="columnheader" />
            {months.map(m => <span role="columnheader" key={m} style={{ textAlign: "right" }}>{mlabel(m).toUpperCase()}</span>)}
          </div>
          {rows.map(r => (
            <div role="row" key={r.label} style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${months.length},48px)`, gap: 6, padding: "3px 0", borderBottom: `1px solid ${C.line2}`, alignItems: "center" }}>
              <span role="cell" style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink }}>{r.label}</span>
              {months.map(m => {
                const raw = r.m?.get(m)?.[r.k];
                const v = raw === null || raw === undefined ? null : r.r1 ? round1(raw) : raw;
                const hit = v !== null && r.thr?.(v);
                return (
                  <span role="cell" key={m} title={v === null ? (r.m?.has(m) ? "base month missing — not computed" : "not yet published") : ""}
                    style={{ fontFamily: MONO, fontSize: fs(10.5), textAlign: "right", color: v === null ? C.ghost : hit ? C.green : C.ink, fontWeight: hit ? 700 : 400 }}>
                    {v === null ? "n/a" : `${v.toFixed(1)}%`}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>
        BLS & BEA via FRED (PRIMARY). Green = core m/m at the ≤0.2% trigger. Components, core-services breadth and PPI arrive in Phase 2.
      </div>
    </div>
  );
}
