import { useState } from "react";
import { TOPIC_GROUPS, TOPIC_PRESETS } from "../data/taxonomy.js";
import { DIAL_LEVELS, DIAL_MAP, DECAYING, DECAY_MS, timeLeft, makeCustomTopic, MAX_CUSTOM_TOPICS, SURGE_RATIO, MAX_PER_SOURCE, MAX_PER_SOURCE_FOCUS } from "../topicDials.js";

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS DIALS — Breaking tab
// ═══════════════════════════════════════════════════════════════════════════════
// Collapsed: one hairline strip inside the Breaking header card that names only
// the topics moved off Neutral, so the reader always sees how the feed is tilted.
// "tune" opens an inline panel: topics in three columns, each with a four-bar
// level meter (Down → Focus) and a separate ✕ to hide the topic.
//
// Safeguards against a feed that only confirms what the reader already thinks:
//   • Up / Focus fade back to Neutral after 72h. Each such row shows the time
//     left; clicking it pins the setting (∞). Re-clicking a level restarts it.
//     A lapsed setting is announced in the strip with "restore".
//   • "mine | neutral" re-ranks the feed with every dial at default and marks
//     the stories the dials are keeping out.
//
// Phase 2–3, inside the panel's top band and the strip's status line:
//   • Presets set several dials for a market regime in one click (undoable).
//   • TAPE shows today's move in each market gauge; a big move suggests topics.
//   • Suggestions (strip) offer to dial up topics whose coverage is surging or
//     whose gauge moved — never applied without a click.
//   • "Your topics" column: keyword topics the reader adds and removes.

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
const AMBER = "#8a6a20";             // "attention, not alarm" — matches "focus changed"
const DECAY_H = Math.round(DECAY_MS / 3600000);

const fmtLeft = ms => ms >= 3600000 ? `${Math.floor(ms / 3600000)}h` : `${Math.max(1, Math.ceil(ms / 60000))}m`;

