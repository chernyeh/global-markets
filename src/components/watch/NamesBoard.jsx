import { useState, useMemo, Fragment } from "react";
import Spark from "../macro/Spark.jsx";
import Tip from "../macro/Tip.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, chipBtn, inputStyle, useFs } from "../macro/macroStyles.js";
import { PURPOSES } from "../../data/watchMarkets.js";
import { basket } from "../../watchCalc.js";
import { fmtPx, fmtPct, fmtX, fmtBig, fmtDay } from "./watchFormat.js";
import { Chg, RangeBar } from "./watchUi.jsx";
import NameDetail from "./NameDetail.jsx";
import { timeAgo } from "../helpers.jsx";

// Columns: name · last · 1D · 1W · 1M · YTD · vs index 1M · 1Y line · 52-week position · forward P/E · nearest level · news
// … plus a last narrow column for the remove ×.
const COLS = "minmax(180px,1.7fr) 70px 54px 54px 54px 56px 58px 66px 54px 46px 104px 46px 20px";
const MIN_W = 986;

const HEAD = [
  { k: "name", label: "NAME", tip: { t: "Name", d: "● held in Gloomberg · ◆ has a thesis (number = conviction) · 🔕 alerts muted.", r: "Click a row for detail, news and editing." } },
  { k: "last", label: "LAST", right: true, tip: { t: "Last price", d: "Latest Yahoo price in the listing's currency (London quotes converted from pence to pounds).", src: "Yahoo Finance · SECONDARY-reliable" } },
  { k: "chg1d", label: "1D", right: true, tip: { t: "1-day change", d: "Latest session against the previous close.", r: "Tinted when the move is 2.5σ or more against the name's previous 60 daily moves." } },
  { k: "chg1w", label: "1W", right: true, tip: "Change over 5 sessions." },
  { k: "chg1m", label: "1M", right: true, tip: "Change over 21 sessions." },
  { k: "ytd", label: "YTD", right: true, tip: "Change since the last close of the previous year." },
  { k: "rel1m", label: "vs IDX", right: true, tip: { t: "Against its index, 1 month", d: "The name's 1-month change minus its benchmark's, in percentage points.",
    r: "Benchmark = home-market index (TOPIX via the 1306 ETF, STI, S&P 500…) unless you set another for the name, e.g. ^SOX for a chip gauge." } },
  { k: "spark", label: "1Y", center: true, tip: "Weekly closes over the past year." },
  { k: "pos52", label: "52W", center: true, tip: { t: "52-week range", d: "Where the price sits between the 52-week low (left) and high (right).", r: "Green dot = at a 52-week high, red = at a low." } },
  { k: "fpe", label: "P/E", right: true, tip: { t: "Forward P/E", d: "Price over the next-12-month consensus EPS Yahoo carries; hover the figure for trailing P/E, P/B, yield, market cap and the next earnings date.",
    src: "Yahoo Finance v7 quote via Gloomberg's proxy · SECONDARY-reliable" } },
  { k: "level", label: "NEAREST LEVEL", tip: { t: "Nearest of your levels", d: "Gloomberg watchlist alert price; thesis entry, Munger, exit and invalidation prices; holding target and stop.",
    r: "Shown: a level the price is through (green buy · amber sell · red risk), else the closest one and the distance to it." } },
  { k: "news", label: "NEWS", right: true, tip: { t: "News, 24 hours · 7 days", d: "Google News in English and the home-market language, plus this app's feeds — only headlines that name the company.",
    r: "Amber = unusual flow (≥3 in 24h and 2.5× the usual daily rate). + = more than Google's 100-story page holds for the week." } },
  { k: "rm", label: "", tip: null },
];

const GROUP_BY = [
  { id: "group", label: "group" }, { id: "purpose", label: "why tracked" }, { id: "country", label: "country" }, { id: "sector", label: "sector" }, { id: "none", label: "none" },
];
const FILTERS = [{ id: "all", label: "all" }, { id: "held", label: "held" }, { id: "thesis", label: "thesis" }, ...PURPOSES.map(p => ({ id: p.id, label: p.label, tip: p.tip }))];

