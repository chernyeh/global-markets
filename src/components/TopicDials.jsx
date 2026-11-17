import { useState } from "react";
import { TOPICS, TOPIC_GROUPS } from "../data/taxonomy.js";
import { DIAL_LEVELS, DIAL_MAP, MAX_PER_SOURCE, MAX_PER_SOURCE_FOCUS } from "../topicDials.js";

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS DIALS — Breaking tab
// ═══════════════════════════════════════════════════════════════════════════════
// Collapsed: one hairline strip inside the Breaking header card that names only
// the topics moved off Neutral, so the reader always sees how the feed is tilted.
// "tune" opens an inline panel: topics in three columns, each with a four-bar
// level meter (Down → Focus) and a separate ✕ to hide the topic.

const MONO = "'DM Mono',monospace";
const SERIF = "'Spectral',Georgia,serif";
const RED = "#c0392b";
const TRACK = "#e8e2d6";            // unfilled bar — same as the card hairlines
const FILL = {                       // filled bars, by the dial's level
  down:    "#8aa8bc",
  neutral: "#b5ab9a",
  up:      RED,
  focus:   RED,
};
const BAR_LEVELS = DIAL_LEVELS.filter(l => l.id !== "mute"); // down, neutral, up, focus
const BAR_H = [5, 8, 11, 14];

const CSS = `
  .gm-dial-btn{border:none;background:none;padding:0;margin:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;height:22px;width:9px}
  .gm-dial-x{width:18px;align-items:center;font-family:${MONO};font-size:10px;line-height:1}
  .gm-dial-btn:focus-visible{outline:1px solid ${RED};outline-offset:1px;border-radius:2px}
  .gm-focus-row:hover{background:#fdfbf7}
  .gm-focus-chip{border:none;background:none;padding:0;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:${MONO};font-size:10px;white-space:nowrap}
  @media (pointer:coarse){ .gm-dial-btn{width:14px;height:28px} .gm-dial-x{width:24px} }
`;

// Static mini meter for the collapsed strip.
function LevelGlyph({ level }) {
  if (level === "mute") return <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa" }}>✕</span>;
  const n = BAR_LEVELS.findIndex(l => l.id === level) + 1;
  return (
    <span aria-hidden style={{ display: "inline-flex", alignItems: "flex-end", gap: 1, height: 9 }}>
      {BAR_H.map((h, i) => (
        <span key={i} style={{ width: 2, height: Math.round(h * 0.62), borderRadius: 1, background: i < n ? FILL[level] : TRACK }} />
      ))}
    </span>
  );
}

// Interactive dial: ✕ then four ascending bars. Hover previews the level.
function Dial({ topic, level, onChange }) {
  const [hover, setHover] = useState(null);
  const shown = hover || level;
  const n = shown === "mute" ? 0 : BAR_LEVELS.findIndex(l => l.id === shown) + 1;
  const order = DIAL_LEVELS.map(l => l.id);
  const onKey = e => {
    const i = order.indexOf(level);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(order[Math.min(order.length - 1, i + 1)]); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(order[Math.max(0, i - 1)]); }
  };
  return (
    <div role="radiogroup" aria-label={`${topic.label} weight`} onKeyDown={onKey}
      onMouseLeave={() => setHover(null)}
      style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <button type="button" role="radio" aria-checked={level === "mute"} aria-label="Hide"
        title={level === "mute" ? `${topic.label}: hidden — click to restore` : `Hide ${topic.label}`}
        className="gm-dial-btn gm-dial-x"
        onMouseEnter={() => setHover("mute")}
        onClick={() => onChange(level === "mute" ? "neutral" : "mute")}
        style={{ color: shown === "mute" ? RED : "#c8c0b2" }}>
        ✕
      </button>
      {BAR_LEVELS.map((l, i) => (
        <button key={l.id} type="button" role="radio" aria-checked={level === l.id} aria-label={l.label}
          title={`${topic.label}: ${l.label}`} className="gm-dial-btn"
          onMouseEnter={() => setHover(l.id)}
          onClick={() => onChange(l.id)}>
          <span style={{ width: 4, height: BAR_H[i], borderRadius: 1, transition: "background 0.12s",
            background: i < n ? FILL[shown] : TRACK }} />
        </button>
      ))}
      <span style={{ fontFamily: MONO, fontSize: 9, width: 40, textAlign: "right",
        color: shown === "neutral" ? "#bbb" : shown === "mute" ? "#aaa" : shown === "down" ? "#6f8ea3" : RED,
        fontWeight: shown === "focus" ? 600 : 400 }}>
        {DIAL_MAP[shown].label.toLowerCase()}
      </span>
    </div>
  );
}

