import { breadth } from "../../macroInflation.js";
import { QUALITY_TAGS } from "../../data/macroInflation.js";
import Spark from "./Spark.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, heat } from "./macroStyles.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = ym => MON[Number(ym.slice(5, 7)) - 1];
const SIGNAL_LINE = 50; // signal 4's illustrative threshold, % by weight

// Meter list: one row per measure — name, bar against 100%, figure, 6-month trend.
// Fill carries severity (broad = sticky): ≥70% red, 50–70% amber, <50% green;
// the dashed tick is signal 4's 50%* line.
function Meter({ label, v, trend, yoy, fs }) {
  const col = v >= 70 ? C.red : v >= 50 ? C.amber : C.green;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "74px minmax(60px,1fr) 38px 60px 70px", gap: 8, alignItems: "center", padding: "2px 0" }}>
      <span style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink }}>{label}</span>
      <span style={{ position: "relative", height: 8, borderRadius: 4, background: C.line2 }} role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} ${Math.round(v)}%`}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, v)}%`, background: col, borderRadius: 4 }} />
        <span style={{ position: "absolute", left: `${SIGNAL_LINE}%`, top: -2, bottom: -2, borderLeft: `1px dashed ${C.ink}`, opacity: 0.5 }} />
      </span>
      <span style={{ fontFamily: MONO, fontSize: fs(12), fontWeight: 600, color: C.ink, textAlign: "right" }}>{Math.round(v)}%</span>
      <Spark points={trend} fmt={x => `${Math.round(x)}%`} width={60} height={16} monthly />
      <span style={smallMono(fs)}>{yoy !== null && yoy !== undefined ? `y/y ${Math.round(yoy)}%` : ""}</span>
    </div>
  );
}

export default function BreadthCard({ series: S }) {
  const fs = useFs();
  const b = breadth(S);
  const L = b.latest, Y = b.latestYoy;
  const trend = key => b.ann.map(x => [`${x.month}-01`, x[key]]);
  const items = [...b.items].sort((a, z) => z.weight - a.weight);
  const momMonths = items.find(it => it.mom?.length)?.mom.map(m => m.month) || [];
  const cols = `minmax(0,1fr) 30px ${momMonths.map(() => "36px").join(" ")} 42px 42px`;
  const cell = (v, pivot, step, dp = 1) => (
    <span style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", padding: "1px 3px", borderRadius: 3,
      background: v === null || v === undefined ? "transparent" : heat(v, pivot, step), color: v === null || v === undefined ? C.ghost : C.ink }}>
      {v === null || v === undefined ? "n/a" : v.toFixed(dp)}
    </span>
  );
  const needsKey = !L && /BLS|quota|FRED_API_KEY/.test(S.sa_SEHC?.error || "");
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>CORE-SERVICES BREADTH · SIGNAL 4</span>
        <span style={smallMono(fs)}>share of items running above 3% · {L ? `${mon(L.month)} ${L.month.slice(2, 4)}, 3m annualised SA` : "—"}</span>
      </div>
      {!L ? (
        <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.5 }}>
          {needsKey ? <>Needs <b>BLS_API_KEY</b> (or <b>FRED_API_KEY</b>) in Vercel. </> : "No data yet. "}
          Your 19 Nov note's reading (Aug–Oct): ≈70% by weight · ≈50% by count · ≈45% ex-OER above 3%.
        </div>
      ) : <>
        <Meter label="By weight" v={L.w} trend={trend("w")} yoy={Y?.w} fs={fs} />
        <Meter label="By count" v={L.n} trend={trend("n")} yoy={Y?.n} fs={fs} />
        <Meter label="Ex-OER" v={L.exOer} trend={trend("exOer")} yoy={Y?.exOer} fs={fs} />
        <div style={{ ...smallMono(fs), margin: "3px 0 8px", lineHeight: 1.5 }}>
          {L.covN} items, {L.covW.toFixed(1)}pp of CPI · dashed tick = signal 4's 50%* line · y/y basis {Y ? `(${mon(Y.month)})` : ""} · note's reading (Aug–Oct): ≈70 / ≈50 / ≈45%
        </div>
        <div role="table" aria-label="Core services items">
          <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 3, ...smallMono(fs, C.faint), fontSize: fs(8), borderBottom: `1px solid ${C.line2}`, paddingBottom: 2 }}>
            <span role="columnheader">ITEM · NOTE'S READ</span>
            <span role="columnheader" style={{ textAlign: "right" }}>WT</span>
            {momMonths.map(m => <span role="columnheader" key={m} style={{ textAlign: "right" }}>{mon(m).toUpperCase()}</span>)}
            <span role="columnheader" style={{ textAlign: "right" }}>3M</span>
            <span role="columnheader" style={{ textAlign: "right" }}>Y/Y</span>
          </div>
          {items.map(it => {
            const tag = QUALITY_TAGS[it.tag];
            return (
              <div role="row" key={it.code} title={`${it.label} — BLS ${it.code}${it.note ? ` · ${it.note}` : ""}${it.nsaFallback ? " · m/m from the unadjusted index (no SA series returned)" : ""}${it.yoy ? ` · y/y as of ${it.yoy.month}` : ""}`}
                style={{ display: "grid", gridTemplateColumns: cols, gap: 3, alignItems: "center", padding: "1px 0", borderBottom: `1px solid ${C.line2}` }}>
                <span role="cell" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.ink }}>{it.label}</span>
                  {tag && <span style={{ fontFamily: MONO, fontSize: fs(8), color: tag.color, marginLeft: 4 }}>{tag.label}</span>}
                  {it.nsaFallback && <span style={{ fontFamily: MONO, fontSize: fs(8), color: C.amber, marginLeft: 4 }}>nsa</span>}
                </span>
                <span role="cell" style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, textAlign: "right" }}>{it.weight.toFixed(1)}</span>
                {it.mom.map(m => <span role="cell" key={m.month} style={{ display: "flex", justifyContent: "flex-end" }}>{cell(m.v, 0.25, 0.1)}</span>)}
                <span role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{cell(it.ann3m, 3, 1)}</span>
                <span role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{cell(it.yoy?.v ?? null, 3, 1)}</span>
              </div>
            );
          })}
        </div>
      </>}
      <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>
        BLS CPI item indices (PRIMARY); weights and quality reads from your 19 Nov note. Non-overlapping set — transportation services shown as its three children;
        this is the monitor's reconstruction, not Waller's method. Tint: warm above 3% (0.25% m/m), cool below.
      </div>
    </div>
  );
}
