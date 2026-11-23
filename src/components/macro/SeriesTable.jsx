import { useState } from "react";
import Spark from "./Spark.jsx";
import Tip from "./Tip.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, TIER_COLOR, chipBtn } from "./macroStyles.js";
import { SOURCE_META } from "../../data/macroSeries.js";
import { GLOSSARY } from "../../data/macroGlossary.js";
import { fmtLevel, fmtChg, bigMove, asOfLabel, sourceTitle } from "../../macroFormat.js";

export function SourceTag({ s, fs }) {
  if (!s?.points?.length) return null;
  const src = s.srcUsed === "derived" ? null : SOURCE_META[s.srcUsed];
  const tier = src?.tier;
  return (
    <span style={{ ...smallMono(fs, s.stale ? C.amber : tier ? TIER_COLOR[tier] : C.faint), fontSize: fs(8), whiteSpace: "nowrap", fontWeight: s.stale ? 700 : 400 }}>
      {src ? src.tag || src.short : "calc"}{s.fallback ? "*" : ""} {asOfLabel(s)}{s.stale ? " · stale" : ""}
    </span>
  );
}

// A small "i" that opens an explanation — for notes that used to sit as text under a card.
export function InfoTip({ tip }) {
  const fs = useFs();
  return <Tip tip={tip} underline={false}><span aria-label="About this" style={{ fontFamily: MONO, fontSize: fs(9), color: C.mute, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 5px", marginLeft: 4 }}>i</span></Tip>;
}

const COLS = "minmax(0,1fr) 64px 44px 48px 64px 46px";

function Row({ s, fs }) {
  const has = s.points?.length > 0;
  const big = bigMove(s);
  const tip = { ...(GLOSSARY[s.id] || { t: s.label }), src: sourceTitle(s) };
  return (
    <div role="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center", padding: "3px 0", borderBottom: `1px solid ${C.line2}` }}>
      <span role="cell" style={{ fontFamily: SERIF, fontSize: fs(12), color: has ? C.ink : C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <Tip tip={tip}>{s.label}</Tip>
      </span>
      <span role="cell" style={{ fontFamily: MONO, fontSize: fs(11), color: has ? C.ink : C.ghost, textAlign: "right", fontWeight: 500 }}>
        {has ? fmtLevel(s) : (s.error || "").includes("FRED_API_KEY") ? "key" : "—"}
      </span>
      <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", color: big ? C.amber : C.sub, fontWeight: big ? 700 : 400 }}>
        {s.freq === "M" ? "" : fmtChg(s, s.chg1d)}
      </span>
      <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", color: C.sub }}>{fmtChg(s, s.chg1m)}</span>
      <span role="cell" style={{ textAlign: "center" }}>
        <Spark points={s.points} thr={s.thr} fmt={v => fmtLevel(s, v)} width={64} height={18} monthly={s.freq === "M"} />
      </span>
      <span role="cell" style={{ textAlign: "right" }}><SourceTag s={s} fs={fs} /></span>
    </div>
  );
}

// `more` = groups of rows behind their own toggle (e.g. Asia oil importers, SGD
// crosses): { id, label, ids, tip } or a list of them. `note` = the card's
// footnote, behind the "i" next to the title.
export default function SeriesTable({ label, ids, series, note, more }) {
  const fs = useFs();
  const [open, setOpen] = useState({});
  const rows = ids.map(id => series[id]).filter(Boolean);
  const groups = (Array.isArray(more) ? more : more ? [more] : [])
    .map((g, i) => ({ ...g, key: g.id || String(i), rows: (g.ids || []).map(id => series[id]).filter(Boolean) }))
    .filter(g => g.rows.length);
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div style={{ ...kickerStyle(fs), marginBottom: 6 }}>{label}{note && <InfoTip tip={note} />}</div>
      <div role="table" aria-label={label}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6,
          ...smallMono(fs, C.faint), fontSize: fs(8), letterSpacing: "0.06em", padding: "0 0 3px", borderBottom: `1px solid ${C.line2}` }}>
          <span role="columnheader" style={{ whiteSpace: "nowrap", overflow: "hidden" }}>hover a name</span>
          <span role="columnheader" style={{ textAlign: "right" }}>LAST</span>
          <span role="columnheader" style={{ textAlign: "right" }}>1D</span>
          <span role="columnheader" style={{ textAlign: "right" }}>1M</span>
          <span role="columnheader" style={{ textAlign: "center" }}>6M</span>
          <span role="columnheader" style={{ textAlign: "right" }}>SRC</span>
        </div>
        {rows.map(s => <Row key={s.id} s={s} fs={fs} />)}
        {groups.filter(g => open[g.key]).map(g => (
          <div key={g.key} role="rowgroup" aria-label={g.label}>
            <div role="row" style={{ ...smallMono(fs, C.sub), fontSize: fs(8), letterSpacing: "0.06em", padding: "5px 0 1px", borderBottom: `1px solid ${C.line2}` }}>
              <span role="cell">{g.label.toUpperCase()}</span>
            </div>
            {g.rows.map(s => <Row key={s.id} s={s} fs={fs} />)}
          </div>
        ))}
      </div>
      {groups.length > 0 && (
        <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {groups.map(g => (
            <span key={g.key} style={{ whiteSpace: "nowrap" }}>
              <button onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))} aria-expanded={!!open[g.key]} style={chipBtn(!!open[g.key], C.ink)}>
                {open[g.key] ? `hide ${g.label}` : `+ ${g.label} (${g.rows.length})`}
              </button>
              {g.tip && GLOSSARY[g.tip] && <InfoTip tip={GLOSSARY[g.tip]} />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
