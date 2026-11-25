import { useState, useEffect, useRef, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { breadth } from "../../macroInflation.js";
import { QUALITY_TAGS } from "../../data/macroInflation.js";
import { SOURCE_META } from "../../data/macroSeries.js";
import Spark from "./Spark.jsx";
import Tip from "./Tip.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, heat, chipBtn } from "./macroStyles.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = ym => MON[Number(ym.slice(5, 7)) - 1];
const SIGNAL_LINE = 50; // signal 4's illustrative threshold, % by weight
const DOTTED = { textDecoration: "underline dotted", textDecorationColor: C.ghost, textUnderlineOffset: 3 };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// The note's read in words. The note text often restates the tag ("Below 3%"),
// so the tag is only prefixed when it adds something.
function readOf(it, tag) {
  if (!tag) return it.note || "";
  if (!it.note) return cap(tag.label);
  return it.note.toLowerCase().includes(tag.label.toLowerCase()) ? it.note : `${cap(tag.label)} — ${it.note}`;
}
const viaOf = it => (it.srcUsed && it.srcUsed !== "bls" ? SOURCE_META[it.srcUsed]?.label || it.srcUsed : null);
const sourceLine = it => {
  const via = viaOf(it);
  return `BLS CPI item ${it.code}${via ? ` · via ${via}` : ""}${it.yoy ? ` · y/y as of ${mon(it.yoy.month)} ${it.yoy.month.slice(0, 4)}` : ""}`;
};
// Short form for the pop-out, where the footnote already says BLS CPI items.
const sourceShort = it => {
  const via = viaOf(it);
  return `${it.code}${via ? ` via ${via}` : ""}${it.yoy ? ` · y/y ${mon(it.yoy.month)}` : ""}`;
};

// True below `px` wide (the pop-out stacks each item on a phone).
function useNarrow(px) {
  const q = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setNarrow(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return narrow;
}

// The note's read as a coloured chip (same colour as the table's tag).
function TagChip({ tag, fs, size = 8.5 }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: fs(size), fontWeight: 600, color: tag.color, background: `${tag.color}12`, border: `1px solid ${tag.color}55`,
      borderRadius: 3, padding: "0 5px", marginLeft: 6, letterSpacing: "0.04em", whiteSpace: "nowrap", verticalAlign: "1px" }}>{tag.label.toUpperCase()}</span>
  );
}

// Hover/tap card for an item row: full name with the note's read as a chip
// beside it (the table can only fit part of either on a narrow card), the read
// in words, weight and source.
function itemTip(it, tag, fs) {
  const read = readOf(it, tag);
  return {
    t: <>{it.label}{tag && <TagChip tag={tag} fs={fs} size={9} />}</>,
    d: `${read ? `Note's read: ${read}. ` : ""}Weight ${it.weight.toFixed(1)}pp of CPI.`,
    r: it.nsaFallback ? "m/m cells use the unadjusted index: no seasonally adjusted series was returned (marked nsa)." : undefined,
    src: sourceLine(it),
  };
}

// Meter list: one row per measure — name, bar against 100%, figure, 6-month trend.
// Fill carries severity (broad = sticky): ≥70% red, 50–70% amber, <50% green;
// the dashed tick is signal 4's 50%* line.
function Meter({ label, v, trend, yoy, fs }) {
  const col = v >= 70 ? C.red : v >= 50 ? C.amber : C.green;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "74px minmax(60px,1fr) 38px 60px 70px", gap: 8, alignItems: "center", padding: "2px 0" }}>
      <span style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink }}>{label}</span>
      <span style={{ position: "relative", height: 8, borderRadius: 4, background: C.line2 }} role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} ${Math.round(v)}%`}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, v)}%`, background: col, borderRadius: 4 }} />
        <span style={{ position: "absolute", left: `${SIGNAL_LINE}%`, top: -2, bottom: -2, borderLeft: `1px dashed ${C.ink}`, opacity: 0.5 }} />
      </span>
      <span style={{ fontFamily: MONO, fontSize: fs(12), fontWeight: 600, color: C.ink, textAlign: "right" }}>{Math.round(v)}%</span>
      <Spark points={trend} fmt={x => `${Math.round(x)}%`} width={60} height={16} monthly />
      <span style={smallMono(fs)}>{yoy !== null && yoy !== undefined ? `y/y ${Math.round(yoy)}%` : ""}</span>
    </div>
  );
}

