import { useState } from "react";
import { SIGNALS } from "../../data/macroSignals.js";
import { C, MONO, SERIF, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";
import { fmtDate } from "../../macroFormat.js";

const SIG = Object.fromEntries(SIGNALS.map(s => [s.id, s]));
const DECISION_LABEL = { acted: "acted", deferred: "deferred", no_action: "no action" };
const DECISION_COLOR = { acted: C.green, deferred: C.goldDark, no_action: C.sub };
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Inline form shared by the alert inbox and the log: decision, review date
// (deferrals only) and a note. A deferral must say what you are waiting for —
// "deferred" without a trigger is the procrastination trap.
export function DecisionForm({ today, initial = "acted", onSave, onCancel, fs }) {
  const [decision, setDecision] = useState(initial);
  const [due, setDue] = useState(addDays(today, 14));
  const [note, setNote] = useState("");
  const needNote = decision === "deferred" && !note.trim();
  const save = () => { if (!needNote) onSave({ decision, due_date: decision === "deferred" ? due : null, note: note.trim() || null }); };
  return (
    <div role="group" aria-label="Log a decision" style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
      {Object.entries(DECISION_LABEL).map(([k, l]) => (
        <button key={k} onClick={() => setDecision(k)} style={chipBtn(decision === k, DECISION_COLOR[k])}>{l}</button>
      ))}
      {decision === "deferred" && <input type="date" value={due} min={today} onChange={e => setDue(e.target.value)} style={inputStyle} aria-label="Review date" />}
      <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} style={{ ...inputStyle, flex: "1 1 180px" }}
        placeholder={decision === "deferred" ? "waiting for exactly what? (required)" : decision === "acted" ? "what you did, e.g. added 1/3 duration" : "why no action"} aria-label="Decision note" />
      <button onClick={save} disabled={needNote} style={{ ...chipBtn(false, C.ink), opacity: needNote ? 0.5 : 1 }}>save</button>
      <button onClick={onCancel} style={chipBtn(false)}>cancel</button>
      {decision === "deferred" && <span style={smallMono(fs)}>a reminder is pushed on the review date</span>}
    </div>
  );
}

// The decision log: open deferrals first (due ones in red), then history.
// Repeated deferrals of the same signal are flagged — the bias guardrail.
export default function DecisionLog({ decisions, logDecision, resolveDecision, results, today }) {
  const fs = useFs();
  const [adding, setAdding] = useState(false);
  const [sig, setSig] = useState("");
  const [more, setMore] = useState(false);
  const open = decisions.filter(d => d.decision === "deferred" && !d.resolved).sort((a, b) => ((a.due_date || "9") < (b.due_date || "9") ? -1 : 1));
  const done = decisions.filter(d => !(d.decision === "deferred" && !d.resolved));
  // Flag a repeatedly deferred signal once, on its earliest-due open deferral.
  const flagOn = new Set(Object.values(open.reduce((m, d) => (d.signal_id && !m[d.signal_id] ? { ...m, [d.signal_id]: d.id } : m), {})));
  const deferCount = decisions.reduce((m, d) => (d.decision === "deferred" && d.signal_id ? { ...m, [d.signal_id]: (m[d.signal_id] || 0) + 1 } : m), {});

  const row = d => {
    const s = SIG[d.signal_id];
    const due = d.decision === "deferred" && !d.resolved && d.due_date && d.due_date <= today;
    const repeat = flagOn.has(d.id) && deferCount[d.signal_id] >= 2;
    return (
      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "44px 62px minmax(0,1fr) auto", gap: 6, alignItems: "baseline", padding: "3px 0", borderTop: `1px solid ${C.line2}`, opacity: d.resolved ? 0.6 : 1 }}>
        <span style={smallMono(fs)}>{fmtDate((d.created_at || "").slice(0, 10))}</span>
        <span style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 700, color: DECISION_COLOR[d.decision] }}>{DECISION_LABEL[d.decision]?.toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink }}>{s ? `#${s.n} ${s.label}` : d.alert_id ? "alert" : "general"}</span>
          {d.status_at && <span style={smallMono(fs)}> · status then: {d.status_at}</span>}
          {d.note && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.sub }}>{d.note}</div>}
          {repeat && <div style={{ fontFamily: SERIF, fontSize: fs(11), color: C.red }}>
            ⚑ Deferred {deferCount[d.signal_id]}× — if no new fact would change the call, this is fortification, not diligence. Decide.</div>}
        </div>
        <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {d.decision === "deferred" && d.due_date && <span style={smallMono(fs, due ? C.red : C.mute)}>{due ? "due " : "review "}{fmtDate(d.due_date)}</span>}
          {d.pending && <span style={smallMono(fs, C.goldDark)} title="Saved in this browser; uploads at the next sync"> · local</span>}
          {d.decision === "deferred" && !d.resolved && <button onClick={() => resolveDecision(d.id, true)} style={{ ...chipBtn(false, C.ink), marginLeft: 4 }}>resolved</button>}
        </span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>DECISION LOG</span>
        <span style={smallMono(fs)}>{open.length} open deferral{open.length === 1 ? "" : "s"} · {decisions.length} logged · last 180 days</span>
        <button onClick={() => setAdding(a => !a)} style={{ ...chipBtn(adding, C.ink), marginLeft: "auto" }}>{adding ? "close" : "+ log a decision"}</button>
      </div>
      {adding && (
        <div style={{ padding: "4px 0" }}>
          <select value={sig} onChange={e => setSig(e.target.value)} style={{ ...inputStyle, maxWidth: "100%" }} aria-label="Signal">
            <option value="">general (no signal)</option>
            {SIGNALS.map(s => <option key={s.id} value={s.id}>#{s.n} {s.label}</option>)}
          </select>
          <DecisionForm today={today} fs={fs} onCancel={() => setAdding(false)} onSave={async f => {
            const r = results?.[sig];
            await logDecision({ ...f, signal_id: sig || null, status_at: r?.status || null, value_at: r?.value ? String(r.value).slice(0, 300) : null });
            setAdding(false); setSig("");
          }} />
        </div>
      )}
      {open.map(row)}
      {done.length > 0 && <button onClick={() => setMore(x => !x)} style={{ ...chipBtn(more, C.ink), marginTop: 4 }}>{more ? "hide history" : `history (${done.length})`}</button>}
      {more && done.slice(0, 60).map(row)}
      {!decisions.length && !adding && <div style={{ ...smallMono(fs), marginTop: 2 }}>Nothing logged yet. Log what you did — or chose not to do — when an ACT or WATCH alert fires.</div>}
    </div>
  );
}
