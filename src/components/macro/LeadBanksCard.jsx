import { useState, useEffect } from "react";
import Tip from "./Tip.jsx";
import { InfoTip } from "./SeriesTable.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, TIER_COLOR } from "./macroStyles.js";
import { LEAD_BANKS, LEAD_OUTLETS } from "../../data/macroLeadBanks.js";
import { TRUSTED_OUTLETS } from "../../data/macroSpeakers.js";
import { leadStats, leadFlags, fmtD, sgnBp } from "../../macroLeadBanks.js";
import { parseRss } from "../../macroSpeech.js";
import { fmtStamp } from "../../macroFormat.js";

// Lead central banks: the early movers, one row each — policy rate and its
// last move (BIS), moves in the past year, what futures price (Central Bank
// Watch, where it publishes a table), and the currency's month against USD.
// A row opens to why the bank leads and its latest headlines (local language
// where its own press is). Secondary to the Fed/ECB/BoJ cards above.

const has = v => v !== null && v !== undefined && Number.isFinite(v);
const COLS = "84px 54px 100px 40px minmax(112px,1fr) 46px 46px 12px";
const NEWS_TTL = 30 * 60 * 1000;
const newsCache = new Map(); // bank id → { at, items, error }

const trusted = o => !!o && [...TRUSTED_OUTLETS, ...LEAD_OUTLETS].some(t => o.toLowerCase().includes(t.toLowerCase()));

async function loadNews(bank, force = false) {
  const hit = newsCache.get(bank.id);
  if (!force && hit && Date.now() - hit.at < NEWS_TTL) return hit;
  const res = await Promise.allSettled(bank.news.map(async url => {
    const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parseRss(await r.text());
  }));
  const seen = new Set();
  const items = res.filter(r => r.status === "fulfilled").flatMap(r => r.value)
    .filter(it => !bank.match || bank.match.test(`${it.title} ${it.description}`))
    .sort((a, b) => b.ts - a.ts)
    .filter(it => { const k = it.title.toLowerCase().slice(0, 70); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 6);
  const failed = res.filter(r => r.status === "rejected").length;
  const out = { at: Date.now(), items, error: failed === res.length ? "news feed did not answer" : null };
  newsCache.set(bank.id, out);
  return out;
}

const STATS_TIP = {
  t: "Lead central banks",
  d: "Banks that have moved before the Fed and ECB in past cycles, or that read a channel the big three don't (commodities, the Asian trade cycle, gilts). Policy rates from the BIS (PRIMARY, daily series, updated weekly — a decision can take a few days to appear); market pricing from Central Bank Watch (SECONDARY-unverified) for the BoE, RBA, RBNZ and SNB only; currencies from Yahoo with ECB-fix fallbacks.",
  w: "When several early movers turn the same way, the Fed and ECB have tended to follow within months (hikes in 2021–22; cuts in 2023–24). A lead-bank turn is a reason to re-check the yield-peak signals, not a trade on its own.",
  r: "LAST MOVE amber = within 45 days. 12M = hikes ↑ and cuts ↓ in the past year. PRICED = the next meeting Central Bank Watch prices, its step and odds; TOTAL = bp priced over its horizon. FX 1M = currency vs USD, + = stronger. Click a row for why the bank leads and its latest headlines.",
};

function Flags({ f, fs }) {
  const chips = [];
  f.turns.forEach(x => chips.push({ k: `t${x.bank.id}`, strong: true, text: `TURN · ${x.bank.name} ${x.last.bp > 0 ? "hiked" : "cut"} ${fmtD(x.last.date)} after ${x.prev.bp > 0 ? "hikes" : "cuts"}`,
    tip: `${x.bank.full}: ${sgnBp(x.last.bp)} to ${x.last.to.toFixed(2)}% on ${fmtD(x.last.date)}; previous move ${sgnBp(x.prev.bp)} on ${fmtD(x.prev.date)}.` }));
  f.resumed.forEach(x => chips.push({ k: `r${x.bank.id}`, strong: true, text: `${x.bank.name} moved after ${Math.round(x.gap / 30)} months on hold`,
    tip: `${sgnBp(x.last.bp)} on ${fmtD(x.last.date)}; previous move ${fmtD(x.prev.date)}.` }));
  if (f.cluster) chips.push({ k: "cl", strong: true, text: `${f.cluster === "hike" ? "HIKING" : "CUTTING"} CLUSTER · ${(f.cluster === "hike" ? f.hikes : f.cuts).map(x => x.bank.name).join(", ")}`,
    tip: "Three or more lead banks moved the same way in the last 90 days, at least twice as many as moved the other way." });
  f.fxStress.forEach(x => chips.push({ k: `fx${x.bank.id}`, text: `${x.bank.ccy} ${x.fx1m >= 0 ? "+" : "−"}${Math.abs(x.fx1m).toFixed(1)}% vs USD in 1m`,
    tip: `${x.bank.full}'s currency moved ${x.fx1m >= 0 ? "+" : "−"}${Math.abs(x.fx1m).toFixed(1)}% against USD in a month (${x.fxS.label} ${x.fxS.last.toFixed(x.fxS.dp)} on ${x.fxS.lastDate}, ${x.fxS.srcUsed}). A move this size feeds ${x.fx1m < 0 ? "imported inflation and can force a hike" : "disinflation and gives room to ease"}; check the bank's next decision.` }));
  if (f.diverge) chips.push({ k: "dv", strong: true, text: `DIVERGES FROM FED PRICING (Fed ${sgnBp(f.fed)})`,
    tip: `Lead banks lean to ${f.diverge === "hike" ? "hikes" : "cuts"} while Central Bank Watch prices the Fed ${sgnBp(f.fed)} over its horizon. In past cycles the early movers were right first; check whether the Fed card's pricing is catching up.` });
  if (!chips.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "4px 0 2px" }}>
      {chips.map(c => (
        <Tip key={c.k} tip={c.tip} underline={false}>
          <span style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: c.strong ? 700 : 600, padding: "1px 6px", borderRadius: 3,
            color: C.amber, background: C.amberBg, border: `1px solid ${C.amber}55` }}>{c.text}</span>
        </Tip>
      ))}
    </div>
  );
}

