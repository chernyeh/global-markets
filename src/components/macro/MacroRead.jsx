import { useState } from "react";
import { Dots } from "../helpers.jsx";
import { C, MONO, SERIF, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

const LABELS = ["BOTTOM LINE:", "WATCH NEXT:", "GAPS:", "BIAS CHECK:"];

// **bold** spans inside a line.
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
}

// Narrative read of the whole page, written on demand by the brief model chosen
// in the header from a digest of this page's numbers. Folded to its bottom-line
// sentence by default; the computed Bottom Line above carries the essentials.
export default function MacroRead({ read, busy, onGenerate }) {
  const fs = useFs();
  const [open, setOpen] = useState(false);
  const lines = String(read?.text || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
  const lead = (lines.find(l => l.toUpperCase().startsWith("BOTTOM LINE:")) || lines[0] || "").replace(/^BOTTOM LINE:\s*/i, "").replace(/\*\*/g, "");
  return (
    <div style={{ borderTop: `1px solid ${C.line2}`, marginTop: 8, paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: fs(9), color: C.red, letterSpacing: "0.1em", fontWeight: 600 }}>AI READ</span>
        <span style={smallMono(fs)}>
          {read?.at ? `${fmtStamp(read.at)} · ${read.model || "brief model"} · from this page's data only` : "optional narrative of the whole page, written by the brief model on request"}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {lines.length > 0 && <button onClick={() => setOpen(o => !o)} style={chipBtn(open, C.ink)}>{open ? "fold" : "read all ▾"}</button>}
          <button onClick={onGenerate} disabled={busy} style={{ ...chipBtn(false, C.red), padding: "2px 9px", opacity: busy ? 0.6 : 1 }}>
            {busy ? <Dots /> : read?.text ? "↺ rewrite" : "✦ write AI read"}
          </button>
        </span>
      </div>
      {!open && lead && <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, lineHeight: 1.45 }}>{lead}</div>}
      {read?.error && <div style={{ ...smallMono(fs, C.red), marginBottom: 4 }}>⚠ {read.error}</div>}
      {open && lines.length > 0 && (
        <div style={{ fontFamily: SERIF, fontSize: fs(13), color: C.ink, lineHeight: 1.5, maxWidth: 1100 }}>
          {lines.map((l, i) => {
            const label = LABELS.find(x => l.toUpperCase().startsWith(x));
            if (/^[-•]\s+/.test(l)) {
              return <div key={i} style={{ display: "flex", gap: 6, margin: "2px 0" }}><span style={{ color: C.red }}>•</span><span><Inline text={l.replace(/^[-•]\s+/, "")} /></span></div>;
            }
            if (label) {
              const rest = l.slice(label.length).trim();
              const lead = label === "BOTTOM LINE:";
              return (
                <div key={i} style={{ margin: lead ? "0 0 4px" : "4px 0 0", fontSize: lead ? fs(14) : fs(12.5), fontWeight: lead ? 600 : 400, color: label === "BIAS CHECK:" ? C.goldDark : C.ink }}>
                  <span style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: "0.08em", color: label === "BIAS CHECK:" ? C.goldDark : C.red, marginRight: 6 }}>{label.replace(":", "")}</span>
                  <Inline text={rest} />
                </div>
              );
            }
            return <div key={i} style={{ margin: "2px 0" }}><Inline text={l} /></div>;
          })}
        </div>
      )}
    </div>
  );
}
