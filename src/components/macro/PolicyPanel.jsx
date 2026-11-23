import { useState } from "react";
import { FOMC_MEETINGS, ECB_MEETINGS, BOJ_MEETINGS, nextFomc, nextEcb, nextBoj, fedBlackout, ecbQuiet, bojBlackout, fmtDay, fmtRange, daysUntil } from "../../data/macroCalendar.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle, TIER_COLOR } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";
import { valueAtOrBefore } from "../../macroData.js";
import { GLOSSARY } from "../../data/macroGlossary.js";
import SpeakerPanel from "./SpeakerPanel.jsx";
import LeadBanksCard from "./LeadBanksCard.jsx";
import Tip from "./Tip.jsx";
import { InfoTip } from "./SeriesTable.jsx";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = d => `${MON[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== "2026" ? `-${d.slice(2, 4)}` : ""}`;
const sgnBp = v => { const r = Math.round(v); return r === 0 ? "0bp" : `${r > 0 ? "+" : "−"}${Math.abs(r)}bp`; };
const STALE_PASTE_MS = 3 * 86400000;
const BIG = 10; // bp: changes this large are highlighted
const has = v => v !== null && v !== undefined && Number.isFinite(v);

const CHG_COLS = [["w1", "1W", 7], ["m3", "3M", 91], ["m6", "6M", 182]];
const chgCell = (d, fs) => (
  <span role="cell" style={{ textAlign: "right", fontFamily: MONO, fontSize: fs(10), color: has(d) && Math.abs(d) >= BIG ? C.amber : C.sub, fontWeight: has(d) && Math.abs(d) >= BIG ? 700 : 400 }}>
    {has(d) ? sgnBp(d) : "—"}
  </span>
);

