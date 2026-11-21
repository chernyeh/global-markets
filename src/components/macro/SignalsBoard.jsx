import { useState } from "react";
import { SIGNALS, SIGNAL_GROUPS } from "../../data/macroSignals.js";
import { PASTE_LIFE_MS } from "../../macroSignals.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

const STATUS = {
  met:     { icon: "●", word: "met" },
  partial: { icon: "◐", word: "partly met" },
  not:     { icon: "○", word: "not met" },
  na:      { icon: "–", word: "no data" },
  unset:   { icon: "◇", word: "not set" },
};
const statusColor = (status, groupColor) =>
  status === "met" || status === "partial" ? groupColor : status === "unset" ? C.goldDark : status === "na" ? C.ghost : C.faint;

function ManualControls({ sig, result, onSet, fs }) {
  const [note, setNote] = useState(result.manual && result.value !== "set by you" && result.value !== sig.preset ? result.value : "");
  const set = status => onSet(sig.id, status ? { status, note: note.trim() || null } : null);
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      <span style={smallMono(fs)}>YOUR CALL</span>
      {["met", "partial", "not"].map(st => (
        <button key={st} onClick={() => set(st)} style={chipBtn(result.status === st, C.ink)}>{STATUS[st].icon} {STATUS[st].word}</button>
      ))}
      {result.status !== "unset" && <button onClick={() => set(null)} style={chipBtn(false)}>clear</button>}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="note (optional), e.g. statement wording"
        onKeyDown={e => { if (e.key === "Enter" && result.status !== "unset") set(result.status); }}
        style={{ ...inputStyle, flex: "1 1 160px", minWidth: 120 }} aria-label={`Note for signal ${sig.n}`} />
    </div>
  );
}

function OatBundPaste({ pasted, setPasted, fs, now }) {
  const p = pasted?.oatBund;
  const [v, setV] = useState("");
  const fresh = p && now - p.at < PASTE_LIFE_MS;
  const save = () => { const n = parseFloat(v); if (Number.isFinite(n)) { setPasted("oatBund", { v: n }); setV(""); } };
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      <span style={smallMono(fs)}>DAILY SPREAD</span>
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} inputMode="decimal"
        placeholder="bp, e.g. 152" style={{ ...inputStyle, width: 90 }} aria-label="Paste today's OAT–Bund 10y spread in basis points" />
      <button onClick={save} style={chipBtn(false, C.ink)}>save</button>
      {p && <span style={smallMono(fs, fresh ? C.sub : C.faint)}>
        pasted {Math.round(p.v)}bp · {fmtStamp(p.at)}{fresh ? "" : " · lapsed (older than 21 days)"}
        <button onClick={() => setPasted("oatBund", null)} style={{ ...chipBtn(false), marginLeft: 4 }}>✕</button>
      </span>}
    </div>
  );
}

function SignalRow({ sig, result, group, open, onToggle, onSetManual, pasted, setPasted, fs, now }) {
  const st = STATUS[result.status] || STATUS.na;
  const col = statusColor(result.status, group.color);
  return (
    <div style={{ borderBottom: `1px solid ${C.line2}`, padding: "4px 0" }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ display: "grid", gridTemplateColumns: "14px 20px minmax(0,1fr)", gap: 4, width: "100%", textAlign: "left",
          background: "none", border: "none", padding: 0, cursor: "pointer", alignItems: "start" }}>
        <span style={{ color: col, fontSize: fs(12), lineHeight: 1.2 }} title={st.word} aria-label={st.word}>{st.icon}</span>
        <span style={{ ...smallMono(fs, C.sub), lineHeight: 1.8 }}>{sig.n}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, fontWeight: result.status === "met" ? 700 : 500 }}>{sig.label}</span>
          {!sig.auto && <span style={{ ...smallMono(fs, C.goldDark), marginLeft: 5 }}>YOU</span>}
          <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), color: result.status === "met" ? col : C.mute, lineHeight: 1.45 }}>
            {st.word} · {result.value}
          </span>
        </span>
      </button>
      {open && (
        <div style={{ margin: "4px 0 2px 38px", fontFamily: SERIF, fontSize: fs(11.5), color: C.sub, lineHeight: 1.45 }}>
          <div><b style={{ color: C.ink }}>Met when:</b> {sig.threshold}</div>
          <div style={{ marginTop: 2 }}><b style={{ color: group.color }}>→ If met:</b> {sig.action}</div>
          <div style={{ marginTop: 2 }}><b style={{ color: C.goldDark }}>⚑ No action unless:</b> {sig.guard}</div>
          <div style={{ ...smallMono(fs), marginTop: 3 }}>
            {sig.src}{result.asOf ? ` · as of ${result.asOf}` : ""}{!sig.auto && sig.phase ? ` · automated in Phase ${sig.phase}` : ""}
            {result.detail ? ` · ${result.detail}` : ""}
          </div>
          {!sig.auto && <ManualControls sig={sig} result={result} onSet={onSetManual} fs={fs} />}
          {(sig.id === "s8" || sig.id === "s8b") && <OatBundPaste pasted={pasted} setPasted={setPasted} fs={fs} now={now} />}
        </div>
      )}
    </div>
  );
}

export default function SignalsBoard({ results, onSetManual, pasted, setPasted, now }) {
  const fs = useFs();
  const [open, setOpen] = useState(null);
  const counts = s => SIGNALS.filter(x => x.group === s).reduce((a, x) => { const st = results[x.id]?.status; a[st] = (a[st] || 0) + 1; return a; }, {});
  return (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={kickerStyle(fs)}>SIGNALS BOARD</span>
        <span style={smallMono(fs)}>
          from the Bear-Market Playbook (rev 54, 20 Nov) · * = illustrative threshold · ● met ◐ partly ○ not – no data ◇ yours to set · click a signal for its action and guard
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(250px,100%),1fr))", gap: 14 }}>
        {SIGNAL_GROUPS.map(g => {
          const c = counts(g.id);
          return (
            <div key={g.id} style={{ minWidth: 0 }}>
              <div style={{ borderBottom: `2px solid ${g.color}`, paddingBottom: 3, marginBottom: 2 }}>
                <div style={{ fontFamily: MONO, fontSize: fs(10), fontWeight: 600, letterSpacing: "0.08em", color: g.color }}>{g.label}</div>
                <div style={smallMono(fs)}>
                  {[c.met && `${c.met} met`, c.partial && `${c.partial} partly`, c.unset && `${c.unset} to set`, c.na && `${c.na} no data`].filter(Boolean).join(" · ") || "none met"}
                  {" — "}{g.blurb}
                </div>
              </div>
              {SIGNALS.filter(s => s.group === g.id).map(sig => (
                <SignalRow key={sig.id} sig={sig} group={g} result={results[sig.id] || { status: "na", value: "—" }}
                  open={open === sig.id} onToggle={() => setOpen(o => (o === sig.id ? null : sig.id))}
                  onSetManual={onSetManual} pasted={pasted} setPasted={setPasted} fs={fs} now={now} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
