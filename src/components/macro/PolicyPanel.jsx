import { useState } from "react";
import { FOMC_MEETINGS, ECB_MEETINGS, nextFomc, nextEcb, fedBlackout, ecbQuiet, fmtDay, fmtRange, daysUntil } from "../../data/macroCalendar.js";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle, TIER_COLOR } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";
import SpeakerPanel from "./SpeakerPanel.jsx";

// Atlanta Fed Market Probability Tracker: the SOFR-options distribution of the
// policy rate for each 3-month window — a PRIMARY second read next to Central
// Bank Watch's meeting-by-meeting path. Rates in the file are in basis points.
function MptTable({ mpt, fs }) {
  if (!mpt?.windows?.length) return null;
  const rows = mpt.windows.slice(0, 5);
  const cols = "52px 54px 52px 52px 46px";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={smallMono(fs, C.sub)}>SOFR OPTIONS</span>
        <span style={smallMono(fs, TIER_COLOR.PRIMARY)}>Atlanta Fed Market Probability Tracker · PRIMARY (model)</span>
        <span style={smallMono(fs)}>as of {fmtDay(mpt.asOf)} · target {mpt.targetRange?.replace(/bps/g, "").replace(" - ", "–")}bp{mpt.prior ? ` · Δ vs ${fmtDay(mpt.prior.asOf)}` : ""}</span>
      </div>
      <div role="table" aria-label="SOFR options implied rates" style={{ marginTop: 2 }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 6, ...smallMono(fs, C.faint), fontSize: fs(8) }}>
          <span role="columnheader">WINDOW</span><span role="columnheader" style={{ textAlign: "right" }}>MEAN</span>
          <span role="columnheader" style={{ textAlign: "right" }}>Δ WEEK</span><span role="columnheader" style={{ textAlign: "right" }}>P(HIKE)</span>
          <span role="columnheader" style={{ textAlign: "right" }}>P(CUT)</span>
        </div>
        {rows.map(w => {
          const p = mpt.prior?.windows?.find(x => x.start === w.start);
          const d = p && w.mean !== null && p.mean !== null ? w.mean - p.mean : null;
          return (
            <div role="row" key={w.start} title={`3-month window from ${w.start}: 25th–75th percentile ${(w.p25 / 100).toFixed(2)}–${(w.p75 / 100).toFixed(2)}%, mode ${(w.mode / 100).toFixed(2)}%`}
              style={{ display: "grid", gridTemplateColumns: cols, gap: 6, fontFamily: MONO, fontSize: fs(10), color: C.ink, borderBottom: `1px solid ${C.line2}` }}>
              <span role="cell">{mon(w.start)}</span>
              <span role="cell" style={{ textAlign: "right", fontWeight: 600 }}>{w.mean !== null ? `${(w.mean / 100).toFixed(2)}%` : "n/a"}</span>
              <span role="cell" style={{ textAlign: "right", color: d !== null && Math.abs(d) >= 10 ? C.amber : C.sub, fontWeight: d !== null && Math.abs(d) >= 10 ? 700 : 400 }}>{d === null ? "—" : sgnBp(d)}</span>
              <span role="cell" style={{ textAlign: "right" }}>{w.pHike !== null ? `${w.pHike.toFixed(0)}%` : "n/a"}</span>
              <span role="cell" style={{ textAlign: "right", color: C.sub }}>{w.pCut !== null ? `${w.pCut.toFixed(0)}%` : "n/a"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ ...smallMono(fs), marginTop: 2 }}>Mean SOFR expected over each 3-month window; P(hike) = probability the rate is above today's range. Hover a row for the 25th–75th percentile.</div>
    </div>
  );
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = d => `${MON[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== "2026" ? `-${d.slice(2, 4)}` : ""}`;
const sgnBp = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}bp`;
const STALE_PASTE_MS = 3 * 86400000;

const LINKS = {
  fed: [
    ["CME FedWatch", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"],
    ["Atlanta Fed tracker", "https://www.atlantafed.org/cenfis/market-probability-tracker"],
    ["Central Bank Watch", "https://centralbank.watch/federal-reserve/"],
  ],
  ecb: [
    ["Central Bank Watch", "https://centralbank.watch/european-central-bank/"],
    ["RateProbability", "https://rateprobability.com/ecb"],
    ["ECB Watch Tool", "https://ecb-watch.eu/"],
    ["BlueGamma", "https://www.bluegamma.io/"],
  ],
};

// Keep only rows dated on an official decision day; Central Bank Watch's Fed
// table still carried the pre-12-Nov 2027 schedule, so stale rows are dropped
// rather than shown against the wrong meeting.
function officialPath(path, bank) {
  if (!path?.meetings?.length) return null;
  const days = new Set(bank === "fed" ? FOMC_MEETINGS.filter(m => !m.noDecision).map(m => m.end) : ECB_MEETINGS.map(m => m.date));
  const kept = path.meetings.filter(m => days.has(m.date));
  let cum = 0;
  const rows = kept.map(m => { cum += m.stepBp; return { ...m, cum }; });
  return { ...path, rows, dropped: path.meetings.length - kept.length };
}

// Cumulative bp priced by each meeting: one series, so no legend; thin bars with
// 4px rounded ends on the baseline; the next meeting in the accent. Hovering a
// bar updates the readout line above it (the tooltip).
function PathBars({ rows, fs }) {
  const [hi, setHi] = useState(0);
  if (!rows?.length) return null;
  const vals = rows.map(r => r.cum);
  const pos = Math.max(0, ...vals), neg = Math.max(0, ...vals.map(v => -v));
  const H = 46;
  const span = Math.max(5, pos + neg);
  const base = (pos / span) * H;            // baseline's distance from the top
  const r = rows[Math.min(hi, rows.length - 1)];
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, minHeight: 14 }}>
        <b style={{ color: C.ink }}>{fmtDay(r.date)}</b>: {sgnBp(r.stepBp)} at this meeting{r.pct !== null ? ` (${r.pct.toFixed(0)}% move)` : ""}
        {" · "}{sgnBp(r.cum)} cumulative · rate {r.level.toFixed(2)}%
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 3 }} onMouseLeave={() => setHi(0)}>
        {rows.map((x, i) => {
          const h = Math.max(2, (Math.abs(x.cum) / span) * H);
          const down = x.cum < 0;
          return (
            <div key={x.date} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} tabIndex={0}
              aria-label={`${fmtDay(x.date)}: ${sgnBp(x.cum)} cumulative`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", outline: "none" }}>
              <div style={{ position: "relative", height: H, width: "100%" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: base, borderTop: `1px solid ${C.line}` }} />
                <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: "62%", maxWidth: 22, height: h,
                  top: down ? base : base - h, borderRadius: down ? "0 0 4px 4px" : "4px 4px 0 0",
                  background: i === 0 ? C.red : hi === i ? C.blue : C.slate }} />
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
  const [src, setSrc] = useState(bank === "fed" ? "CME FedWatch" : "€STR OIS");
  const [open, setOpen] = useState(false);
  const stale = p && now - p.at > STALE_PASTE_MS;
  const save = () => {
    const a = parseFloat(pct), b = parseFloat(bp);
    if (!Number.isFinite(a) && !Number.isFinite(b)) return;
    setPasted(bank, { pct: Number.isFinite(a) ? a : null, bp: Number.isFinite(b) ? b : null, src: src.trim() || "your source" });
    setPct(""); setBp(""); setOpen(false);
  };
  const gap = p?.pct !== null && p?.pct !== undefined && cbwNext?.pct !== null && cbwNext?.pct !== undefined ? p.pct - cbwNext.pct : null;
  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${C.line2}`, paddingTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={smallMono(fs, C.sub)}>YOUR READ</span>
        {p ? (
          <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: stale ? C.faint : C.ink }}>
            {p.src}: {p.pct !== null ? `${p.pct}% move next meeting` : ""}{p.pct !== null && p.bp !== null ? " · " : ""}{p.bp !== null ? `${sgnBp(p.bp)} priced` : ""}
            {gap !== null && <span style={{ color: Math.abs(gap) >= 5 ? C.amber : C.mute, fontWeight: Math.abs(gap) >= 5 ? 700 : 400 }}>
              {" "}({gap >= 0 ? "+" : "−"}{Math.abs(gap).toFixed(0)}pp vs CBW)</span>}
            <span style={{ color: C.faint }}> · {fmtStamp(p.at)}{stale ? " · stale" : ""}</span>
            <button onClick={() => setPasted(bank, null)} style={{ ...chipBtn(false), marginLeft: 4 }} aria-label="Clear pasted pricing">✕</button>
          </span>
        ) : <span style={smallMono(fs)}>none — paste from your own source to compare</span>}
        <button onClick={() => setOpen(o => !o)} style={chipBtn(open, C.ink)}>{open ? "close" : p ? "update" : "paste"}</button>
      </div>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5, alignItems: "center" }}>
          <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" placeholder="% next mtg" style={{ ...inputStyle, width: 80 }} aria-label="Probability of a move at the next meeting, percent" />
          <input value={bp} onChange={e => setBp(e.target.value)} inputMode="decimal" placeholder="bp priced" style={{ ...inputStyle, width: 74 }} aria-label="Cumulative basis points priced" />
          <input value={src} onChange={e => setSrc(e.target.value)} placeholder="source" style={{ ...inputStyle, width: 110 }} aria-label="Source name" onKeyDown={e => e.key === "Enter" && save()} />
          <button onClick={save} style={chipBtn(false, C.ink)}>save</button>
        </div>
      )}
    </div>
  );
}

