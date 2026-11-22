import { useState } from "react";
import { buildCalendar, EVENT_TYPES, fmtDay, daysUntil, releaseKey } from "../../data/macroCalendar.js";
import { releaseOutcomes } from "../../macroRule10.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";

const WINDOW_DAYS = 45;
const VERDICT_COLOR = { "good-failed": C.red, "good-lifted": C.green, "good-mixed": C.amber, "bad-hurt": C.sub, "bad-shrugged": C.green, "in-line": C.sub };

// Consensus box on a release row: "0.3" or "0.3 Koyfin" (the word after the number is the source).
function ConsInput({ rec, onSave, label, fs }) {
  const [txt, setTxt] = useState(rec ? `${rec.v}${rec.src ? ` ${rec.src}` : ""}` : "");
  const commit = () => {
    const t = txt.trim();
    if (!t) { if (rec) onSave(null); return; }
    const mm = t.match(/^([+-]?\d+(?:\.\d+)?)\s*%?\s*(.*)$/);
    if (!mm) return;
    const v = Number(mm[1]), src = mm[2].trim().slice(0, 30) || null;
    if (!rec || rec.v !== v || (rec.src || null) !== src) onSave({ v, src });
  };
  return (
    <input value={txt} onChange={e => setTxt(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="cons %" title={`Consensus for ${label} — e.g. "0.3" or "0.3 Koyfin". Used for the Rule-10 check after the print.`}
      aria-label={`Consensus for ${label}`} style={{ ...inputStyle, width: 74, padding: "1px 4px", fontSize: fs(9) }} />
  );
}

function Row({ e, today, fs, onRemove, cons, onCons }) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.us;
  const d = daysUntil(e.date, today);
  const live = e.end && e.date <= today;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "50px 38px minmax(0,1fr) auto", gap: 6, alignItems: "baseline", padding: "3px 0", borderBottom: `1px solid ${C.line2}`, opacity: e.minor ? 0.75 : 1 }}>
      <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.ink, fontWeight: e.minor ? 400 : 600 }}>{e.approx ? "≈" : ""}{fmtDay(e.date)}</span>
      <span style={{ fontFamily: MONO, fontSize: fs(8), fontWeight: 700, color: t.color, letterSpacing: "0.05em" }}>{t.label}</span>
      <span style={{ fontFamily: SERIF, fontSize: fs(e.minor ? 11.5 : 12.5), color: e.minor ? C.sub : C.ink, minWidth: 0 }} title={e.note || ""}>
        {e.label}{e.end ? ` (to ${fmtDay(e.end)})` : ""}{e.note ? <span style={{ ...smallMono(fs), marginLeft: 4 }}>· {e.note}</span> : null}
        {e.release && onCons && <span style={{ marginLeft: 6, whiteSpace: "nowrap" }}>
          <span style={smallMono(fs)}>{e.release.label} </span>
          <ConsInput key={cons ? `${cons.v}${cons.src}` : "none"} rec={cons} label={e.release.label} fs={fs} onSave={v => onCons(releaseKey(e), v)} /></span>}
      </span>
      <span style={{ fontFamily: MONO, fontSize: fs(9), color: d <= 7 || live ? C.red : C.mute, whiteSpace: "nowrap" }}>
        {live ? "now" : d === 0 ? "today" : `${d}d`}
        {e.mine && <button onClick={() => onRemove(e.id)} aria-label="Remove event" style={{ ...chipBtn(false), marginLeft: 4, padding: "0 4px" }}>✕</button>}
      </span>
    </div>
  );
}

export default function MacroCalendar({ today, userEvents, setUserEvents, series, pasted, setPasted }) {
  const fs = useFs();
  const consensus = pasted?.consensus || {};
  const setCons = (key, rec) => {
    const next = { ...consensus };
    delete next.at;
    if (rec) next[key] = rec; else delete next[key];
    setPasted("consensus", next);
  };
  // Rule 10 (signal 17): prints in the last 30 days, with the market's reaction.
  const outcomes = series ? releaseOutcomes(series, consensus, today).filter(o => o.verdict !== "upcoming" && daysUntil(o.event.date, today) >= -30) : [];
  const [later, setLater] = useState(false);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const items = buildCalendar(userEvents).filter(e => (e.end || e.date) >= today);
  const inWin = e => daysUntil(e.date, today) <= WINDOW_DAYS;
  const soon = items.filter(inWin);
  const rest = items.filter(e => !inWin(e) && !e.minor);
  const add = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label.trim()) return;
    setUserEvents([...userEvents, { id: `${Date.now()}`, date, label: label.trim() }]);
    setDate(""); setLabel("");
  };
  const remove = id => setUserEvents(userEvents.filter(x => x.id !== id));
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>CALENDAR · NEXT {WINDOW_DAYS} DAYS</span>
        <span style={smallMono(fs)}>≈ = approximate (playbook "mid-month" dates) · FOMC dates per the Fed's 12 Nov revision · paste consensus on CPI / PCE / PPI rows for the Rule-10 check</span>
      </div>
      {outcomes.length > 0 && (
        <div style={{ background: C.cream, borderRadius: 4, padding: "4px 8px", margin: "2px 0 6px" }}>
          <div style={smallMono(fs, C.sub)}>RULE 10 · RECENT PRINTS — good news that fails to lift prices is a red flag (signal 17)</div>
          {outcomes.map(o => (
            <div key={o.key} style={{ display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 6, alignItems: "baseline", padding: "2px 0" }}>
              <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.ink }}>{fmtDay(o.event.date)}</span>
              <span style={{ fontFamily: SERIF, fontSize: fs(11.5), color: VERDICT_COLOR[o.verdict] || C.sub, minWidth: 0 }}>{o.text || o.event.label}</span>
              {setPasted && <ConsInput key={o.consensus ? `${o.consensus.v}${o.consensus.src}` : "none"} rec={o.consensus} label={o.event.release.label} fs={fs} onSave={v => setCons(o.key, v)} />}
            </div>
          ))}
        </div>
      )}
      {soon.map((e, i) => <Row key={`${e.date}-${e.label}-${i}`} e={e} today={today} fs={fs} onRemove={remove}
        cons={e.release ? consensus[releaseKey(e)] : null} onCons={setPasted ? setCons : null} />)}
      <button onClick={() => setLater(l => !l)} style={{ ...chipBtn(later, C.ink), marginTop: 6 }}>{later ? "hide later" : `later (${rest.length})`}</button>
      {later && <div style={{ marginTop: 4 }}>{rest.map((e, i) => <Row key={`${e.date}-${e.label}-${i}`} e={e} today={today} fs={fs} onRemove={remove}
        cons={e.release ? consensus[releaseKey(e)] : null} onCons={setPasted ? setCons : null} />)}</div>}
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={smallMono(fs)}>ADD</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} aria-label="Event date" />
        <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="e.g. IREIT Berlin Campus decision"
          style={{ ...inputStyle, flex: "1 1 160px" }} aria-label="Event description" />
        <button onClick={add} style={chipBtn(false, C.ink)}>add</button>
      </div>
    </div>
  );
}