export default function TopicDials({ dials, onChange, counts, windowHours, mutedCount, showMuted, setShowMuted }) {
  const [open, setOpen] = useState(false);
  const active = TOPICS.filter(t => dials[t.id] && dials[t.id] !== "neutral");
  const set = (id, lvl) => {
    const next = { ...dials };
    if (lvl === "neutral") delete next[id]; else next[id] = lvl;
    onChange(next);
  };
  const MAX_CHIPS = 4;

  return (
    <div style={{ borderTop: "1px solid #f0ece4", marginTop: 10, paddingTop: 8 }}>
      <style>{CSS}</style>

      {/* Collapsed strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "#888", letterSpacing: "0.08em" }}>FOCUS</span>
        {active.length === 0 ? (
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa" }}>balanced — all topics at default weight</span>
        ) : (
          <>
            {active.slice(0, MAX_CHIPS).map(t => {
              const l = dials[t.id];
              return (
                <button key={t.id} type="button" className="gm-focus-chip" onClick={() => setOpen(true)}
                  title={`${t.label}: ${DIAL_MAP[l].label}`}
                  style={{ color: l === "mute" ? "#aaa" : l === "down" ? "#6f8ea3" : RED,
                    fontWeight: l === "focus" ? 600 : 400,
                    textDecoration: l === "mute" ? "line-through" : "none", textDecorationColor: "#ccc" }}>
                  <LevelGlyph level={l} /> {t.label}
                </button>
              );
            })}
            {active.length > MAX_CHIPS && (
              <button type="button" className="gm-focus-chip" onClick={() => setOpen(true)} style={{ color: "#999" }}>
                +{active.length - MAX_CHIPS}
              </button>
            )}
          </>
        )}
        {mutedCount > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa" }}>
            · {mutedCount} hidden{" "}
            <button type="button" onClick={() => setShowMuted(v => !v)}
              style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: MONO, fontSize: 9,
                color: RED, textDecoration: "underline dotted", textUnderlineOffset: 2 }}>
              {showMuted ? "hide" : "show"}
            </button>
          </span>
        )}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
            border: open ? `1px solid ${RED}` : "1px solid #ddd", background: open ? "#fdecea" : "#fff",
            color: open ? RED : "#888", transition: "all 0.15s" }}>
          {open ? "done ▴" : "tune ▾"}
        </button>
      </div>

      {/* Tuning panel */}
      {open && (
        <div style={{ marginTop: 8, background: "#faf8f3", border: "1px solid #efe9dd", borderRadius: 8,
          padding: "10px 14px 8px", animation: "fadeIn 0.2s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", columnGap: 28, rowGap: 10 }}>
            {TOPIC_GROUPS.map(g => (
              <div key={g.id}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase",
                  borderBottom: "1px solid #efe9dd", paddingBottom: 3, marginBottom: 2 }}>{g.label}</div>
                {TOPICS.filter(t => t.group === g.id).map(t => {
                  const l = dials[t.id] || "neutral";
                  const c = counts[t.id] || 0;
                  return (
                    <div key={t.id} className="gm-focus-row"
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 2px", borderRadius: 3 }}>
                      <span style={{ fontFamily: SERIF, fontSize: 13, lineHeight: 1.2, minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: l === "mute" ? "#aaa" : "#1a1a1a", fontWeight: l === "focus" ? 600 : 400,
                        textDecoration: l === "mute" ? "line-through" : "none", textDecorationColor: "#ccc" }}>
                        {t.label}
                        <span title={`${c} headline${c === 1 ? "" : "s"} in the last ${windowHours}h`}
                          style={{ fontFamily: MONO, fontSize: 9, color: c ? "#999" : "#ccc", marginLeft: 6, fontWeight: 400 }}>{c}</span>
                      </span>
                      {/* dotted leader carries the eye from label to dial on wide columns */}
                      <span aria-hidden style={{ flex: 1, minWidth: 8, alignSelf: "center", marginTop: 6, borderBottom: "1px dotted #ddd5c6" }} />
                      <Dial topic={t} level={l} onChange={lvl => set(t.id, lvl)} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8, paddingTop: 6, borderTop: "1px solid #efe9dd" }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#999", lineHeight: 1.5 }}>
              Up ×1.5 · Focus ×2 and up to {MAX_PER_SOURCE_FOCUS} stories per source (vs {MAX_PER_SOURCE}) · ✕ hides the topic · also steers the briefs · counts = last {windowHours}h
            </span>
            <button type="button" disabled={!active.length} onClick={() => onChange({})}
              style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, padding: "2px 8px", borderRadius: 3,
                border: "1px solid #ddd", background: "#fff", color: active.length ? "#555" : "#ccc",
                cursor: active.length ? "pointer" : "not-allowed" }}>
              reset all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
