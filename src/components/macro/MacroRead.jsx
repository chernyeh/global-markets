import { Dots } from "../helpers.jsx";
import { C, MONO, SERIF, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

const LABELS = ["BOTTOM LINE:", "WATCH NEXT:", "GAPS:", "BIAS CHECK:"];

// **bold** spans inside a line.
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
}

// Conclusions-first read of the whole page, written on demand by the brief
// model chosen in the header. It sees only a digest of this page's numbers.
export default function MacroRead({ read, busy, onGenerate }) {
  const fs = useFs();
  const lines = String(read?.text || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
  return (
    <div style={{ borderTop: `1px solid ${C.line2}`, marginTop: 8, paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: fs(9), color: C.red, letterSpacing: "0.1em", fontWeight: 600 }}>MACRO READ</span>
        <span style={smallMono(fs)}>
          {read?.at ? `written ${fmtStamp(read.at)} by ${read.model || "the brief model"} from this page's data only` : "a conclusions-first read of everything on this page"}
        </span>
        <button onClick={onGenerate} disabled={busy} style={{ ...chipBtn(false, C.red), marginLeft: "auto", padding: "3px 10px", opacity: busy ? 0.6 : 1 }}>
          {busy ? <Dots /> : read?.text ? "↺ rewrite" : "✦ write macro read"}
        </button>
      </div>
      {read?.error && <div style={{ ...smallMono(fs, C.red), marginBottom: 4 }}>⚠ {read.error}</div>}
      {lines.length > 0 && (
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
