import { useState } from "react";
import { SCENARIOS } from "../../data/macroSignals.js";
import { C, MONO, SERIF, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

const nums = a => (a.length ? a.map(n => `#${n}`).join(" ") : "—");

// The four yield scenarios with your weights and the evidence the signals give.
// Weights are never moved automatically; when two or more signals have changed
// since you last set them, the strip asks you to re-weight or confirm — so a
// changed picture prompts a decision instead of sitting unread.
export default function ScenarioStrip({ tally, scen, onSave, flipsSinceWeights }) {
  const fs = useFs();
  const [edit, setEdit] = useState(null);
  const weights = edit || scen.weights;
  const sum = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
  const stale = flipsSinceWeights >= 2;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(150px,100%),1fr))", gap: 8 }}>
        {SCENARIOS.map(s => {
          const t = tally[s.id] || { for: [], partial: [], against: [] };
          const w = weights[s.id];
          const strength = t.for.length - t.against.length;
          return (
            <div key={s.id} title={s.path} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 9px", background: "#fcfbf8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: SERIF, fontSize: fs(13), fontWeight: 600, color: C.ink }}>{s.short}</span>
                {edit
                  ? <input type="number" min={0} max={100} value={w} aria-label={`${s.short} weight`}
                      onChange={e => setEdit({ ...edit, [s.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      style={{ ...inputStyle, width: 52, textAlign: "right" }} />
                  : <span style={{ fontFamily: MONO, fontSize: fs(15), fontWeight: 600, color: C.ink }}>{w}%</span>}
              </div>
              {/* Weight bar: single hue on a lighter track of the same hue */}
              <div style={{ height: 4, borderRadius: 2, background: C.line2, margin: "4px 0 5px" }} aria-hidden="true">
                <div style={{ width: `${Math.min(100, w)}%`, height: 4, borderRadius: 2, background: C.slate }} />
              </div>
              <div style={{ ...smallMono(fs, C.sub), lineHeight: 1.5 }}>
                <span style={{ color: strength > 0 ? C.green : C.sub }}>for {nums(t.for)}</span>
                {t.partial.length > 0 && <span> · partly {nums(t.partial)}</span>}
                <span style={{ color: t.against.length ? C.red : C.sub }}> · against {nums(t.against)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 }}>
        <span style={smallMono(fs)}>
          Weights: {scen.fromPlaybook ? "playbook judgement, 20 Nov" : `set by you ${fmtStamp(scen.setAt)}`} · the board counts evidence; it never moves the weights · hover a scenario for its path
        </span>
        {stale && !edit && (
          <span style={{ ...smallMono(fs, C.amber), fontWeight: 600 }}>
            ⚑ {flipsSinceWeights} signal changes since these weights were set — re-weight or confirm
          </span>
        )}
        {edit ? <>
          <span style={smallMono(fs, sum === 100 ? C.green : C.red)}>sum {sum}%</span>
          <button disabled={sum !== 100} onClick={() => { onSave(edit); setEdit(null); }} style={{ ...chipBtn(sum === 100, C.ink), opacity: sum === 100 ? 1 : 0.5 }}>save</button>
          <button onClick={() => setEdit(null)} style={chipBtn(false)}>cancel</button>
        </> : <>
          <button onClick={() => setEdit({ ...scen.weights })} style={chipBtn(false, C.ink)}>re-weight</button>
          {stale && <button onClick={() => onSave({ ...scen.weights })} style={chipBtn(false, C.ink)}>confirm unchanged</button>}
        </>}
      </div>
    </div>
  );
}
