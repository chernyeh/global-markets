import { useState } from "react";
import { SCENARIOS, SIGNALS } from "../../data/macroSignals.js";
import { C, MONO, SERIF, smallMono, useFs, chipBtn, inputStyle, kickerStyle } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";
import Tip from "./Tip.jsx";
import { InfoTip } from "./SeriesTable.jsx";

const SIG = Object.fromEntries(SIGNALS.map(s => [String(s.n), s]));
const names = list => list.map(n => `#${n} ${SIG[String(n)]?.label || ""}`).join("; ");

// The four paths for the 10-year yield, with your odds and what the board's
// signals currently say. Odds never move automatically; when two or more
// signals have changed since they were set, the strip asks you to re-weight or
// confirm — so a changed picture prompts a decision instead of sitting unread.
export default function ScenarioStrip({ tally, scen, onSave, flipsSinceWeights }) {
  const fs = useFs();
  const [edit, setEdit] = useState(null);
  const weights = edit || scen.weights;
  const sum = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
  const stale = flipsSinceWeights >= 2;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={kickerStyle(fs)}>WHERE THE 10-YEAR YIELD GOES NEXT · YOUR ODDS
          <InfoTip tip={{ t: "Four paths, your odds", d: "The playbook's four scenarios for the US 10-year yield. The % is a subjective probability — the playbook's judgement of 20 Nov until you re-weight. The four add up to 100%.",
            r: "\"Evidence\" counts the signals on the board that currently point to (or against) each path. It never changes the odds by itself: you decide." }} /></span>
        <span style={smallMono(fs)}>{scen.fromPlaybook ? "odds: playbook, 20 Nov" : `odds set by you ${fmtStamp(scen.setAt)}`}</span>
        {stale && !edit && <span style={{ ...smallMono(fs, C.amber), fontWeight: 600 }}>⚑ {flipsSinceWeights} signals changed since — re-weight or confirm</span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          {edit ? <>
            <span style={smallMono(fs, sum === 100 ? C.green : C.red)}>sum {sum}%</span>
            <button disabled={sum !== 100} onClick={() => { onSave(edit); setEdit(null); }} style={{ ...chipBtn(sum === 100, C.ink), opacity: sum === 100 ? 1 : 0.5 }}>save</button>
            <button onClick={() => setEdit(null)} style={chipBtn(false)}>cancel</button>
          </> : <>
            <button onClick={() => setEdit({ ...scen.weights })} style={chipBtn(false, C.ink)}>re-weight</button>
            {stale && <button onClick={() => onSave({ ...scen.weights })} style={chipBtn(false, C.ink)}>confirm unchanged</button>}
          </>}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 8 }}>
        {SCENARIOS.map(s => {
          const t = tally[s.id] || { for: [], partial: [], against: [] };
          const w = weights[s.id];
          const pro = t.for.length + t.partial.length, con = t.against.length;
          const evid = !pro && !con ? "no evidence either way yet"
            : [pro && `${pro} signal${pro > 1 ? "s" : ""} point${pro > 1 ? "" : "s"} here`, con && `${con} against`].filter(Boolean).join(" · ");
          return (
            <div key={s.id} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 9px", background: "#fcfbf8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <Tip tip={{ t: s.label, d: s.path }}><span style={{ fontFamily: SERIF, fontSize: fs(13), fontWeight: 600, color: C.ink }}>{s.short}</span></Tip>
                {edit
                  ? <input type="number" min={0} max={100} value={w} aria-label={`${s.short} odds`}
                      onChange={e => setEdit({ ...edit, [s.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      style={{ ...inputStyle, width: 52, textAlign: "right" }} />
                  : <span style={{ fontFamily: MONO, fontSize: fs(15), fontWeight: 600, color: C.ink }}>{w}%</span>}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: C.line2, margin: "3px 0 4px" }} aria-hidden="true">
                <div style={{ width: `${Math.min(100, w)}%`, height: 4, borderRadius: 2, background: C.slate }} />
              </div>
              <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.sub, lineHeight: 1.35 }}>{s.plain}</div>
              <Tip underline={false} tip={pro || con ? { t: `Evidence for “${s.short}”`, d: [t.for.length && `Pointing here: ${names(t.for)}.`, t.partial.length && `Partly: ${names(t.partial)}.`, con && `Against: ${names(t.against)}.`].filter(Boolean).join(" ") } : null}>
                <span style={{ ...smallMono(fs, con > pro ? C.red : pro ? C.green : C.faint), display: "inline-block", marginTop: 2 }}>{evid}</span>
              </Tip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