function BankCard({ bank, today, now, series, path, pasted, setPasted, mpt, speech, speechBusy, onSpeechRefresh }) {
  const fs = useFs();
  const isFed = bank === "fed";
  const next = isFed ? nextFomc(today) : nextEcb(today);
  const nextDay = next ? (isFed ? next.end : next.date) : null;
  const win = next ? (isFed ? fedBlackout(next) : ecbQuiet(next)) : null;
  const inWin = win && today >= win.start && today <= win.end;
  const soon = win && !inWin && daysUntil(win.start, today) <= 14 && daysUntil(win.start, today) >= 0;
  const op = officialPath(path, bank);
  const first = op?.rows?.[0];

  let rateBig = "—", rateSub = null;
  if (isFed) {
    const lo = series.ffLo, hiS = series.ffHi;
    if (lo?.last !== null && lo?.last !== undefined && hiS?.last !== null && hiS?.last !== undefined) {
      rateBig = `${lo.last.toFixed(2)}–${hiS.last.toFixed(2)}%`;
      rateSub = series.effr?.last !== null && series.effr?.last !== undefined ? `EFFR ${series.effr.last.toFixed(2)}% · FRED` : "target range · FRED";
    } else if (path?.currentRate) {
      rateBig = `${path.currentRate.toFixed(2)}%`;
      rateSub = "effective rate via Central Bank Watch — add FRED key for the target range";
    }
  } else if (series.dfr?.last !== null && series.dfr?.last !== undefined) {
    rateBig = `${series.dfr.last.toFixed(2)}%`;
    rateSub = `deposit rate${series.estr?.last ? ` · €STR ${series.estr.last.toFixed(3)}%` : ""} · ECB`;
  }

  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>{isFed ? "FED · FOMC" : "ECB · GOVERNING COUNCIL"}</span>
        {win && (inWin || soon) && (
          <span style={{ fontFamily: MONO, fontSize: fs(9), fontWeight: 600, padding: "1px 6px", borderRadius: 3,
            color: inWin ? "#fff" : C.amber, background: inWin ? C.red : C.amberBg, border: `1px solid ${inWin ? C.red : C.amber + "55"}` }}>
            {inWin ? `${isFed ? "BLACKOUT" : "QUIET PERIOD"} to ${fmtDay(win.end)}` : `${isFed ? "Blackout" : "Quiet period"}${win.approx ? " ≈" : ""} from ${fmtDay(win.start)}`}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
        <span style={{ fontFamily: SERIF, fontSize: fs(22), fontWeight: 600, color: C.ink }}>{rateBig}</span>
        {rateSub && <span style={smallMono(fs)}>{rateSub}</span>}
      </div>
      {!isFed && series.ezHicp?.points?.length > 0 && (
        <div style={{ fontFamily: MONO, fontSize: fs(10), color: C.sub }}>
          HICP <b style={{ color: C.ink }}>{series.ezHicp.last.toFixed(1)}%</b>
          {series.ezCore?.last !== null && series.ezCore?.last !== undefined && <> · core <b style={{ color: C.ink }}>{series.ezCore.last.toFixed(1)}%</b></>}
          {series.ezServ?.last !== null && series.ezServ?.last !== undefined && <> · services {series.ezServ.last.toFixed(1)}%</>}
          {series.ezEnergy?.last !== null && series.ezEnergy?.last !== undefined && <> · energy {series.ezEnergy.last.toFixed(1)}%</>}
          <span style={{ color: C.mute }}> · {mon(series.ezHicp.lastDate)}, Eurostat</span>
        </div>
      )}
      {next && (
        <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.sub }}>
          Next decision <b style={{ color: C.ink }}>{isFed ? fmtRange(next.start, next.end) : fmtDay(next.date)}</b>
          <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.mute }}> · in {daysUntil(nextDay, today)}d</span>
          {(next.sep || next.proj) && <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.mute }}> · {isFed ? "with dots (SEP)" : "with staff projections"}</span>}
          {next.note && <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.mute }}> · {next.note}</span>}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
          <span style={smallMono(fs, C.sub)}>MARKET-IMPLIED PATH</span>
          <span style={smallMono(fs, TIER_COLOR["SECONDARY-unverified"])}>Central Bank Watch · SECONDARY-unverified</span>
          <span style={smallMono(fs)}>{op ? `data as of ${op.asOf ? fmtDay(op.asOf) : "date not stated — fetched now"}` : "unavailable"}</span>
        </div>
        {first && (
          <div style={{ fontFamily: SERIF, fontSize: fs(13), color: C.ink, margin: "3px 0 2px" }}>
            <b>{sgnBp(first.stepBp)}</b> priced for {fmtDay(first.date)}
            {first.pct !== null && <> · <b>{first.pct.toFixed(0)}%</b> chance of a {first.stepBp >= 0 ? "hike" : "cut"}</>}
            {op.rows.length > 1 && <span style={{ color: C.sub }}> · {sgnBp(op.rows[op.rows.length - 1].cum)} by {mon(op.rows[op.rows.length - 1].date)}</span>}
          </div>
        )}
        {op && <PathBars rows={op.rows} fs={fs} />}
        {op?.dropped > 0 && <div style={smallMono(fs)}>{op.dropped} row{op.dropped > 1 ? "s" : ""} dropped — dated off the {isFed ? "Fed's revised (12 Nov)" : "ECB's"} calendar</div>}
      </div>

      {isFed && <MptTable mpt={mpt} fs={fs} />}
      <PasteBox bank={bank} cbwNext={first} pasted={pasted} setPasted={setPasted} fs={fs} now={now} />
      <SpeakerPanel bank={bank} speech={speech} busy={speechBusy} onRefresh={onSpeechRefresh}
        blackout={inWin ? `${isFed ? "Fed blackout" : "ECB quiet period"} until ${fmtDay(win.end)} — little or no policy commentary expected` : null} />
      <div style={{ ...smallMono(fs), marginTop: 5 }}>
        Cross-check: {LINKS[bank].map(([l, u], i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{l}</a></span>)}
      </div>
    </div>
  );
}