// Headlines load when the row opens (cached 30 minutes); ⟳ forces a reload.
function News({ bank, fs }) {
  const [reload, setReload] = useState(0);
  const [st, setSt] = useState(null);
  useEffect(() => {
    let live = true;
    loadNews(bank, reload > 0)
      .then(r => { if (live) setSt({ ...r, reload }); },
        e => { if (live) setSt({ at: Date.now(), items: [], error: e.message, reload }); });
    return () => { live = false; };
  }, [bank, reload]);
  const busy = !st || st.reload !== reload;
  if (!st) return <div style={{ ...smallMono(fs), padding: "3px 0" }}>loading headlines…</div>;
  return (
    <div>
      {st.items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline", padding: "2px 0", borderBottom: `1px solid ${C.line2}` }}>
          <span style={{ fontFamily: MONO, fontSize: fs(9), color: C.mute, minWidth: 40, flexShrink: 0 }}>{fmtD(it.date).slice(0, -3)}</span>
          <span style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink, lineHeight: 1.35, minWidth: 0 }}>
            <a href={it.link} target="_blank" rel="noreferrer" style={{ color: C.ink, textDecoration: "none" }}>{it.title}</a>
            {" "}<span style={smallMono(fs, trusted(it.outlet) ? C.blue : C.amber)}>{it.outlet || "unknown outlet"}{trusted(it.outlet) ? "" : " · unverified"}</span>
          </span>
        </div>
      ))}
      {!st.items.length && <div style={{ ...smallMono(fs), padding: "3px 0" }}>{st.error || "No headlines in the window."}</div>}
      <div style={{ ...smallMono(fs), marginTop: 3 }}>
        Google News, {bank.news.length > 1 ? "local language and English" : "English"} · {fmtStamp(st.at)}
        <button onClick={() => setReload(n => n + 1)} disabled={busy} style={{ ...chipBtn(false, C.ink), marginLeft: 6, opacity: busy ? 0.5 : 1 }} aria-label="Reload headlines">⟳</button>
        {" · "}<a href={bank.link} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{bank.full} ↗</a>
      </div>
    </div>
  );
}