// Atlanta Fed Market Probability Tracker: the SOFR-options distribution of the
// policy rate for each 3-month window — a PRIMARY second read next to Central
// Bank Watch's meeting-by-meeting path. Rates in the file are in basis points.
// Δ columns compare the same window's mean 1 week, 3 and 6 months ago.
function MptTable({ mpt, fs }) {
  if (!mpt?.windows?.length) return null;
  const rows = mpt.windows.slice(0, 5);
  const priors = mpt.priors || { w1: mpt.prior };
  const cols = "44px 48px repeat(3,40px) 40px 36px";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
        <Tip tip={GLOSSARY.sofrOptions}><span style={smallMono(fs, C.sub)}>SOFR OPTIONS · expected Fed rate by quarter</span></Tip>
        <span style={smallMono(fs, TIER_COLOR.PRIMARY)}>Atlanta Fed · {fmtDay(mpt.asOf)}</span>
      </div>
      <div role="table" aria-label="SOFR options implied rates" style={{ marginTop: 2 }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 5, ...smallMono(fs, C.faint), fontSize: fs(8) }}>
          <span role="columnheader">QUARTER</span><span role="columnheader" style={{ textAlign: "right" }}>MEAN</span>
          {CHG_COLS.map(([k, l]) => <span key={k} role="columnheader" style={{ textAlign: "right" }}>Δ{l}</span>)}
          <span role="columnheader" style={{ textAlign: "right" }}>HIKE</span><span role="columnheader" style={{ textAlign: "right" }}>CUT</span>
        </div>
        {rows.map(w => (
          <div role="row" key={w.start} title={`3-month window from ${w.start}: 25th–75th percentile ${(w.p25 / 100).toFixed(2)}–${(w.p75 / 100).toFixed(2)}%, mode ${(w.mode / 100).toFixed(2)}%`}
            style={{ display: "grid", gridTemplateColumns: cols, gap: 5, fontFamily: MONO, fontSize: fs(10), color: C.ink, borderBottom: `1px solid ${C.line2}` }}>
            <span role="cell">{mon(w.start)}</span>
            <span role="cell" style={{ textAlign: "right", fontWeight: 600 }}>{has(w.mean) ? `${(w.mean / 100).toFixed(2)}%` : "n/a"}</span>
            {CHG_COLS.map(([k]) => {
              const p = priors[k]?.windows?.find(x => x.start === w.start);
              return <span key={k} style={{ display: "contents" }}>{chgCell(p && has(w.mean) && has(p.mean) ? w.mean - p.mean : null, fs)}</span>;
            })}
            <span role="cell" style={{ textAlign: "right" }}>{has(w.pHike) ? `${w.pHike.toFixed(0)}%` : "n/a"}</span>
            <span role="cell" style={{ textAlign: "right", color: C.sub }}>{has(w.pCut) ? `${w.pCut.toFixed(0)}%` : "n/a"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Market rates with their 1-week, 3-month and 6-month changes — the ECB and BoJ
// equivalent of the SOFR-options table, from PRIMARY daily series.
function RateChanges({ title, tip, rows, fs }) {
  const live = rows.filter(r => r.s?.points?.length);
  if (!live.length) return null;
  const cols = "minmax(0,1fr) 50px repeat(3,42px)";
  return (
    <div style={{ marginTop: 8 }}>
      <Tip tip={tip}><span style={smallMono(fs, C.sub)}>{title}</span></Tip>
      <div role="table" aria-label={title} style={{ marginTop: 2 }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 5, ...smallMono(fs, C.faint), fontSize: fs(8) }}>
          <span role="columnheader" /><span role="columnheader" style={{ textAlign: "right" }}>LAST</span>
          {CHG_COLS.map(([k, l]) => <span key={k} role="columnheader" style={{ textAlign: "right" }}>Δ{l}</span>)}
        </div>
        {live.map(({ label, s }) => {
          const last = s.points[s.points.length - 1];
          return (
            <div role="row" key={label} title={`${s.label} · as of ${last[0]}`} style={{ display: "grid", gridTemplateColumns: cols, gap: 5, fontFamily: MONO, fontSize: fs(10), color: C.ink, borderBottom: `1px solid ${C.line2}` }}>
              <span role="cell" style={{ fontFamily: SERIF, fontSize: fs(11.5) }}>{label}</span>
              <span role="cell" style={{ textAlign: "right", fontWeight: 600 }}>{last[1].toFixed(s.dp ?? 2)}%</span>
              {CHG_COLS.map(([k, , days]) => {
                const then = valueAtOrBefore(s.points, new Date(Date.parse(`${last[0]}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10));
                return <span key={k} style={{ display: "contents" }}>{chgCell(then ? (last[1] - then[1]) * 100 : null, fs)}</span>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LINKS = {
  fed: [["CME FedWatch", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"], ["Atlanta Fed tracker", "https://www.atlantafed.org/cenfis/market-probability-tracker"],
    ["Central Bank Watch", "https://centralbank.watch/federal-reserve/"]],
  ecb: [["Central Bank Watch", "https://centralbank.watch/european-central-bank/"], ["RateProbability", "https://rateprobability.com/ecb"], ["ECB Watch Tool", "https://ecb-watch.eu/"]],
  boj: [["Central Bank Watch", "https://centralbank.watch/bank-of-japan/"], ["BoJ statements", "https://www.boj.or.jp/en/mopo/mpmdeci/index.htm"], ["MPM schedule", "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm"]],
};

const BANKS = {
  fed: { title: "FED · FOMC", next: nextFomc, day: m => m.end, when: m => fmtRange(m.start, m.end), win: fedBlackout, winWord: "blackout", winTip: GLOSSARY.fedBlackout,
    extra: m => (m.sep ? "with dots (SEP)" : null), official: () => FOMC_MEETINGS.filter(m => !m.noDecision).map(m => m.end), tol: 0, paste: "CME FedWatch" },
  ecb: { title: "ECB · GOVERNING COUNCIL", next: nextEcb, day: m => m.date, when: m => fmtDay(m.date), win: ecbQuiet, winWord: "quiet period", winTip: GLOSSARY.ecbQuiet,
    extra: m => (m.proj ? "with staff projections" : null), official: () => ECB_MEETINGS.map(m => m.date), tol: 0, paste: "€STR OIS" },
  boj: { title: "BANK OF JAPAN · POLICY BOARD", next: nextBoj, day: m => m.end, when: m => fmtRange(m.start, m.end), win: bojBlackout, winWord: "quiet period", winTip: GLOSSARY.bojQuiet,
    extra: m => (m.outlook ? "with Outlook Report (new forecasts)" : null), official: () => BOJ_MEETINGS.map(m => m.end), tol: 7, paste: "TONA OIS" },
};

// Keep rows dated on (or, for the BoJ, within a week of) an official decision
// day and re-date them to it. Central Bank Watch's Fed table still carried the
// pre-12-Nov 2027 schedule, and its BoJ table uses dates that differ from the
// BoJ's published 2027 schedule, so rows are matched rather than trusted.
function officialPath(path, bank) {
  if (!path?.meetings?.length) return null;
  const days = BANKS[bank].official(), tol = BANKS[bank].tol;
  const used = new Set();
  const kept = [];
  for (const m of path.meetings) {
    const d = days.find(x => !used.has(x) && Math.abs(daysUntil(m.date, x)) <= tol);
    if (d) { used.add(d); kept.push({ ...m, date: d, srcDate: m.date }); }
  }
  let cum = 0;
  const rows = kept.map(m => { cum += m.stepBp; return { ...m, cum }; });
  return { ...path, rows, dropped: path.meetings.length - kept.length, remapped: kept.some(m => m.srcDate !== m.date) };
}

// Cumulative bp priced by each meeting: one series, so no legend; the next
// meeting in the accent. Hovering a bar updates the readout line above it.
function PathBars({ rows, fs }) {
  const [hi, setHi] = useState(0);
  if (!rows?.length) return null;
  const vals = rows.map(r => r.cum);
  const pos = Math.max(0, ...vals), neg = Math.max(0, ...vals.map(v => -v));
  const H = 42;
  const span = Math.max(5, pos + neg);
  const base = (pos / span) * H;
  const r = rows[Math.min(hi, rows.length - 1)];
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, minHeight: 14 }}>
        <b style={{ color: C.ink }}>{fmtDay(r.date)}</b>: {sgnBp(r.stepBp)} at this meeting{has(r.pct) ? ` (${r.pct.toFixed(0)}% odds)` : ""}
        {" · "}{sgnBp(r.cum)} in total · rate {r.level.toFixed(2)}%
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 3 }} onMouseLeave={() => setHi(0)}>
        {rows.map((x, i) => {
          const h = Math.max(2, (Math.abs(x.cum) / span) * H);
          const down = x.cum < 0;
          return (
            <div key={x.date} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} tabIndex={0} aria-label={`${fmtDay(x.date)}: ${sgnBp(x.cum)} cumulative`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", outline: "none" }}>
              <div style={{ position: "relative", height: H, width: "100%" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: base, borderTop: `1px solid ${C.line}` }} />
                <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "62%", maxWidth: 22, height: h,
                  top: down ? base : base - h, borderRadius: down ? "0 0 4px 4px" : "4px 4px 0 0", background: i === 0 ? C.red : hi === i ? C.blue : C.slate }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: fs(8), color: hi === i ? C.ink : C.mute, marginTop: 2 }}>{mon(x.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PasteBox({ bank, cbwNext, pasted, setPasted, fs, now }) {
  const p = pasted?.[bank];
  const [pct, setPct] = useState("");
  const [bp, setBp] = useState("");
  const [src, setSrc] = useState(BANKS[bank].paste);
  const [open, setOpen] = useState(false);
  const stale = p && now - p.at > STALE_PASTE_MS;
  const save = () => {
    const a = parseFloat(pct), b = parseFloat(bp);
    if (!Number.isFinite(a) && !Number.isFinite(b)) return;
    setPasted(bank, { pct: Number.isFinite(a) ? a : null, bp: Number.isFinite(b) ? b : null, src: src.trim() || "your source" });
    setPct(""); setBp(""); setOpen(false);
  };
  const gap = has(p?.pct) && has(cbwNext?.pct) ? p.pct - cbwNext.pct : null;
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <Tip tip="Paste the next-meeting odds and total bp priced from your own source (e.g. CME FedWatch, a broker's OIS sheet) to compare with Central Bank Watch. Older than 3 days = shown as stale.">
        <span style={smallMono(fs, C.sub)}>YOUR READ</span></Tip>
      {p ? (
        <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: stale ? C.faint : C.ink }}>
          {p.src}: {has(p.pct) ? `${p.pct}% next meeting` : ""}{has(p.pct) && has(p.bp) ? " · " : ""}{has(p.bp) ? `${sgnBp(p.bp)} priced` : ""}
          {gap !== null && <span style={{ color: Math.abs(gap) >= 5 ? C.amber : C.mute, fontWeight: Math.abs(gap) >= 5 ? 700 : 400 }}> ({gap >= 0 ? "+" : "−"}{Math.abs(gap).toFixed(0)}pp vs CBW)</span>}
          <span style={{ color: C.faint }}> · {fmtStamp(p.at)}{stale ? " · stale" : ""}</span>
          <button onClick={() => setPasted(bank, null)} style={{ ...chipBtn(false), marginLeft: 4 }} aria-label="Clear pasted pricing">✕</button>
        </span>
      ) : <span style={smallMono(fs)}>none</span>}
      <button onClick={() => setOpen(o => !o)} style={chipBtn(open, C.ink)}>{open ? "close" : p ? "update" : "paste"}</button>
      {open && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" placeholder="% next mtg" style={{ ...inputStyle, width: 76 }} aria-label="Probability of a move at the next meeting, percent" />
          <input value={bp} onChange={e => setBp(e.target.value)} inputMode="decimal" placeholder="bp priced" style={{ ...inputStyle, width: 70 }} aria-label="Cumulative basis points priced" />
          <input value={src} onChange={e => setSrc(e.target.value)} placeholder="source" style={{ ...inputStyle, width: 100 }} aria-label="Source name" onKeyDown={e => e.key === "Enter" && save()} />
          <button onClick={save} style={chipBtn(false, C.ink)}>save</button>
        </span>
      )}
    </div>
  );
}

function BankCard({ bank, today, now, series, path, pasted, setPasted, mpt, speech, speechBusy, onSpeechRefresh }) {
  const fs = useFs();
  const B = BANKS[bank];
  const next = B.next(today);
  const nextDay = next ? B.day(next) : null;
  const win = next ? B.win(next) : null;
  const inWin = win && today >= win.start && today <= win.end;
  const soon = win && !inWin && daysUntil(win.start, today) <= 14 && daysUntil(win.start, today) >= 0;
  const op = officialPath(path, bank);
  const first = op?.rows?.[0];

  let rateBig = "—", rateSub = null;
  if (bank === "fed") {
    const lo = series.ffLo, hiS = series.ffHi;
    if (has(lo?.last) && has(hiS?.last)) {
      rateBig = `${lo.last.toFixed(2)}–${hiS.last.toFixed(2)}%`;
      rateSub = has(series.effr?.last) ? `target range · EFFR ${series.effr.last.toFixed(2)}%` : "target range";
    } else if (path?.currentRate) { rateBig = `${path.currentRate.toFixed(2)}%`; rateSub = "effective rate (CBW) — add FRED key for the range"; }
  } else if (bank === "ecb") {
    if (has(series.dfr?.last)) { rateBig = `${series.dfr.last.toFixed(2)}%`; rateSub = `deposit rate${series.estr?.last ? ` · €STR ${series.estr.last.toFixed(3)}%` : ""}`; }
  } else if (path?.currentRate) { rateBig = `${path.currentRate.toFixed(2)}%`; rateSub = "policy rate (overnight call rate target) · via CBW"; }

  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>{B.title}</span>
        {win && (inWin || soon) && (
          <Tip tip={B.winTip} underline={false}>
            <span style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: 600, padding: "1px 6px", borderRadius: 3,
              color: inWin ? "#fff" : C.amber, background: inWin ? C.red : C.amberBg, border: `1px solid ${inWin ? C.red : C.amber + "55"}` }}>
              {inWin ? `${B.winWord.toUpperCase()} to ${fmtDay(win.end)}` : `${B.winWord[0].toUpperCase()}${B.winWord.slice(1)}${win.approx ? " ≈" : ""} from ${fmtDay(win.start)}`}
            </span>
          </Tip>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
        <span style={{ fontFamily: SERIF, fontSize: fs(22), fontWeight: 600, color: C.ink }}>{rateBig}</span>
        {rateSub && <span style={smallMono(fs)}>{rateSub}</span>}
      </div>
      {bank === "ecb" && series.ezHicp?.points?.length > 0 && (
        <div style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub }}>
          HICP <b style={{ color: C.ink }}>{series.ezHicp.last.toFixed(1)}%</b>
          {has(series.ezCore?.last) && <> · core <b style={{ color: C.ink }}>{series.ezCore.last.toFixed(1)}%</b></>}
          {has(series.ezServ?.last) && <> · services {series.ezServ.last.toFixed(1)}%</>}
          <span style={{ color: C.mute }}> · {mon(series.ezHicp.lastDate)}</span>
        </div>
      )}
      {bank === "boj" && (has(series.jgb10?.last) || has(series.usdjpy?.last)) && (
        <div style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub }}>
          {has(series.jgb2?.last) && <>JGB 2y <b style={{ color: C.ink }}>{series.jgb2.last.toFixed(3)}%</b> · </>}
          {has(series.jgb10?.last) && <>10y <b style={{ color: C.ink }}>{series.jgb10.last.toFixed(3)}%</b></>}
          {has(series.usdjpy?.last) && <> · USD/JPY <b style={{ color: C.ink }}>{series.usdjpy.last.toFixed(2)}</b></>}
        </div>
      )}
      {next && (
        <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.sub }}>
          Next decision <b style={{ color: C.ink }}>{B.when(next)}</b>
          <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.mute }}> · in {daysUntil(nextDay, today)}d{B.extra(next) ? ` · ${B.extra(next)}` : ""}{next.note ? ` · ${next.note}` : ""}</span>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
          <Tip tip={GLOSSARY.cbwPath}><span style={smallMono(fs, C.sub)}>MARKET-IMPLIED PATH</span></Tip>
          <Tip underline={false} tip={`Central Bank Watch · SECONDARY-unverified · ${op?.asOf ? `data as of ${op.asOf}` : "date not stated"}${op?.dropped ? ` · ${op.dropped} row(s) dropped: dated off the official calendar` : ""}${op?.remapped ? " · CBW's meeting dates differ from the BoJ's published schedule, so each row is matched to the nearest official meeting (within a week): per-meeting timing is approximate" : ""}`}>
            <span style={smallMono(fs, TIER_COLOR["SECONDARY-unverified"])}>CBW{op?.asOf ? ` · ${fmtDay(op.asOf)}` : ""}{op?.remapped ? " · dates ≈" : ""}</span>
          </Tip>
        </div>
        {first ? (
          <div style={{ fontFamily: SERIF, fontSize: fs(13), color: C.ink, margin: "3px 0 2px" }}>
            {has(first.pct) ? <><b>{first.pct.toFixed(0)}%</b> odds of a {first.stepBp >= 0 ? "hike" : "cut"} on {fmtDay(first.date)}</> : <><b>{sgnBp(first.stepBp)}</b> priced for {fmtDay(first.date)}</>}
            {op.rows.length > 1 && <span style={{ color: C.sub }}> · {sgnBp(op.rows[op.rows.length - 1].cum)} by {mon(op.rows[op.rows.length - 1].date)}</span>}
          </div>
        ) : <div style={smallMono(fs)}>unavailable this refresh</div>}
        {op && <PathBars rows={op.rows} fs={fs} />}
      </div>

      {bank === "fed" && <MptTable mpt={mpt} fs={fs} />}
      {bank === "ecb" && <RateChanges title="EURO RATES AHEAD · ECB yield curve" tip={GLOSSARY.ezFwd} fs={fs}
        rows={[{ label: "in 6 months", s: series.ezFwd6m }, { label: "in 1 year", s: series.ezFwd1y }, { label: "in 2 years", s: series.ezFwd2y }]} />}
      {bank === "boj" && <RateChanges title="JGB YIELDS · MoF" tip={GLOSSARY.jgbPath} fs={fs}
        rows={[{ label: "JGB 2y", s: series.jgb2 }, { label: "JGB 10y", s: series.jgb10 }]} />}
      <PasteBox bank={bank} cbwNext={first} pasted={pasted} setPasted={setPasted} fs={fs} now={now} />
      <SpeakerPanel bank={bank} speech={speech} busy={speechBusy} onRefresh={onSpeechRefresh}
        blackout={inWin ? `${B.winWord[0].toUpperCase()}${B.winWord.slice(1)} until ${fmtDay(win.end)} — little or no policy commentary expected` : null} />
      <div style={{ ...smallMono(fs), marginTop: 5 }}>
        Cross-check: {LINKS[bank].map(([l, u], i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{l}</a></span>)}
      </div>
    </div>
  );
}

export default function PolicyPanel({ today, now, series, paths, pasted, setPasted, mpt, speech, speechBusy, onSpeechRefresh }) {
  const fs = useFs();
  const mid = has(series.ffLo?.last) && has(series.ffHi?.last) ? (series.ffLo.last + series.ffHi.last) / 2 : paths?.fed?.currentRate ?? null;
  const dfr = series.dfr?.last ?? paths?.ecb?.currentRate ?? null;
  const boj = paths?.boj?.currentRate ?? null;
  const gapE = has(mid) && has(dfr) ? Math.round((mid - dfr) * 100) : null;
  const gapJ = has(mid) && has(boj) ? Math.round((mid - boj) * 100) : null;
  const common = { today, now, series, pasted, setPasted, speech, speechBusy, onSpeechRefresh };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "0 0 6px 2px" }}>
        <span style={kickerStyle(fs)}>CENTRAL BANKS<InfoTip tip={{ t: "Central banks", d: "For each bank: the policy rate, the next decision, what markets price (meeting by meeting), how that pricing has moved over 1 week, 3 and 6 months, and what officials are saying.",
          r: "Hover any small-caps label for what it means. The ECB and BoJ have no free options-implied tracker like the Atlanta Fed's, so their change tables use the ECB's own yield curve and JGB yields." }} /></span>
        {(gapE !== null || gapJ !== null) && (
          <Tip tip={GLOSSARY.policyGap}>
            <span style={smallMono(fs, C.sub)}>
              policy gaps: {gapE !== null && <>Fed–ECB <b style={{ color: C.ink }}>{gapE}bp</b></>}{gapE !== null && gapJ !== null ? " · " : ""}{gapJ !== null && <>Fed–BoJ <b style={{ color: C.ink }}>{gapJ}bp</b></>}
            </span>
          </Tip>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))", gap: 14 }}>
        <BankCard bank="fed" path={paths?.fed} mpt={mpt} {...common} />
        <BankCard bank="ecb" path={paths?.ecb} {...common} />
        <BankCard bank="boj" path={paths?.boj} {...common} />
      </div>
      <LeadBanksCard series={series} paths={paths} today={today} />
    </div>
  );
}