// The item table. layout:
//   "compact" (the card) — one line per item; the name truncates but the
//     note's read stays whole, and hovering or tapping the name shows both.
//   "wide" (pop-out, tablet/desktop) — name and read on line 1, the note and
//     source on line 2, figures alongside.
//   "stacked" (pop-out, phone) — name, read and note across the full width,
//     figures on the line below, so nothing is squeezed into a narrow column.
function ItemTable({ items, momMonths, fs, layout = "compact" }) {
  const cols = `minmax(0,1fr) 30px ${momMonths.map(() => "36px").join(" ")} 42px 42px`;
  const expanded = layout !== "compact";
  const cell = (v, pivot, step, dp = 1) => (
    <span style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", padding: "1px 3px", borderRadius: 3,
      background: v === null || v === undefined ? "transparent" : heat(v, pivot, step), color: v === null || v === undefined ? C.ghost : C.ink }}>
      {v === null || v === undefined ? "n/a" : v.toFixed(dp)}
    </span>
  );
  return (
    <div role="table" aria-label="Core services items">
      <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: expanded ? 4 : 3, ...smallMono(fs, C.faint), fontSize: fs(8), borderBottom: `1px solid ${C.line2}`, paddingBottom: 2 }}>
        <span role="columnheader">{layout === "stacked" ? "BLS ITEM" : expanded ? "ITEM · NOTE'S READ · NOTE" : "ITEM · NOTE'S READ"}</span>
        <span role="columnheader" style={{ textAlign: "right" }}>WT</span>
        {momMonths.map(m => <span role="columnheader" key={m} style={{ textAlign: "right" }}>{mon(m).toUpperCase()}</span>)}
        <span role="columnheader" style={{ textAlign: "right" }}>3M</span>
        <span role="columnheader" style={{ textAlign: "right" }}>Y/Y</span>
      </div>
      {items.map(it => {
        const tag = QUALITY_TAGS[it.tag];
        const nsa = it.nsaFallback && <span style={{ fontFamily: MONO, fontSize: fs(8), color: C.amber, marginLeft: 4, flexShrink: 0 }}>nsa</span>;
        const figures = <>
          <span role="cell" style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, textAlign: "right" }}>{it.weight.toFixed(1)}</span>
          {it.mom.map(m => <span role="cell" key={m.month} style={{ display: "flex", justifyContent: "flex-end" }}>{cell(m.v, 0.25, 0.1)}</span>)}
          <span role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{cell(it.ann3m, 3, 1)}</span>
          <span role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{cell(it.yoy?.v ?? null, 3, 1)}</span>
        </>;
        if (layout === "stacked") return (
          <div role="row" key={it.code} style={{ padding: "5px 0 3px", borderBottom: `1px solid ${C.line2}` }}>
            <div role="rowheader" style={{ lineHeight: 1.35 }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink }}>{it.label}</span>
              {tag && <TagChip tag={tag} fs={fs} />}
              {nsa}
              {it.note && <span style={{ fontFamily: SERIF, fontSize: fs(11), color: C.sub }}> — {it.note}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, alignItems: "center", marginTop: 1 }}>
              <span role="cell" style={{ fontFamily: MONO, fontSize: fs(8.5), color: C.mute, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sourceShort(it)}</span>
              {figures}
            </div>
          </div>
        );
        return (
          <div role="row" key={it.code}
            style={{ display: "grid", gridTemplateColumns: cols, gap: expanded ? 4 : 3, alignItems: "center", padding: expanded ? "4px 0" : "1px 0", borderBottom: `1px solid ${C.line2}` }}>
            {expanded ? (
              <span role="cell" style={{ minWidth: 0, lineHeight: 1.35 }}>
                <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink }}>{it.label}</span>
                {tag && <TagChip tag={tag} fs={fs} />}
                {nsa}
                <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(11), color: C.sub }}>
                  {it.note ? `${it.note} · ` : ""}<span style={{ fontFamily: MONO, fontSize: fs(8.5), color: C.mute }}>{sourceShort(it)}</span>
                </span>
              </span>
            ) : (
              <span role="cell" style={{ minWidth: 0 }}>
                <Tip tip={itemTip(it, tag, fs)} underline={false} style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
                  <span style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...DOTTED }}>{it.label}</span>
                  {tag && <span style={{ fontFamily: MONO, fontSize: fs(8), color: tag.color, marginLeft: 4, flexShrink: 0, whiteSpace: "nowrap" }}>{tag.label}</span>}
                  {nsa}
                </Tip>
              </span>
            )}
            {figures}
          </div>
        );
      })}
    </div>
  );
}