function Row({ x, fs, open, onToggle }) {
  const b = x.bank;
  const recent = x.last && x.age <= 45;
  // Without the BIS series, the rate Central Bank Watch's pricing table starts from (BoE, RBA, RBNZ, SNB).
  const cbwRate = b.rate && !has(x.rate) && has(x.priced?.base) ? x.priced.base : null;
  const rateTxt = b.rate ? (has(x.rate) ? `${x.rate.toFixed(2)}%` : has(cbwRate) ? `${cbwRate.toFixed(2)}%` : "—") : "S$NEER";
  const rateTip = b.rate
    ? (has(x.rate) ? `${x.s?.label}: ${x.rate.toFixed(2)}% as of ${x.rateDate} · ${x.srcUsed === "bis" ? "BIS policy rates (PRIMARY)" : `${x.srcUsed}${x.fallback ? " (fallback)" : ""}`}${x.s?.note && x.fallback ? ` · ${x.s.note}` : ""}`
      : has(cbwRate) ? `${b.full}: ${cbwRate.toFixed(2)}% — the rate Central Bank Watch's pricing table starts from (SECONDARY-unverified, data ${x.priced.asOf || "n.d."}). BIS did not answer: ${x.error || "no data"}; no move history this refresh.`
      : `${x.s?.label || b.name}: ${x.error || "no data"}`)
    : "MAS sets the slope, width and centre of a band for the trade-weighted Singapore dollar (S$NEER) — there is no policy rate. The decision is in the Monetary Policy Statement's wording; open the row for the latest headlines.";
  const p = x.priced;
  const fxTxt = has(x.fx1m) ? `${x.fx1m >= 0 ? "+" : "−"}${Math.abs(x.fx1m).toFixed(1)}%` : "—";
  return (
    <>
      <div role="row" tabIndex={0} aria-expanded={open} onClick={onToggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center", padding: "3px 0",
        borderBottom: `1px solid ${C.line2}`, cursor: "pointer", background: open ? C.cream : "transparent" }}>
        <span role="cell" style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <Tip tip={{ t: b.full, d: b.lead, r: b.caveat }}>{b.name}</Tip>
          <span style={{ ...smallMono(fs), marginLeft: 5 }}>{b.ccy}</span>
        </span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(11), fontWeight: 500, textAlign: "right", color: has(x.rate) || has(cbwRate) || !b.rate ? C.ink : C.ghost }}>
          <Tip tip={rateTip} underline={false}>{rateTxt}{x.fallback || has(cbwRate) ? "*" : ""}</Tip>
        </span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), color: recent ? C.amber : C.sub, fontWeight: recent ? 700 : 400, whiteSpace: "nowrap" }}>
          {x.last ? <Tip tip={`${sgnBp(x.last.bp)}: ${x.last.from.toFixed(2)}% → ${x.last.to.toFixed(2)}% on ${x.last.date}${x.prev ? ` · previous move ${sgnBp(x.prev.bp)} on ${x.prev.date}` : ""}`} underline={false}>
            {sgnBp(x.last.bp)} {fmtD(x.last.date)}</Tip> : b.rate ? "—" : ""}
        </span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub, textAlign: "right", whiteSpace: "nowrap" }}>
          {b.rate && x.moves.length ? `${x.up12}↑ ${x.down12}↓` : "—"}
        </span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p ? <Tip underline={false} tip={`Central Bank Watch (SECONDARY-unverified), data ${p.asOf || "date not stated"}: ${p.next.date} ${sgnBp(p.next.stepBp)} expected (${has(p.next.pct) ? `${p.next.pct.toFixed(0)}% odds of a move` : "odds n/a"}); rate path from ${has(p.base) ? `${p.base.toFixed(2)}%` : "n/a"} to ${p.next.level.toFixed(2)}%. ${p.n} meeting${p.n === 1 ? "" : "s"} priced. Meetings the futures can't attribute cleanly are left out, so this is the next PRICED meeting, not necessarily the next decision.`}>
            {fmtD(p.next.date).slice(0, -3)} {sgnBp(p.next.stepBp)}{has(p.next.pct) ? <span style={{ color: C.mute }}> {p.next.pct.toFixed(0)}%</span> : null}
          </Tip> : <span style={{ color: C.ghost }}>—</span>}
        </span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", fontWeight: p && Math.abs(p.totalBp) >= 25 ? 700 : 400,
          color: p && Math.abs(p.totalBp) >= 25 ? C.amber : C.sub }}>{p && has(p.totalBp) ? sgnBp(p.totalBp) : "—"}</span>
        <span role="cell" style={{ fontFamily: MONO, fontSize: fs(10), textAlign: "right", color: C.sub }}>
          <Tip underline={false} tip={x.fxS?.points?.length ? `${b.ccy} vs USD over a month (+ = ${b.ccy} stronger), from ${x.fxS.label} ${x.fxS.last.toFixed(x.fxS.dp)} on ${x.fxS.lastDate}` : "no FX data"}>{fxTxt}</Tip>
        </span>
        <span role="cell" aria-hidden style={{ fontFamily: MONO, fontSize: fs(9), color: C.mute, textAlign: "right" }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div style={{ padding: "5px 6px 7px", background: C.cream, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, lineHeight: 1.45, marginBottom: 4 }}>
            <b style={{ color: C.ink }}>Why it leads: </b>{b.lead}{b.caveat ? <span style={{ color: C.mute }}> Caveat: {b.caveat}</span> : null}
          </div>
          {x.moves.length > 0 && (
            <div style={{ ...smallMono(fs, C.sub), marginBottom: 4 }}>
              MOVES SINCE {fmtD(x.s.points[0][0]).toUpperCase()}: {x.moves.slice(-8).map(m => `${fmtD(m.date)} ${sgnBp(m.bp)}`).join(" · ")}
            </div>
          )}
          <News bank={b} fs={fs} />
        </div>
      )}
    </>
  );
}