export default function PolicyPanel({ today, now, series, paths, pasted, setPasted, mpt, speech, speechBusy, onSpeechRefresh }) {
  const fs = useFs();
  const mid = series.ffLo?.last !== null && series.ffLo?.last !== undefined && series.ffHi?.last !== null && series.ffHi?.last !== undefined
    ? (series.ffLo.last + series.ffHi.last) / 2 : paths?.fed?.currentRate ?? null;
  const dfr = series.dfr?.last ?? paths?.ecb?.currentRate ?? null;
  const gap = mid !== null && dfr !== null ? Math.round((mid - dfr) * 100) : null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))", gap: 14 }}>
        <BankCard bank="fed" today={today} now={now} series={series} path={paths?.fed} pasted={pasted} setPasted={setPasted}
          mpt={mpt} speech={speech} speechBusy={speechBusy} onSpeechRefresh={onSpeechRefresh} />
        <BankCard bank="ecb" today={today} now={now} series={series} path={paths?.ecb} pasted={pasted} setPasted={setPasted}
          speech={speech} speechBusy={speechBusy} onSpeechRefresh={onSpeechRefresh} />
      </div>
      {gap !== null && (
        <div style={{ ...smallMono(fs, C.sub), marginTop: 5 }}>
          Fed–ECB policy gap <b style={{ color: C.ink }}>{gap}bp</b> ({series.ffLo?.last !== null && series.ffLo?.last !== undefined ? "Fed target midpoint" : "Fed effective rate"} − ECB deposit rate) — a wider gap supports USD over EUR (19 Nov note: ≈140bp, widening toward ≈175–200bp by spring, estimate)
        </div>
      )}
    </div>
  );
}
