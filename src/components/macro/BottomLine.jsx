import { C, MONO, SERIF, kickerStyle, smallMono, useFs } from "./macroStyles.js";
import Tip from "./Tip.jsx";

const TONE = { good: C.green, bad: C.red, warn: C.amber, act: C.red, neutral: C.ink };
const DOT = { good: "●", bad: "●", warn: "◐", act: "●", neutral: "○" };

// Six plain questions, answered from the page's own numbers (src/macroSummary.js).
// Question on the left (hover for how it is worked out), answer and the figures
// behind it on the right.
export default function BottomLine({ rows }) {
  const fs = useFs();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
        <span style={kickerStyle(fs)}>BOTTOM LINE</span>
        <span style={smallMono(fs)}>worked out from the data on this page · hover a question for how</span>
      </div>
      <div role="table" aria-label="Bottom line">
        {rows.map(r => (
          <div role="row" key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "1px 12px", padding: "4px 0", borderTop: `1px solid ${C.line2}`, alignItems: "baseline" }}>
            <span role="rowheader" style={{ flex: "0 0 210px", maxWidth: "100%", fontFamily: MONO, fontSize: fs(10), color: C.sub }}>
              <Tip tip={r.tip}>{r.q}</Tip>
            </span>
            <span role="cell" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(13.5), fontWeight: 600, color: TONE[r.tone] || C.ink }}>
                <span aria-hidden="true" style={{ fontSize: fs(10), marginRight: 5, verticalAlign: 1 }}>{DOT[r.tone] || "○"}</span>{r.a}
              </span>
              {r.detail && <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub, marginLeft: 8 }}>{r.detail}</span>}
              {r.extra && <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), color: r.extra.startsWith("⏰") ? C.red : C.mute, marginTop: 1 }}>{r.extra}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
