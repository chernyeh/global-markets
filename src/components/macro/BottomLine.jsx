import { useState } from "react";
import { C, MONO, SERIF, kickerStyle, useFs } from "./macroStyles.js";
import Tip from "./Tip.jsx";

const TONE = { good: C.green, bad: C.red, warn: C.amber, act: C.red, neutral: C.ink };
const DOT = { good: "●", bad: "●", warn: "◐", act: "●", neutral: "○" };

// "+N more" opens a row's whole list, one entry per line; "show less" folds it.
function More({ all, shown, open, onToggle, fs }) {
  if (!all || all.length <= shown) return null;
  return (
    <button onClick={onToggle} aria-expanded={open}
      style={{ border: "none", background: "none", padding: 0, marginLeft: 6, cursor: "pointer", fontFamily: MONO, fontSize: fs(9.5), color: C.red,
        textDecoration: "underline", textDecorationColor: `${C.red}55`, textUnderlineOffset: 2, whiteSpace: "nowrap" }}>
      {open ? "show less" : `+${all.length - shown} more`}
    </button>
  );
}

const Lines = ({ items, fs, color }) => (
  <span style={{ display: "block", marginTop: 2 }}>
    {items.map((t, i) => <span key={i} style={{ display: "block", fontFamily: MONO, fontSize: fs(10), color, lineHeight: 1.5 }}>· {t}</span>)}
  </span>
);

// Six plain questions, answered from the page's own numbers (src/macroSummary.js,
// src/watchSummary.js). Question on the left (hover for how it is worked out),
// answer and the figures behind it on the right. A row may carry its full list
// (detailAll / extraAll) when the line shows only the first few.
export default function BottomLine({ rows }) {
  const fs = useFs();
  const [open, setOpen] = useState({});
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
        <span style={kickerStyle(fs)}>BOTTOM LINE</span>
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
              {r.detail && !open[`${r.id}:d`] && <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub, marginLeft: 8 }}>{r.detail}</span>}
              <More all={r.detailAll} shown={r.detailShown} open={!!open[`${r.id}:d`]} onToggle={() => toggle(`${r.id}:d`)} fs={fs} />
              {open[`${r.id}:d`] && r.detailAll && <Lines items={r.detailAll} fs={fs} color={C.sub} />}
              {r.extra && (
                <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), color: r.extra.startsWith("⏰") ? C.red : C.mute, marginTop: 1 }}>
                  {open[`${r.id}:e`] ? r.extraLabel : r.extra}
                  <More all={r.extraAll} shown={r.extraShown} open={!!open[`${r.id}:e`]} onToggle={() => toggle(`${r.id}:e`)} fs={fs} />
                  {open[`${r.id}:e`] && r.extraAll && <Lines items={r.extraAll} fs={fs} color={C.mute} />}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