export default function LeadBanksCard({ series, paths, today }) {
  const fs = useFs();
  const [open, setOpen] = useState(null);
  const stats = leadStats(series, paths, today);
  const f = leadFlags(stats, paths);
  const main = stats.filter(x => !x.bank.minor), minor = stats.filter(x => x.bank.minor);
  const bisOk = stats.some(x => x.moves.length > 0);
  const toggle = id => setOpen(o => (o === id ? null : id));
  return (
    <div style={{ ...card, padding: "12px 14px", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>LEAD CENTRAL BANKS · the early movers<InfoTip tip={STATS_TIP} /></span>
        <span style={smallMono(fs)}>
          {bisOk ? <>moves in 90 days: <b style={{ color: C.ink }}>{f.hikes.length} hike{f.hikes.length === 1 ? "" : "s"}</b>{f.hikes.length ? ` (${f.hikes.map(x => x.bank.name).join(", ")})` : ""}
            {" · "}<b style={{ color: C.ink }}>{f.cuts.length} cut{f.cuts.length === 1 ? "" : "s"}</b>{f.cuts.length ? ` (${f.cuts.map(x => x.bank.name).join(", ")})` : ""}</>
            : <>moves: n/a (policy-rate history not loaded)</>}
          {f.withPrice.length > 0 && <> · priced: {f.withPrice.map(x => `${x.bank.name} ${sgnBp(x.priced.totalBp)}`).join(", ")}</>}
        </span>
      </div>
      <Flags f={f} fs={fs} />
      {!bisOk && <div style={{ ...smallMono(fs, C.amber), margin: "2px 0" }}>BIS policy rates did not load this refresh: moves and turn flags are off; rates marked * come from Central Bank Watch's pricing tables. See Source health.</div>}
      {/* Two compact tables side by side on a wide screen, stacked on a narrow one. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(560px,100%),1fr))", gap: "4px 18px", alignItems: "start", marginTop: 4 }}>
        {[["Lead central banks", "THE SIX TO WATCH", main], ["Also early movers", "ALSO EARLY MOVERS IN THE LAST CYCLE", minor]].map(([aria, title, list]) => (
          <div key={aria} style={{ overflowX: "auto", minWidth: 0 }}>
            <div style={{ ...smallMono(fs, C.sub), fontWeight: 600, letterSpacing: "0.08em", margin: "2px 0 2px" }}>{title}</div>
            <div role="table" aria-label={aria} style={{ minWidth: 560 }}>
              <div role="row" style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, ...smallMono(fs, C.faint), fontSize: fs(8), letterSpacing: "0.06em",
                padding: "0 0 3px", borderBottom: `1px solid ${C.line2}` }}>
                <span role="columnheader">hover a bank</span>
                <span role="columnheader" style={{ textAlign: "right" }}>RATE</span>
                <span role="columnheader">LAST MOVE</span>
                <span role="columnheader" style={{ textAlign: "right" }}>12M</span>
                <span role="columnheader">PRICED NEXT</span>
                <span role="columnheader" style={{ textAlign: "right" }}>TOTAL</span>
                <span role="columnheader" style={{ textAlign: "right" }}>FX 1M</span>
                <span role="columnheader" />
              </div>
              {list.map(x => <Row key={x.bank.id} x={x} fs={fs} open={open === x.bank.id} onToggle={() => toggle(x.bank.id)} />)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...smallMono(fs), marginTop: 5 }}>
        Rates: <span style={{ color: TIER_COLOR.PRIMARY }}>BIS</span> · pricing: <span style={{ color: TIER_COLOR["SECONDARY-unverified"] }}>Central Bank Watch</span> (BoE, RBA, RBNZ, SNB) · * = fallback source · click a row for why it leads and its headlines
      </div>
    </div>
  );
}
