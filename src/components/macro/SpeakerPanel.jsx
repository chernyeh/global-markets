import { useState } from "react";
import { withShifts, hawkDove, rosterFor, itemWeight } from "../../macroSpeech.js";
import { STANCE, BANK_NAME } from "../../data/macroSpeakers.js";
import Spark from "./Spark.jsx";
import { C, MONO, SERIF, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtDate, fmtStamp } from "../../macroFormat.js";

const sgn = v => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(v % 1 ? 1 : 0)}`;
const indexWord = v => (v === null ? "no statements" : v >= 1 ? "hawkish" : v >= 0.3 ? "leans hawkish" : v > -0.3 ? "balanced" : v > -1 ? "leans dovish" : "dovish");

function Statement({ it, fs }) {
  const [open, setOpen] = useState(false);
  const st = STANCE[it.stance] || STANCE[0];
  const r = rosterFor(it.speaker, it.bank);
  const counted = itemWeight(it) > 0;
  return (
    <div style={{ borderBottom: `1px solid ${C.line2}`, padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.mute, minWidth: 40 }}>{fmtDate(it.date)}</span>
        <span title={`stance ${sgn(it.stance)}: ${st.label}`} style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 700, color: st.color, minWidth: 18 }}>{st.short}</span>
        <span style={{ fontFamily: SERIF, fontSize: fs(12.5), fontWeight: 600, color: C.ink }}>{r?.full || it.speaker}</span>
        <span style={smallMono(fs)}>{r?.role || it.role || ""}</span>
        {r?.v26 && <span title="FOMC voter in 2026" style={{ fontFamily: MONO, fontSize: fs(8), color: C.ink, border: `1px solid ${C.line}`, borderRadius: 3, padding: "0 3px" }}>V26</span>}
        {r?.v27 && <span title="FOMC voter in 2027" style={{ fontFamily: MONO, fontSize: fs(8), color: C.blue, border: `1px solid ${C.line}`, borderRadius: 3, padding: "0 3px" }}>V27</span>}
        <span style={smallMono(fs)}>· {it.venue}</span>
        {it.shift ? <span title={`previous stance ${sgn(it.prev.stance)} on ${it.prev.date}`} style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: 700, color: it.shift > 0 ? C.red : C.blue }}>
          {it.shift > 0 ? "↗ more hawkish" : "↘ more dovish"} than {fmtDate(it.prev.date)}</span> : null}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, margin: "1px 0 0 64px", lineHeight: 1.4 }}>
        {it.quote ? <i>“{it.quote}”</i> : it.title}
        {" "}<a href={it.link} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: fs(9), color: C.blue }}>{it.outlet}</a>
        {it.reports > 1 && <span title={`Also reported by: ${it.outlets.filter(o => o !== it.outlet).join(", ")}`} style={smallMono(fs)}> +{it.reports - 1} report{it.reports > 2 ? "s" : ""}</span>}
        {!counted && <span style={smallMono(fs, C.amber)}> · not counted in the index</span>}
        {it.quoteDropped && <span title="The classifier's quote was not found verbatim in the source, so it was dropped" style={smallMono(fs, C.amber)}> · quote not verifiable</span>}
        {it.nonAnswers?.length > 0 && <button onClick={() => setOpen(o => !o)} style={{ ...chipBtn(open, C.goldDark), marginLeft: 6 }}>{open ? "hide" : `${it.nonAnswers.length} not answered`}</button>}
      </div>
      {open && (
        <div style={{ margin: "3px 0 2px 64px", fontFamily: SERIF, fontSize: fs(11.5), color: C.sub, lineHeight: 1.45 }}>
          <div style={smallMono(fs, C.goldDark)}>QUESTIONS NOT ANSWERED DIRECTLY — not a red flag in itself</div>
          {it.nonAnswers.map((n, i) => <div key={i}>• {n.q} <span style={{ color: C.mute }}>— possible reason: {n.reason}</span></div>)}
        </div>
      )}
    </div>
  );
}

export default function SpeakerPanel({ bank, speech, busy, onRefresh, blackout }) {
  const fs = useFs();
  const [more, setMore] = useState(false);
  const items = withShifts(Object.values(speech?.items || {})).filter(it => it.bank === bank && it.relevant).sort((a, b) => b.ts - a.ts);
  const h = hawkDove(items, bank);
  const list = items.slice(0, more ? 15 : 5);
  const col = h.value === null ? C.mute : h.value >= 0.3 ? C.red : h.value <= -0.3 ? C.blue : C.sub;
  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${C.line2}`, paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={smallMono(fs, C.sub)}>WHAT OFFICIALS ARE SAYING</span>
        <span title="Weighted average stance over the last 21 days (−2 dovish … +2 hawkish). Chair/President ×3, vice chairs, NY Fed and chief economist ×2, voters ×1.5; untrusted outlets not counted."
          style={{ fontFamily: MONO, fontSize: fs(10.5), fontWeight: 700, color: col }}>
          {h.value === null ? "—" : sgn(Math.round(h.value * 10) / 10)} {indexWord(h.value)}
        </span>
        <span style={smallMono(fs)}>{h.n} statement{h.n === 1 ? "" : "s"} · 21 days</span>
        {h.series.length > 1 && <Spark points={h.series} fmt={v => sgn(Math.round(v * 10) / 10)} width={70} height={16} thr={[{ v: 0, label: "balanced" }]} days={61} />}
        <span style={{ ...smallMono(fs), marginLeft: "auto" }}>
          {busy ? "reading feeds…" : `checked ${fmtStamp(speech?.lastRun)}`}
          <button onClick={onRefresh} disabled={busy} style={{ ...chipBtn(false, C.ink), marginLeft: 4, opacity: busy ? 0.5 : 1 }} title="Re-read the feeds now">⟳</button>
        </span>
      </div>
      {blackout && <div style={{ ...smallMono(fs, C.red), marginTop: 2 }}>{blackout}</div>}
      {speech?.error && <div title={speech.error} style={{ ...smallMono(fs, C.amber), marginTop: 2 }}>⚠ {speech.error.slice(0, 120)}</div>}
      {list.length === 0
        ? <div style={{ ...smallMono(fs), padding: "6px 0" }}>{speech?.lastRun ? "No policy statements classified in the last 10 days." : "First read of the feeds runs a few seconds after the page loads."}</div>
        : list.map(it => <Statement key={it.id} it={it} fs={fs} />)}
      {items.length > 5 && <button onClick={() => setMore(m => !m)} style={{ ...chipBtn(more, C.ink), marginTop: 4 }}>{more ? "fewer" : `more (${Math.min(items.length, 15) - 5})`}</button>}
      <div style={{ ...smallMono(fs), marginTop: 4, lineHeight: 1.5 }}>
        {bank === "boj" ? "BoJ speech and statement titles from the bank's own feed (full texts are PDFs, not read); substance from trusted outlets incl. Japanese press (Nikkei, Jiji, Kyodo, NHK)."
          : `Official ${BANK_NAME[bank]} texts read in full; reports from trusted outlets${bank === "ecb" ? " incl. German, French, Italian and Spanish press" : ""}.`} Stance and quote by Haiku; quotes checked verbatim against the source.
      </div>
    </div>
  );
}
