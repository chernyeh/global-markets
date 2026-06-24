import { useState } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
export const RED   = "#c0392b";
export const mono  = { fontFamily: "'DM Mono',monospace" };

// Small mono label: section headers, metadata tags
export const labelSm  = { ...mono, fontSize: 9,  color: "#888", letterSpacing: "0.08em" };
export const labelMed = { ...mono, fontSize: 11, color: "#555" };

// Standard pill button (background:none, bordered)
export const pillBtn = {
  display: "flex", alignItems: "center", gap: 4,
  background: "none", border: "1px solid #bbb", borderRadius: 5,
  cursor: "pointer", ...mono, fontSize: 11, color: "#333",
  padding: "5px 11px", flexShrink: 0,
};

// White card with subtle border
export const card = {
  background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
};

// ─── HoverButton ─────────────────────────────────────────────────────────────
// Drop-in <button> with onMouseOver/Out hover highlight baked in.
// Pass `style` for base styles and `hoverStyle` to override on hover.
export function HoverButton({ style, hoverStyle = { background: "#f5f5f5" }, children, ...props }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      {...props}
      style={{ ...style, ...(hovered && !props.disabled ? hoverStyle : {}) }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      {children}
    </button>
  );
}