const CSS = `
  .gm-dial-btn{border:none;background:none;padding:0;margin:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;height:22px;width:9px}
  .gm-dial-x{width:18px;align-items:center;font-family:${MONO};font-size:10px;line-height:1}
  .gm-dial-btn:focus-visible{outline:1px solid ${RED};outline-offset:1px;border-radius:2px}
  .gm-focus-row:hover{background:#fdfbf7}
  .gm-focus-chip{border:none;background:none;padding:0;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:${MONO};font-size:10px;white-space:nowrap}
  .gm-dial-timer{border:none;background:none;padding:0 2px;margin:0;cursor:pointer;font-family:${MONO};font-size:9px;width:28px;text-align:right;flex-shrink:0;height:22px;border-radius:2px}
  .gm-dial-timer:hover{background:#f0ebe0}
  .gm-dial-timer:focus-visible{outline:1px solid ${RED};outline-offset:1px}
  .gm-view-seg{border:1px solid #ddd;background:#fff;color:#888;font-family:${MONO};font-size:9px;padding:2px 7px;cursor:pointer;transition:all 0.15s}
  .gm-view-seg[aria-pressed="true"]{border-color:${RED};background:${RED};color:#fff}
  .gm-link{border:none;background:none;padding:0;cursor:pointer;font-family:${MONO};font-size:9px;text-decoration:underline dotted;text-underline-offset:2px}
  .gm-preset{border:1px solid #ddd;background:#fff;color:#777;font-family:${MONO};font-size:9px;padding:2px 7px;border-radius:3px;cursor:pointer;white-space:nowrap;transition:all 0.15s}
  .gm-preset:hover{border-color:${RED};color:${RED}}
  .gm-preset[aria-pressed="true"]{border-color:${RED};background:${RED};color:#fff}
  .gm-rm{border:none;background:none;padding:0 0 0 6px;cursor:pointer;font-family:${MONO};font-size:9px;color:#bbb;opacity:0;transition:opacity 0.15s}
  .gm-focus-row:hover .gm-rm,.gm-rm:focus-visible{opacity:1}
  .gm-rm:hover{color:${RED}}
  .gm-add-input{border:none;border-bottom:1px solid #ddd5c6;background:transparent;font-family:${MONO};font-size:10px;color:#1a1a1a;padding:3px 0;flex:1;min-width:0;outline:none}
  .gm-add-input:focus{border-bottom-color:${RED}}
  .gm-add-input::placeholder{color:#bbb}
  @media (pointer:coarse){ .gm-rm{opacity:1} .gm-dial-btn{width:14px;height:28px} .gm-dial-x{width:24px} .gm-dial-timer{height:28px;width:32px} }
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

// Time left before an Up / Focus setting fades; click to pin or unpin. Other
// levels get an empty slot of the same width so the dials stay aligned.
function DecayTimer({ topic, rec, onTogglePin }) {
  if (!rec || !DECAYING.has(rec.level)) return <span style={{ width: 28, flexShrink: 0 }} />;
  const left = timeLeft(rec);
  const soon = left !== null && left < 12 * 3600000;
  return (
    <button type="button" className="gm-dial-timer" onClick={onTogglePin} aria-pressed={rec.pinned}
      aria-label={rec.pinned ? `${topic.label} pinned` : `${topic.label} fades in ${fmtLeft(left)}`}
      title={rec.pinned
        ? `Pinned — stays until you change it. Click to let it fade after ${DECAY_H}h.`
        : `Fades back to Neutral in ${fmtLeft(left)}. Click to pin; click the level again to restart the clock.`}
      style={{ color: rec.pinned ? "#555" : soon ? AMBER : "#aaa" }}>
      {rec.pinned ? "∞" : fmtLeft(left)}
    </button>
  );
}

// min(300px,100%) lets a phone-width panel fall to one column without overflowing.
const GRID_COLS = "repeat(auto-fit,minmax(min(300px,100%),1fr))";

function GroupHead({ label, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid #efe9dd", paddingBottom: 3, marginBottom: 2 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      {note && <span style={{ fontFamily: MONO, fontSize: 9, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{note}</span>}
    </div>
  );
}

export default function TopicDials({ dials, onChange, counts, windowHours, mutedCount, showMuted, setShowMuted,
  neutralView, setNeutralView, outsideCount, lapsed, onRestoreLapsed, onDismissLapsed,
  topics, customTopics, onCustomTopicsChange,
  activePreset, onPreset, canUndoPreset, onUndoPreset,
  gauges, gaugeStatus, surges, surgeReady, suggestions, onAcceptSuggestions, onDismissSuggestions }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const levelOf = id => dials[id]?.level || "neutral";
  const active = topics.filter(t => levelOf(t.id) !== "neutral");
  // Setting a level (even the current one) restarts its 72h clock; a pin carries
  // over. setAt is left blank here and stamped by normalizeDialRecords on save.
  const set = (id, lvl) => {
    const next = { ...dials };
    if (lvl === "neutral") delete next[id];
    else next[id] = { level: lvl, pinned: !!dials[id]?.pinned };
    onChange(next);
  };
  const togglePin = id => {
    const r = dials[id];
    if (r) onChange({ ...dials, [id]: { level: r.level, pinned: !r.pinned } });
  };
  const MAX_CHIPS = 4;
  const labelOf = id => topics.find(t => t.id === id)?.label;
  const lapsedLabels = (lapsed || []).map(e => labelOf(e.id)).filter(Boolean);

  // Why a topic is flagged live: coverage surge and/or a gauge that fired on it.
  const liveReasons = id => [
    ...(surges[id] ? [`coverage ×${surges[id].ratio.toFixed(1)} vs earlier headlines`] : []),
    ...gauges.filter(g => g.result?.triggered && g.topics.includes(id)).map(g => `${g.label} ${g.result.text}`),
  ];

  const addCustom = e => {
    e.preventDefault();
    const c = makeCustomTopic(draft, customTopics);
    if (!c || customTopics.length >= MAX_CUSTOM_TOPICS) return;
    onCustomTopicsChange([...customTopics, c]);
    setDraft("");
  };
  const removeCustom = id => onCustomTopicsChange(customTopics.filter(c => c.id !== id));

  const renderRow = t => {
    const l = levelOf(t.id);
    const c = counts[t.id] || 0;
    const live = liveReasons(t.id);
    return (
      <div key={t.id} className="gm-focus-row"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 2px", borderRadius: 3 }}>
        <span title={t.custom ? `Matches: ${t.terms.join(" · ")}` : undefined}
          style={{ fontFamily: SERIF, fontSize: 13, lineHeight: 1.2, minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: l === "mute" ? "#aaa" : "#1a1a1a", fontWeight: l === "focus" ? 600 : 400,
          textDecoration: l === "mute" ? "line-through" : "none", textDecorationColor: "#ccc" }}>
          {t.label}
          <span title={`${c} headline${c === 1 ? "" : "s"} in the last ${windowHours}h`}
            style={{ fontFamily: MONO, fontSize: 9, color: c ? "#999" : "#ccc", marginLeft: 6, fontWeight: 400 }}>{c}</span>
          {live.length > 0 && (
            <span title={`Live: ${live.join(" · ")}`} aria-label={`Live: ${live.join(", ")}`}
              style={{ fontFamily: MONO, fontSize: 10, color: AMBER, marginLeft: 3, fontWeight: 600 }}>↑</span>
          )}
        </span>
        {t.custom && (
          <button type="button" className="gm-rm" onClick={() => removeCustom(t.id)} aria-label={`Remove ${t.label}`}
            title={`Remove "${t.label}" from your topics`}>remove</button>
        )}
        {/* dotted leader carries the eye from label to dial on wide columns */}
        <span aria-hidden style={{ flex: 1, minWidth: 8, alignSelf: "center", marginTop: 6, borderBottom: "1px dotted #ddd5c6" }} />
        <DecayTimer topic={t} rec={dials[t.id]} onTogglePin={() => togglePin(t.id)} />
        <Dial topic={t} level={l} onChange={lvl => set(t.id, lvl)} />
      </div>
    );
  };

  return (
    <div style={{ borderTop: "1px solid #f0ece4", marginTop: 10, paddingTop: 8 }}>
      <style>{CSS}</style>

      {/* Collapsed strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "#888", letterSpacing: "0.08em" }}>FOCUS</span>
        {activePreset && (
          <button type="button" className="gm-focus-chip" onClick={() => setOpen(true)} title={`Preset: ${activePreset.label}`}
            style={{ color: "#555", fontSize: 9, border: "1px solid #ddd", borderRadius: 3, padding: "1px 6px" }}>
            {activePreset.short}
          </button>
        )}
        {active.length === 0 ? (
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa" }}>balanced — all topics at default weight</span>
        ) : (
          <>
            {active.slice(0, MAX_CHIPS).map(t => {
              const l = levelOf(t.id);
              const left = timeLeft(dials[t.id]);
              return (
                <button key={t.id} type="button" className="gm-focus-chip" onClick={() => setOpen(true)}
                  title={`${t.label}: ${DIAL_MAP[l].label}`}
                  style={{ color: l === "mute" ? "#aaa" : l === "down" ? "#6f8ea3" : RED,
                    fontWeight: l === "focus" ? 600 : 400, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
                    textDecoration: l === "mute" ? "line-through" : "none", textDecorationColor: "#ccc" }}>
                  <LevelGlyph level={l} /> {t.label}
                  {left !== null && left < 24 * 3600000 && (
                    <span style={{ color: left < 12 * 3600000 ? AMBER : "#aaa", fontWeight: 400, fontSize: 9 }}>· {fmtLeft(left)}</span>
                  )}
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
        {!neutralView && mutedCount > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa", whiteSpace: "nowrap" }}>
            · {mutedCount} hidden{" "}
            <button type="button" className="gm-link" onClick={() => setShowMuted(v => !v)} style={{ color: RED }}>
              {showMuted ? "hide" : "show"}
            </button>
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {active.length > 0 && (
            <span role="group" aria-label="Feed view" style={{ display: "inline-flex" }}
              title="Neutral re-ranks the feed with every dial at default and marks what your dials keep out">
              <button type="button" className="gm-view-seg" aria-pressed={!neutralView} onClick={() => setNeutralView(false)}
                style={{ borderRadius: "3px 0 0 3px" }}>mine</button>
              <button type="button" className="gm-view-seg" aria-pressed={neutralView} onClick={() => setNeutralView(true)}
                style={{ borderRadius: "0 3px 3px 0", marginLeft: -1 }}>neutral</button>
            </span>
          )}
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            style={{ fontFamily: MONO, fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
              border: open ? `1px solid ${RED}` : "1px solid #ddd", background: open ? "#fdecea" : "#fff",
              color: open ? RED : "#888", transition: "all 0.15s" }}>
            {open ? "done ▴" : "tune ▾"}
          </button>
        </span>
      </div>

      {/* Status line — only when there is something to say; kept off the strip
          so the chips don't reflow around transient notes */}
      {(neutralView || lapsedLabels.length > 0 || suggestions.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, rowGap: 2, marginTop: 4, fontFamily: MONO, fontSize: 9, lineHeight: 1.6 }}>
          {suggestions.length > 0 && (
            <span role="status" style={{ fontFamily: MONO, color: AMBER }}
              title="Suggested because coverage of the topic has surged against earlier headlines, or its market gauge moved sharply. Nothing changes until you click.">
              ↑ {suggestions.length === 1 ? "Looks live:" : "Look live:"}{" "}
              {suggestions.map((sg, i) => (
                <span key={sg.id} style={{ fontFamily: MONO }}>
                  {i > 0 && ", "}
                  <button type="button" className="gm-link" onClick={() => onAcceptSuggestions([sg.id])}
                    title={`Dial ${sg.label} up`} style={{ color: AMBER, fontWeight: 600 }}>{sg.label}</button>
                  <span style={{ fontFamily: MONO, color: "#a08a50" }}> ({sg.reasons.map(r => r.text).join(", ")})</span>
                </span>
              ))}{" "}
              <span style={{ fontFamily: MONO, whiteSpace: "nowrap" }}>
                · <button type="button" className="gm-link" onClick={() => onAcceptSuggestions(suggestions.map(sg => sg.id))} style={{ color: AMBER }}>
                  {suggestions.length === 1 ? "dial up" : "dial all up"}</button>
                {" · "}<button type="button" className="gm-link" onClick={onDismissSuggestions} style={{ color: "#aaa" }}>not now</button>
              </span>
            </span>
          )}
          {neutralView && (
            <span style={{ fontFamily: MONO, color: "#6f8ea3" }}>
              ◇ neutral view — {outsideCount
                ? <>{outsideCount} {outsideCount === 1 ? "story" : "stories"} your dials keep out {outsideCount === 1 ? "is" : "are"} marked below</>
                : "your dials keep nothing out in this window"}
            </span>
          )}
          {lapsedLabels.length > 0 && (
            <span role="status" style={{ fontFamily: MONO, color: AMBER }}>
              ↺ {lapsedLabels.join(", ")} lapsed to neutral after {DECAY_H}h{" "}
              <span style={{ fontFamily: MONO, whiteSpace: "nowrap" }}>
                · <button type="button" className="gm-link" onClick={onRestoreLapsed} style={{ color: AMBER }}>restore</button>
                {" · "}<button type="button" className="gm-link" onClick={onDismissLapsed} style={{ color: "#aaa" }}>dismiss</button>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Tuning panel */}
      {open && (
        <div style={{ marginTop: 8, background: "#faf8f3", border: "1px solid #efe9dd", borderRadius: 8,
          padding: "10px 14px 8px", animation: "fadeIn 0.2s ease" }}>

          {/* Top band: presets, then today's tape */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6, alignItems: "start",
            paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #efe9dd" }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa", letterSpacing: "0.1em", alignSelf: "start", paddingTop: 4 }}>PRESETS</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              {TOPIC_PRESETS.map(p => (
                <button key={p.id} type="button" className="gm-preset" aria-pressed={activePreset?.id === p.id}
                  onClick={() => onPreset(p)}
                  title={`${p.label}: ${Object.entries(p.dials).map(([id, l]) => `${labelOf(id)} ${DIAL_MAP[l].label.toLowerCase()}`).join(" · ")}. Other Up/Focus/Down return to neutral; hidden and pinned topics are kept.`}>
                  {p.label}
                </button>
              ))}
              {canUndoPreset && (
                <button type="button" className="gm-link" onClick={onUndoPreset} style={{ color: "#888", marginLeft: 4 }}>undo preset</button>
              )}
            </div>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#aaa", letterSpacing: "0.1em", alignSelf: "start", paddingTop: 1 }}
              title="Latest daily move in each gauge vs the previous close. A move past its threshold suggests the topic.">TAPE</span>
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 2, fontFamily: MONO, fontSize: 9, color: "#888" }}>
              {gaugeStatus === "idle" ? <span style={{ fontFamily: MONO, color: "#bbb" }}>loading…</span>
                : gaugeStatus === "unavailable" ? <span style={{ fontFamily: MONO, color: "#bbb" }}>market data unavailable — coverage signals still work</span>
                : gauges.map(g => (
                  <span key={g.sym} style={{ fontFamily: MONO, whiteSpace: "nowrap", color: g.result?.triggered ? AMBER : "#888", fontWeight: g.result?.triggered ? 600 : 400 }}
                    title={g.result ? `${g.label} ${g.result.text} — threshold ${g.upOnly ? "+" : "±"}${g.threshold}${g.unit === "bp" ? "bp" : "%"} → ${g.topics.map(labelOf).join(", ")}` : `${g.label}: no data`}>
                    {g.label} <span style={{ fontFamily: MONO, color: g.result ? undefined : "#ccc" }}>{g.result ? g.result.text : "—"}</span>
                    {g.result?.triggered && <span style={{ fontFamily: MONO, fontWeight: 400 }}> → {g.topics.map(labelOf).join(", ")}</span>}
                  </span>
                ))}
            </div>
          </div>

          {/* Built-in topics: three columns. Both grids share one track definition
              (auto-fit for the groups, auto-fill for Your topics) so the custom
              rows line up under the columns above at every width. */}
          <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, columnGap: 28, rowGap: 10 }}>
            {TOPIC_GROUPS.filter(g => g.id !== "custom").map(g => (
              <div key={g.id}>
                <GroupHead label={g.label} />
                {topics.filter(t => t.group === g.id).map(renderRow)}
              </div>
            ))}
          </div>

          {/* Your topics — full-width band under the columns */}
          <div style={{ marginTop: 10 }}>
            <GroupHead label={TOPIC_GROUPS.find(g => g.id === "custom").label}
              note={`${customTopics.length}/${MAX_CUSTOM_TOPICS} · a company, person or theme · commas add synonyms · whole words only`} />
            <div style={{ display: "grid", gridTemplateColumns: GRID_COLS.replace("auto-fit", "auto-fill"), columnGap: 28 }}>
              {topics.filter(t => t.group === "custom").map(renderRow)}
              <form onSubmit={addCustom} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 2px", minHeight: 22 }}>
                <input className="gm-add-input" value={draft} onChange={e => setDraft(e.target.value)}
                  disabled={customTopics.length >= MAX_CUSTOM_TOPICS}
                  placeholder={customTopics.length >= MAX_CUSTOM_TOPICS ? `limit of ${MAX_CUSTOM_TOPICS} reached — remove one first` : "+ add: Nippon Steel, US Steel"}
                  aria-label="Add a topic: one or more keywords, comma-separated" maxLength={120} />
                <button type="submit" className="gm-preset" disabled={!draft.trim() || customTopics.length >= MAX_CUSTOM_TOPICS}
                  style={{ opacity: draft.trim() ? 1 : 0.5 }}>add</button>
              </form>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8, paddingTop: 6, borderTop: "1px solid #efe9dd" }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#999", lineHeight: 1.5 }}>
              Up ×1.5 · Focus ×2 and up to {MAX_PER_SOURCE_FOCUS} stories per source (vs {MAX_PER_SOURCE}) · Up/Focus fade after {DECAY_H}h — click the timer to pin ∞ · ✕ hides the topic · <span style={{ fontFamily: MONO, color: AMBER }}>↑</span> live: coverage ≥{SURGE_RATIO}× earlier headlines{!surgeReady ? " (needs more stored headlines)" : ""} or a big gauge move · also steers the briefs · counts = last {windowHours}h
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