const FOOTNOTE = "BLS CPI item indices (PRIMARY); weights and quality reads from your 19 Nov note. Non-overlapping set — transportation services shown as its three children; this is the monitor's reconstruction, not Waller's method. Tint: warm above 3% (0.25% m/m), cool below.";

// Pop-out over the page with every name and note written out. Closes on ✕,
// Escape or a click outside; focus moves to ✕ on open and back to the
// expand button on close; the page behind does not scroll while it is open.
function Expanded({ items, momMonths, L, onClose }) {
  const fs = useFs();
  const closeRef = useRef(null);
  const titleId = useId();
  const narrow = useNarrow(640);
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const key = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; opener?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(26,26,26,0.28)", overflowY: "auto",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "max(16px, 6vh) 16px 16px" }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ ...card, width: "100%", maxWidth: 760, padding: "12px 16px", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span id={titleId} style={kickerStyle(fs)}>CORE-SERVICES BREADTH · ALL ITEMS</span>
          <button ref={closeRef} onClick={onClose} aria-label="Close" style={{ ...chipBtn(false, C.ink), marginLeft: "auto" }}>✕ close</button>
          <span style={{ ...smallMono(fs), flexBasis: "100%" }}>{mon(L.month)} {L.month.slice(2, 4)}, 3m annualised SA · {Math.round(L.w)}% by weight · {Math.round(L.n)}% by count · {L.exOer === null ? "n/a" : `${Math.round(L.exOer)}%`} ex-OER above 3%</span>
        </div>
        <ItemTable items={items} momMonths={momMonths} fs={fs} layout={narrow ? "stacked" : "wide"} />
        <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>{FOOTNOTE}</div>
      </div>
    </div>, document.body);
}

export default function BreadthCard({ series: S }) {
  const fs = useFs();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []); // stable, so the pop-out's focus/scroll setup runs once
  const b = breadth(S);
  const L = b.latest, Y = b.latestYoy;
  const trend = key => b.ann.map(x => [`${x.month}-01`, x[key]]);
  const items = [...b.items].sort((a, z) => z.weight - a.weight);
  const momMonths = items.find(it => it.mom?.length)?.mom.map(m => m.month) || [];
  const needsKey = !L && /BLS|quota|FRED_API_KEY/.test(S.sa_SEHC?.error || "");
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={kickerStyle(fs)}>CORE-SERVICES BREADTH · SIGNAL 4</span>
        {/* On the title line, so the header stays two lines on a ~400px card */}
        {L && <button onClick={() => setOpen(true)} aria-haspopup="dialog" title="Open the table with every name and note in full"
          style={{ ...chipBtn(false, C.ink), marginLeft: "auto" }}>⤢ expand</button>}
        <span style={{ ...smallMono(fs), flexBasis: "100%" }}>share of items running above 3% · {L ? `${mon(L.month)} ${L.month.slice(2, 4)}, 3m annualised SA` : "—"}</span>
      </div>
      {!L ? (
        <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.5 }}>
          {needsKey ? <>Needs <b>BLS_API_KEY</b> (or <b>FRED_API_KEY</b>) in Vercel. </> : "No data yet. "}
          Your 19 Nov note's reading (Aug–Oct): ≈70% by weight · ≈50% by count · ≈45% ex-OER above 3%.
        </div>
      ) : <>
        <Meter label="By weight" v={L.w} trend={trend("w")} yoy={Y?.w} fs={fs} />
        <Meter label="By count" v={L.n} trend={trend("n")} yoy={Y?.n} fs={fs} />
        <Meter label="Ex-OER" v={L.exOer} trend={trend("exOer")} yoy={Y?.exOer} fs={fs} />
        <div style={{ ...smallMono(fs), margin: "3px 0 8px", lineHeight: 1.5 }}>
          {L.covN} items, {L.covW.toFixed(1)}pp of CPI · dashed tick = signal 4's 50%* line · y/y basis {Y ? `(${mon(Y.month)})` : ""} · note's reading (Aug–Oct): ≈70 / ≈50 / ≈45%
        </div>
        <ItemTable items={items} momMonths={momMonths} fs={fs} />
        {open && <Expanded items={items} momMonths={momMonths} L={L} onClose={close} />}
      </>}
      <div style={{ ...smallMono(fs), marginTop: 6, lineHeight: 1.5 }}>{FOOTNOTE}</div>
    </div>
  );
}