const sortVal = (r, k) => {
  switch (k) {
    case "name": return r.name.toLowerCase();
    case "last": return r.q?.last ?? null;
    case "rel1m": return r.rel1m;
    case "pos52": return r.q?.pos52 ?? null;
    case "fpe": return r.f?.fpe > 0 ? r.f.fpe : null;
    case "level": return r.nearest ? (r.nearest.met ? -1000 + Math.abs(r.nearest.dist) : Math.abs(r.nearest.dist)) : null;
    case "news": return r.news.n24 * 1000 + r.news.n7;
    default: return r.q?.[k] ?? null;
  }
};

const SHORT = { alert: "alert", entry: "entry", munger: "Munger", exit: "exit", inval: "inval.", target: "target", stop: "stop" };

function levelTone(n) {
  if (!n) return C.ghost;
  if (n.met) return n.side === "buy" ? C.green : n.side === "risk" ? C.red : C.amber;
  return Math.abs(n.dist) <= 5 ? C.amber : C.sub;
}

function Row({ r, fs, open, onToggle, onRemove, busy }) {
  const q = r.q, f = r.f, n = r.nearest;
  const unusual = q?.z1d !== null && q?.z1d !== undefined && Math.abs(q.z1d) >= 2.5;
  const valTip = f ? { t: `${r.name} — valuation`, d: [
    `P/E trailing ${fmtX(f.pe)} · forward ${fmtX(f.fpe)} · P/B ${fmtX(f.pb)}`,
    `Dividend yield ${f.dy !== null && f.dy !== undefined ? `${f.dy.toFixed(1)}%` : "—"} · market cap ${f.ccy || ""} ${fmtBig(f.mcap)}`,
    f.earn ? `Next earnings ${fmtDay(f.earn)}${f.earnEst ? " (Yahoo estimate)" : ""}` : null].filter(Boolean).join(". "),
    src: "Yahoo Finance v7 quote via Gloomberg's proxy · SECONDARY-reliable" } : "No valuation data from Yahoo for this ticker.";
  const lvTip = n ? { t: `${n.label}: ${q?.currency || ""} ${fmtPx(n.value)}`, d: `${n.met ? "Price is through this level" : "Distance from the level"}: ${fmtPct(n.dist)}. From ${n.src}.`,
    r: r.levels.length > 1 ? `All levels: ${r.levels.map(l => `${l.label} ${fmtPx(l.value)}${l.unitsOff ? " (check units)" : l.ccyOk ? "" : " (other currency)"}`).join(" · ")}` : null } : null;
  const newsTip = r.newsItems[0] ? { t: "Latest", d: r.newsItems[0].title, src: `${r.newsItems[0].outlet || ""}` } : (r.skipNews ? "News isn't searched for ETFs and funds — set a news query in the row to turn it on." : null);
  const cell = { fontFamily: MONO, fontSize: fs(10.5), textAlign: "right", color: C.ink };
  return (
    <div role="row" className="gm-wrow" onClick={onToggle} aria-expanded={open}
      style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.line2}`, cursor: "pointer",
        background: open ? C.cream : "transparent" }}>
      <span role="cell" style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 5, overflow: "hidden" }}>
        <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={r.name}>{r.name}</span>
        <span style={{ ...smallMono(fs), whiteSpace: "nowrap" }}>{r.ticker}</span>
        {r.hold && <span title="Held in Gloomberg" style={{ color: C.green, fontSize: fs(9) }}>●</span>}
        {r.thesis && <span title={`Thesis ${r.thesis.date_completed || ""}${r.thesis.conviction_score ? ` · conviction ${r.thesis.conviction_score}/10` : ""}`} style={{ ...smallMono(fs, C.blue), whiteSpace: "nowrap" }}>◆{r.thesis.conviction_score || ""}</span>}
        {r.mute && <span title="Alerts muted for this name" style={{ fontSize: fs(9) }}>🔕</span>}
        {r.stale && <span title={`Last price ${q?.lastDate} — Yahoo has not updated this ticker for over 5 days`} style={{ ...smallMono(fs, C.amber), fontWeight: 700 }}>stale</span>}
      </span>
      <span role="cell" style={{ ...cell, fontWeight: 500 }} title={q ? `${q.currency || ""} ${fmtPx(q.last)} · ${q.lastDate}` : "no price"}>{q ? fmtPx(q.last) : "—"}</span>
      <span role="cell" style={{ textAlign: "right" }} title={unusual ? `${Math.abs(q.z1d).toFixed(1)}σ move` : undefined}><Chg v={q?.chg1d} fs={fs} strong={unusual} /></span>
      <span role="cell" style={{ textAlign: "right" }}><Chg v={q?.chg1w} fs={fs} /></span>
      <span role="cell" style={{ textAlign: "right" }}><Chg v={q?.chg1m} fs={fs} /></span>
      <span role="cell" style={{ textAlign: "right" }}><Chg v={q?.ytd} fs={fs} /></span>
      <span role="cell" style={{ textAlign: "right" }} title={r.benchQ ? `${r.benchLabel || r.benchSym} 1M ${fmtPct(r.benchQ.chg1m)}` : "no benchmark"}><Chg v={r.rel1m} fs={fs} pp /></span>
      <span role="cell" style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
        {q?.spark?.length > 2 ? <Spark points={q.spark} width={62} height={18} days={380} fmt={v => fmtPx(v)} /> : null}
      </span>
      <span role="cell" style={{ display: "flex", justifyContent: "center" }} title={q ? `52w ${fmtPx(q.lo52)} – ${fmtPx(q.hi52)} · ${fmtPct(q.offHi)} from high` : undefined}><RangeBar pos={q?.pos52} /></span>
      <span role="cell" style={{ ...cell, color: f?.fpe > 0 ? C.ink : C.ghost }} onClick={e => e.stopPropagation()}><Tip tip={valTip} underline={false}>{fmtX(f?.fpe)}</Tip></span>
      <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), color: levelTone(n), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        ...(n?.met ? { fontWeight: 700 } : {}) }} onClick={e => e.stopPropagation()}>
        {n ? <Tip tip={lvTip} underline={false}>{n.met ? "at " : ""}{SHORT[n.key] || n.key} {fmtPct(n.dist)}</Tip>
          : r.unitsOff ? <span title="A level is more than 20× away from the price — probably pence vs pounds or a split; check it in Gloomberg">units?</span>
          : r.ccyMismatch ? <span title="Levels are in a different currency from the quote">ccy?</span> : "—"}
      </span>
      <span role="cell" style={{ ...cell, fontSize: fs(10), color: r.news.surge ? C.amber : r.news.n24 ? C.ink : C.faint, fontWeight: r.news.surge ? 700 : 400 }} onClick={e => e.stopPropagation()}>
        <Tip tip={newsTip} underline={false}>{r.skipNews ? "·" : `${r.news.n24}·${r.news.n7}${r.news.capped ? "+" : ""}`}</Tip>
      </span>
      <span role="cell" style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
        {r.watch && (
          <button className="gm-wx" onClick={() => onRemove(r)} disabled={busy} aria-label={`Remove ${r.name} from the watchlist`}
            title={`Remove from the watchlist (in Gloomberg too)${r.hold ? " — it stays on the board because you hold it" : ""}. Undo for 15 s.`}
            style={{ border: "none", background: "none", cursor: busy ? "wait" : "pointer", fontSize: fs(14), lineHeight: 1, padding: "0 2px", color: C.faint }}>×</button>
        )}
      </span>
    </div>
  );
}

// Catch-all buckets aren't baskets, so they carry no averages.
const CATCH_ALL = new Set(["Ungrouped", "Untagged", "No sector", "—", "All names"]);

function GroupRow({ label, rows, fs }) {
  const b = CATCH_ALL.has(label) ? { n: rows.length, priced: rows.filter(r => r.q).length } : basket(rows);
  return (
    <div role="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center", padding: "7px 0 3px", borderBottom: `1px solid ${C.line}` }}>
      <span role="cell" style={{ ...kickerStyle(fs), color: C.ink }}>
        <Tip tip={{ t: label, d: `${b.n} name${b.n > 1 ? "s" : ""}; ${b.priced} priced.${CATCH_ALL.has(label) ? "" : " Figures on this line are the equal-weighted average of the members — read the group as a basket."}` }} underline={false}>
          {label.toUpperCase()} <span style={{ color: C.mute, fontWeight: 400 }}>· {b.n}</span>
        </Tip>
      </span>
      <span role="cell" />
      {["chg1d", "chg1w", "chg1m", "ytd"].map(k => <span key={k} role="cell" style={{ textAlign: "right" }}>{CATCH_ALL.has(label) ? null : <Chg v={b[k]} fs={fs} size={10} />}</span>)}
      <span role="cell" style={{ textAlign: "right" }}>{CATCH_ALL.has(label) ? null : <Chg v={b.rel1m} fs={fs} pp size={10} />}</span>
      <span role="cell" /><span role="cell" /><span role="cell" /><span role="cell" /><span role="cell" /><span role="cell" />
    </div>
  );
}

export default function NamesBoard({ w, rows }) {
  const fs = useFs();
  const [groupBy, setGroupBy] = useState("group");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ k: "chg1d", dir: -1 });
  const [open, setOpen] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [rmErr, setRmErr] = useState(null);
  const remove = async r => { setRmErr(null); const res = await w.removeName(r); if (!res.ok) setRmErr(`${r.name}: ${res.error}`); };
  const restore = async e => { setRmErr(null); const res = await w.restoreName(e); if (!res.ok) setRmErr(`${e.label}: ${res.error}`); };

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => (filter === "all" || (filter === "held" ? !!r.hold : filter === "thesis" ? !!r.thesis : r.purposes.includes(filter)))
      && (!s || r.name.toLowerCase().includes(s) || r.ticker.toLowerCase().includes(s) || (r.group || "").toLowerCase().includes(s)));
  }, [rows, filter, search]);

  const groups = useMemo(() => {
    const cmp = (a, b) => {
      const va = sortVal(a, sort.k), vb = sortVal(b, sort.k);
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    };
    const keyOf = r => groupBy === "group" ? r.group || "Ungrouped"
      : groupBy === "purpose" ? (r.purposes.length ? r.purposes.join(" + ") : "Untagged")
      : groupBy === "country" ? r.country || "—" : groupBy === "sector" ? r.sector || "No sector" : "All names";
    const m = new Map();
    for (const r of shown) { const k = keyOf(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    const last = CATCH_ALL;
    return [...m.entries()].map(([k, rs]) => [k, rs.sort(cmp)])
      .sort((a, b) => (last.has(a[0]) - last.has(b[0])) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [shown, groupBy, sort]);

  const headClick = k => { if (k === "spark" || k === "rm") return; setSort(s => (s.k === k ? { k, dir: -s.dir } : { k, dir: k === "name" || k === "level" ? 1 : -1 })); };

  return (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={kickerStyle(fs)}>NAMES · {shown.length}{shown.length !== rows.length ? ` of ${rows.length}` : ""}</span>
        <span style={smallMono(fs)}>group by</span>
        {GROUP_BY.map(g => <button key={g.id} onClick={() => setGroupBy(g.id)} style={chipBtn(groupBy === g.id, C.ink)}>{g.label}</button>)}
        <span style={{ ...smallMono(fs), marginLeft: 6 }}>show</span>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} title={f.tip} style={chipBtn(filter === f.id)}>{f.label}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="find a name…" aria-label="Find a name"
          style={{ ...inputStyle, width: 130, marginLeft: "auto" }} />
        {w.removed.length > 0 && (
          <button onClick={() => setShowRemoved(x => !x)} aria-expanded={showRemoved} style={chipBtn(showRemoved, C.ink)}
            title="Names removed from this browser in the last 30 days — put one back with its notes history">↺ removed ({w.removed.length})</button>
        )}
      </div>
      {/* Remove × shows when the pointer is over a row (always on touch screens). */}
      <style>{`.gm-wrow .gm-wx{opacity:0;transition:opacity .12s}.gm-wrow:hover .gm-wx,.gm-wrow .gm-wx:focus-visible{opacity:1}.gm-wrow .gm-wx:hover{color:${C.red}!important}@media (hover:none){.gm-wrow .gm-wx{opacity:1}}`}</style>
      {rmErr && <div style={{ ...smallMono(fs, C.red), marginBottom: 6 }}>⚠ {rmErr}</div>}
      {showRemoved && w.removed.length > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 8, background: C.cream }}>
          <div style={{ ...kickerStyle(fs), color: C.ink, marginBottom: 2 }}>RECENTLY REMOVED · LAST 30 DAYS</div>
          {w.removed.map(e => (
            <div key={e.key} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", borderTop: `1px solid ${C.line2}` }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink }}>{e.label}</span>
              <span style={smallMono(fs)}>{e.ticker} · removed {timeAgo(e.at)}{e.notes?.length ? ` · ${e.notes.length} note${e.notes.length > 1 ? "s" : ""} kept` : ""}</span>
              <button onClick={() => restore(e)} disabled={w.busy} style={{ ...chipBtn(false, C.ink), marginLeft: "auto" }}>put back</button>
              <button onClick={() => w.forgetRemoved(e.key)} title="Drop from this list (it stays removed)" aria-label={`Forget ${e.label}`}
                style={{ border: "none", background: "none", color: C.faint, cursor: "pointer", fontSize: fs(12) }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div role="table" aria-label="Watchlist names" style={{ minWidth: MIN_W }}>
          <div role="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, padding: "0 0 3px", borderBottom: `1px solid ${C.line2}` }}>
            {HEAD.map(h => (
              <span key={h.k} role="columnheader" aria-sort={sort.k === h.k ? (sort.dir > 0 ? "ascending" : "descending") : undefined}
                onClick={() => headClick(h.k)}
                style={{ ...smallMono(fs, sort.k === h.k ? C.ink : C.faint), fontSize: fs(8), letterSpacing: "0.06em", whiteSpace: "nowrap",
                  textAlign: h.right ? "right" : h.center ? "center" : "left", cursor: h.k === "spark" ? "default" : "pointer", fontWeight: sort.k === h.k ? 700 : 400 }}>
                <Tip tip={h.tip} underline={false}>{h.label}{sort.k === h.k ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</Tip>
              </span>
            ))}
          </div>
          {groups.map(([label, rs]) => (
            <div key={label} role="rowgroup">
              {groupBy !== "none" && <GroupRow label={label} rows={rs} fs={fs} />}
              {rs.map(r => (
                <Fragment key={r.ticker}>
                  <Row r={r} fs={fs} open={open === r.ticker} onToggle={() => setOpen(o => (o === r.ticker ? null : r.ticker))} onRemove={remove} busy={w.busy} />
                  {open === r.ticker && <NameDetail r={r} w={w} onRemove={remove} />}
                </Fragment>
              ))}
            </div>
          ))}
          {!shown.length && <div style={{ ...smallMono(fs), padding: "14px 0", textAlign: "center" }}>{rows.length ? "No names match." : "No names yet — use + add name above, or add them in Gloomberg."}</div>}
        </div>
      </div>
    </div>
  );
}
