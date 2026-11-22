import { useState } from "react";
import { gasBaseEffects } from "../../macroInflation.js";
import { GAS_DEFAULTS } from "../../data/macroInflation.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";
import { fmtDate } from "../../macroFormat.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlab = ym => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const pp = v => (v === null || v === undefined ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}pp`);

// Contribution of gasoline to headline CPI y/y, month by month: one series,
// diverging around zero (warm adds to inflation, cool subtracts); bars anchor
// on the zero line with 4px rounded data ends. Hover updates the readout.
function ContribBars({ rows, fs }) {
  const [hi, setHi] = useState(null);
  const vals = rows.map(r => r.contrib ?? 0);
  const pos = Math.max(0, ...vals), neg = Math.max(0, ...vals.map(v => -v));
  const H = 54, span = Math.max(0.2, pos + neg), base = (pos / span) * H;
  const r = hi !== null ? rows[hi] : null;
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, minHeight: 14 }}>
        {r ? <><b style={{ color: C.ink }}>{mlab(r.month)}</b>: gasoline y/y {r.yoy === null ? "n/a" : `${r.yoy.toFixed(1)}%`} vs ${r.base?.toFixed(2) ?? "n/a"} a year earlier → {pp(r.contrib)} to headline</>
          : "hover a bar for the month"}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 2 }} onMouseLeave={() => setHi(null)}>
        {rows.map((x, i) => {
          const v = x.contrib;
          const h = v === null ? 0 : Math.max(2, (Math.abs(v) / span) * H);
          const down = (v ?? 0) < 0;
          return (
            <div key={x.month} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} tabIndex={0} aria-label={`${mlab(x.month)} ${pp(v)}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", outline: "none" }}>
              <div style={{ position: "relative", height: H, width: "100%" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: base, borderTop: `1px solid ${C.line}` }} />
                {v !== null && <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "60%", maxWidth: 20, height: h,
                  top: down ? base : base - h, borderRadius: down ? "0 0 4px 4px" : "4px 4px 0 0",
                  background: down ? (hi === i ? C.blue : C.slate) : (hi === i ? C.red : C.amber) }} />}
              </div>
              <span style={{ fontFamily: MONO, fontSize: fs(8), color: hi === i ? C.ink : C.mute, marginTop: 2 }}>{MON[Number(x.month.slice(5, 7)) - 1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GasBaseCard({ series: S, assume, setAssume }) {
  const fs = useFs();
  const weekly = S.gasWeekly?.points?.length ? S.gasWeekly : null;
  const price = assume?.price ?? GAS_DEFAULTS.price;
  const weight = assume?.weight ?? GAS_DEFAULTS.weight;
  const [p, setP] = useState(String(price));
  const [w, setW] = useState(String(weight));
  const g = gasBaseEffects(S, { price, weight, months: GAS_DEFAULTS.months });
  const save = () => {
    const a = parseFloat(p), b = parseFloat(w);
    if (a > 0 && b > 0) setAssume({ price: a, weight: b });
  };
  const peak = g?.rows.filter(r => r.contrib !== null).reduce((m, r) => (m === null || r.contrib > m.contrib ? r : m), null);
  const trough = g?.rows.filter(r => r.contrib !== null).reduce((m, r) => (m === null || r.contrib < m.contrib ? r : m), null);
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>GASOLINE BASE EFFECTS · US HEADLINE CPI</span>
        <span style={smallMono(fs)}>if the pump price stays flat</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={smallMono(fs, C.sub)}>ASSUME</span>
        <span style={smallMono(fs)}>$</span>
        <input value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} inputMode="decimal" style={{ ...inputStyle, width: 54 }} aria-label="Assumed pump price, dollars per gallon" />
        <span style={smallMono(fs)}>/gal · CPI weight</span>
        <input value={w} onChange={e => setW(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} inputMode="decimal" style={{ ...inputStyle, width: 40 }} aria-label="Gasoline CPI weight, percent" />
        <span style={smallMono(fs)}>%</span>
        <button onClick={save} style={chipBtn(false, C.ink)}>apply</button>
        {weekly && <button onClick={() => { setP(weekly.last.toFixed(2)); setAssume({ price: +weekly.last.toFixed(2), weight }); }} style={chipBtn(false)}
          title="EIA weekly retail price via FRED">use latest ${weekly.last.toFixed(2)} ({fmtDate(weekly.lastDate)})</button>}
      </div>
      {!g ? (
        <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.5 }}>
          Needs the BLS average gasoline price (APU000074714) — add <b>BLS_API_KEY</b> or <b>FRED_API_KEY</b> in Vercel. Your 19 Nov note's estimate at ≈$3.85: +25–30% y/y through Feb 2027 data, about −15% by May 2027, ≈1–1.5pp off headline CPI.
        </div>
      ) : <>
        {peak && trough && (
          <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, marginBottom: 4, lineHeight: 1.45 }}>
            At <b>${price.toFixed(2)}</b>, gasoline adds <b>{pp(peak.contrib)}</b> to headline y/y in {mlab(peak.month)} and {trough.contrib < 0 ? "subtracts" : "adds"} <b>{pp(trough.contrib)}</b> by {mlab(trough.month)}:
            a <b>{(peak.contrib - trough.contrib).toFixed(1)}pp swing</b> <span style={{ color: C.sub }}>(note's estimate ≈1–1.5pp).</span>
          </div>
        )}
        <ContribBars rows={g.rows} fs={fs} />
        <div role="table" aria-label="Gasoline base effects" style={{ marginTop: 6 }}>
          <div role="row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px 54px 60px 60px", gap: 4, ...smallMono(fs, C.faint), fontSize: fs(8), borderBottom: `1px solid ${C.line2}`, paddingBottom: 2 }}>
            <span role="columnheader">MONTH</span><span role="columnheader" style={{ textAlign: "right" }}>YR-AGO $</span>
            <span role="columnheader" style={{ textAlign: "right" }}>GAS Y/Y</span><span role="columnheader" style={{ textAlign: "right" }}>TO HEADLINE</span>
            <span role="columnheader" style={{ textAlign: "right" }}>VS {g.refMonth ? MON[Number(g.refMonth.slice(5, 7)) - 1].toUpperCase() : "LATEST"}</span>
          </div>
          {g.rows.map(r => (
            <div role="row" key={r.month} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px 54px 60px 60px", gap: 4, fontFamily: MONO, fontSize: fs(10), color: C.ink, borderBottom: `1px solid ${C.line2}`, padding: "1px 0" }}>
              <span role="cell">{mlab(r.month)}</span>
              <span role="cell" style={{ textAlign: "right", color: C.sub }}>{r.base === null ? "n/a" : `$${r.base.toFixed(2)}`}</span>
              <span role="cell" style={{ textAlign: "right" }}>{r.yoy === null ? "n/a" : `${r.yoy >= 0 ? "+" : "−"}${Math.abs(r.yoy).toFixed(1)}%`}</span>
              <span role="cell" style={{ textAlign: "right", fontWeight: 600 }}>{pp(r.contrib)}</span>
              <span role="cell" style={{ textAlign: "right", color: C.sub }}>{pp(r.vsLatest)}</span>
            </div>
          ))}
        </div>
        <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>
          Base: BLS average retail price, unleaded regular ({mlab(g.lastMonth)}: ${g.lastPrice.toFixed(2)}{g.actualYoy !== null ? `; ${g.actualYoy >= 0 ? "+" : "−"}${Math.abs(g.actualYoy).toFixed(1)}% y/y in ${mlab(g.refMonth)}` : ""}).
          Contribution = weight × gasoline y/y — an estimate; the CPI gasoline index and seasonal factors differ slightly. Weight ≈3–3.5% per the note.
        </div>
      </>}
    </div>
  );
}
