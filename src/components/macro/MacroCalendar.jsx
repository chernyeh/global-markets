import { useState } from "react";
import { buildCalendar, EVENT_TYPES, fmtDay, daysUntil } from "../../data/macroCalendar.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";

const WINDOW_DAYS = 45;

function Row({ e, today, fs, onRemove }) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.us;
  const d = daysUntil(e.date, today);
  const live = e.end && e.date <= today;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "50px 38px minmax(0,1fr) auto", gap: 6, alignItems: "baseline", padding: "3px 0", borderBottom: `1px solid ${C.line2}`, opacity: e.minor ? 0.75 : 1 }}>
      <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.ink, fontWeight: e.minor ? 400 : 600 }}>{e.approx ? "≈" : ""}{fmtDay(e.date)}</span>
      <span style={{ fontFamily: MONO, fontSize: fs(8), fontWeight: 700, color: t.color, letterSpacing: "0.05em" }}>{t.label}</span>
      <span style={{ fontFamily: SERIF, fontSize: fs(e.minor ? 11.5 : 12.5), color: e.minor ? C.sub : C.ink, minWidth: 0 }} title={e.note || ""}>
        {e.label}{e.end ? ` (to ${fmtDay(e.end)})` : ""}{e.note ? <span style={{ ...smallMono(fs), marginLeft: 4 }}>· {e.note}</span> : null}
      </span>
      <span style={{ fontFamily: MONO, fontSize: fs(9), color: d <= 7 || live ? C.red : C.mute, whiteSpace: "nowrap" }}>
        {live ? "now" : d === 0 ? "today" : `${d}d`}
        {e.mine && <button onClick={() => onRemove(e.id)} aria-label="Remove event" style={{ ...chipBtn(false), marginLeft: 4, padding: "0 4px" }}>✕</button>}
      </span>
    </div>
  );
}

export default function MacroCalendar({ today, userEvents, setUserEvents }) {
  const fs = useFs();
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
        <span style={smallMono(fs)}>≈ = approximate (playbook "mid-month" dates) · FOMC dates per the Fed's 12 Nov revision</span>
      </div>
      {soon.map((e, i) => <Row key={`${e.date}-${e.label}-${i}`} e={e} today={today} fs={fs} onRemove={remove} />)}
      <button onClick={() => setLater(l => !l)} style={{ ...chipBtn(later, C.ink), marginTop: 6 }}>{later ? "hide later" : `later (${rest.length})`}</button>
      {later && <div style={{ marginTop: 4 }}>{rest.map((e, i) => <Row key={`${e.date}-${e.label}-${i}`} e={e} today={today} fs={fs} onRemove={remove} />)}</div>}
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
