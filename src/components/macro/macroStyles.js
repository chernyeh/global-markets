// Design tokens for the Macro tab — the app's existing palette and type
// (see src/ui.jsx and App.jsx): Spectral for text, DM Mono for labels and
// figures, red accent #c0392b, cream page, white cards with #e8e2d6 borders.
import { useContext } from "react";
import { FontScaleCtx } from "../../context.js";

export const MONO = "'DM Mono',monospace";
export const SERIF = "'Spectral',Georgia,serif";

export const C = {
  red: "#c0392b", redBg: "#fdecea",
  green: "#1b7a3e", greenBg: "#e6f4ec",
  amber: "#b84a00", amberBg: "#fff3ee",
  gold: "#c9a84c", goldDark: "#8a6a20", goldBg: "#fdf6e3",
  blue: "#3a6080", blueBg: "#f0f4f8", slate: "#8aa8bc",
  ink: "#1a1a1a", sub: "#555", mute: "#888", faint: "#aaa", ghost: "#ccc",
  line: "#e8e2d6", line2: "#f0ece4", cream: "#f5f0e8", card: "#fff",
};

export const TIER_COLOR = { PRIMARY: C.green, "SECONDARY-reliable": C.blue, "SECONDARY-unverified": C.amber };

export const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px" };

// Font sizes follow the header's A/A/A font-scale setting.
export function useFs() {
  const k = useContext(FontScaleCtx) || 1;
  return n => Math.round(n * k * 10) / 10;
}

export const kickerStyle = fs => ({ fontFamily: MONO, fontSize: fs(9), color: C.red, letterSpacing: "0.1em", fontWeight: 600 });
export const titleStyle = fs => ({ fontFamily: SERIF, fontSize: fs(14), color: C.ink, fontWeight: 600 });
export const smallMono = (fs, color = C.mute) => ({ fontFamily: MONO, fontSize: fs(9), color });
export const chipBtn = (active, color = C.red) => ({
  fontFamily: MONO, fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer",
  border: `1px solid ${active ? color : "#ddd"}`, background: active ? color : "#fff", color: active ? "#fff" : C.mute,
});
export const inputStyle = { fontFamily: MONO, fontSize: 10, padding: "3px 6px", border: "1px solid #ddd", borderRadius: 3, background: "#fff", color: C.ink, outline: "none" };
