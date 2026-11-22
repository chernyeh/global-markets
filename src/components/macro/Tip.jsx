import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { C, MONO, SERIF, useFs } from "./macroStyles.js";

// Explanation on demand: hover (desktop), focus (keyboard) or tap (phone).
// `tip` is a string or a glossary entry { t, d, w, r, src } — title, what it
// is, why it matters for the playbook, how to read it, source. Rendered in a
// portal so table and card overflow never clip it; kept inside the viewport.
const W = 320;

function Body({ tip, fs }) {
  if (typeof tip === "string") return <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink, lineHeight: 1.45 }}>{tip}</div>;
  return (
    <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.45 }}>
      {tip.t && <div style={{ fontWeight: 700, color: C.ink, fontSize: fs(12.5), marginBottom: 2 }}>{tip.t}</div>}
      {tip.d && <div>{tip.d}</div>}
      {tip.w && <div style={{ marginTop: 4 }}><b style={{ color: C.ink }}>Why it matters: </b>{tip.w}</div>}
      {tip.r && <div style={{ marginTop: 4 }}><b style={{ color: C.ink }}>How to read: </b>{tip.r}</div>}
      {tip.src && <div style={{ fontFamily: MONO, fontSize: fs(9), color: C.mute, marginTop: 5 }}>{tip.src}</div>}
    </div>
  );
}

export default function Tip({ tip, children, underline = true, style }) {
  const fs = useFs();
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const id = useId();
  const show = () => { if (ref.current) setRect(ref.current.getBoundingClientRect()); };
  const hide = () => setRect(null);
  useEffect(() => {
    if (!rect) return;
    const close = e => { if (!ref.current?.contains(e.target)) hide(); };
    const key = e => { if (e.key === "Escape") hide(); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("scroll", hide, true); document.removeEventListener("keydown", key); };
  }, [rect]);
  if (!tip) return children;

  let box = null;
  if (rect && typeof window !== "undefined") {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(W, vw - 16);
    const left = Math.max(8, Math.min(rect.left, vw - w - 8));
    const above = rect.bottom > vh * 0.62;
    box = createPortal(
      <div id={id} role="tooltip" style={{ position: "fixed", left, width: w, zIndex: 1000, ...(above ? { bottom: vh - rect.top + 6 } : { top: rect.bottom + 6 }),
        background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: "0 4px 18px rgba(0,0,0,0.12)", padding: "8px 10px", pointerEvents: "none" }}>
        <Body tip={tip} fs={fs} />
      </div>, document.body);
  }
  return (
    <span ref={ref} tabIndex={0} aria-describedby={rect ? id : undefined}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      style={{ cursor: "help", outline: "none", ...(underline ? { textDecoration: "underline dotted", textDecorationColor: C.ghost, textUnderlineOffset: 3 } : {}), ...style }}>
      {children}
      {box}
    </span>
  );
}
