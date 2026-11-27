import { useState, useMemo, useEffect } from "react";
import BottomLine from "../macro/BottomLine.jsx";
import Tip from "../macro/Tip.jsx";
import { Dots, timeAgo } from "../helpers.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, chipBtn, inputStyle, useFs } from "../macro/macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";
import { watchBottomLine } from "../../watchSummary.js";
import NamesBoard from "./NamesBoard.jsx";
import AddName from "./AddName.jsx";
import { fmtDay, LANG_TAG } from "./watchFormat.js";

const SEV = { act: C.red, watch: C.amber, info: C.blue };
const localDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function KeyPrompt({ state, setAppKey }) {
  const fs = useFs();
  const [key, setKey] = useState("");
  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 14, borderLeft: `3px solid ${C.red}` }}>
      <div style={{ ...kickerStyle(fs), marginBottom: 4 }}>WATCHLIST · CONNECT TO GLOOMBERG</div>
      <div style={{ fontFamily: SERIF, fontSize: fs(13), color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>
        Your watchlist lives in Gloomberg's database, so this page needs the app key (the <code>GM_APP_KEY</code> passphrase set in Vercel) to read and change it.
        {state === "bad-key" && <b style={{ color: C.red }}> The key saved in this browser was not accepted.</b>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === "Enter" && key && setAppKey(key)}
          placeholder="app key" aria-label="App key" autoComplete="off" style={{ ...inputStyle, flex: "1 1 200px", fontSize: 11, padding: "5px 8px" }} />
        <button onClick={() => key && setAppKey(key)} style={{ ...chipBtn(true, C.ink), padding: "4px 12px", fontSize: 10 }}>connect</button>
      </div>
      <div style={{ ...smallMono(fs), marginTop: 6 }}>The same key as Macro → Setup; it is stored in this browser only.</div>
    </div>
  );
}

function Alerts({ w }) {
  const fs = useFs();
  const [all, setAll] = useState(false);
  const p = w.prefs;
  const list = all ? w.alerts : w.alerts.slice(0, 6);
  return (
    <div style={{ borderTop: `1px solid ${C.line2}`, marginTop: 8, paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
        <Tip tip={{ t: "Alerts", d: "A level fires once when the price crosses it, and again only after the price has moved 1% back and crossed again. A move of 3σ or more fires once a day. Names you mute raise none.",
          r: "Dismiss with × — nothing needs a decision logged. Telegram (from the scheduled server check, every 3 hours on weekdays) sends what you tick here." }}>
          <span style={kickerStyle(fs)}>ALERTS · 7 DAYS{w.alerts.length ? ` · ${w.alerts.length}` : ""}</span>
        </Tip>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <span style={smallMono(fs)}>Telegram:</span>
          <button onClick={() => w.setPrefs({ tgLevels: !p.tgLevels })} style={chipBtn(p.tgLevels, C.ink)} title="Push level crossings to Telegram">levels</button>
          <button onClick={() => w.setPrefs({ tgMoves: !p.tgMoves })} style={chipBtn(p.tgMoves, C.ink)} title="Push big daily moves to Telegram">big moves</button>
          <select value={p.sigma} onChange={e => w.setPrefs({ sigma: Number(e.target.value) })} aria-label="Big-move threshold"
            style={{ ...inputStyle, fontSize: 9, padding: "1px 3px" }} title="How unusual a daily move must be to alert">
            {[2.5, 3, 3.5, 4].map(s => <option key={s} value={s}>{s}σ</option>)}
          </select>
          {w.alerts.length > 0 && <button onClick={() => w.dismiss(w.alerts.map(a => a.id))} style={chipBtn(false, C.ink)}>dismiss all</button>}
        </span>
      </div>
      {list.map(a => (
        <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0", borderBottom: `1px solid ${C.line2}` }}>
          <span style={{ color: SEV[a.sev] || C.mute, fontSize: fs(9) }} aria-label={a.sev}>●</span>
          <span style={{ ...smallMono(fs), whiteSpace: "nowrap" }}>{timeAgo(a.at)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, fontWeight: 600 }}>{a.title}</span>
            {a.detail && <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.mute, marginLeft: 6 }}>{a.detail}</span>}
            {a.server && <span style={{ ...smallMono(fs, C.blue), marginLeft: 6 }}>{a.pushed ? "sent to Telegram" : "server check"}</span>}
          </span>
          <button onClick={() => w.dismiss(a.id)} aria-label="Dismiss" title="Dismiss"
            style={{ border: "none", background: "none", color: C.faint, cursor: "pointer", fontSize: fs(13), lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>
      ))}
      {!w.alerts.length && <div style={{ ...smallMono(fs), padding: "2px 0" }}>None. Levels and big moves will show here.</div>}
      {w.alerts.length > 6 && <button onClick={() => setAll(x => !x)} style={{ ...chipBtn(false, C.ink), marginTop: 4 }}>{all ? "show fewer" : `+ ${w.alerts.length - 6} more`}</button>}
    </div>
  );
}

function ComingUp({ rows, today }) {
  const fs = useFs();
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 31 * 86400000).toISOString().slice(0, 10);
  const ev = [];
  for (const r of rows) {
    if (r.nextResults?.date >= today && r.nextResults.date <= horizon) ev.push({ d: r.nextResults.date, r, what: "results", src: `${r.nextResults.src}${r.nextResults.est ? " est." : ""}` });
    if (r.exDiv?.ex_date >= today && r.exDiv.ex_date <= horizon) ev.push({ d: r.exDiv.ex_date, r, what: `ex-div ${r.exDiv.currency || ""} ${r.exDiv.amount ?? ""}`, src: "Gloomberg" });
  }
  ev.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <Tip tip={{ t: "Dated events", d: "Results dates from your thesis where one exists (else Yahoo's earnings calendar; est. = Yahoo's estimate, not yet confirmed by the company) and declared ex-dividend dates from Gloomberg." }}>
          <span style={kickerStyle(fs)}>COMING UP · 30 DAYS</span>
        </Tip>
      </div>
      {ev.length ? ev.slice(0, 24).map((e, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 8, padding: "3px 0", borderBottom: `1px solid ${C.line2}`, alignItems: "baseline" }}>
          <span style={{ fontFamily: MONO, fontSize: fs(10), color: C.ink, fontWeight: 600 }}>{fmtDay(e.d)}</span>
          <span style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.r.name} <span style={smallMono(fs)}>{e.what}</span>
          </span>
          <span style={smallMono(fs, e.src.includes("est.") ? C.amber : C.mute)}>{e.src}</span>
        </div>
      )) : <div style={{ ...smallMono(fs), padding: "6px 0" }}>Nothing dated in the next 30 days.</div>}
    </div>
  );
}

function Headlines({ rows, now }) {
  const fs = useFs();
  const [hours, setHours] = useState(24);
  const items = useMemo(() => {
    const cut = now - hours * 3600000;
    const out = [];
    for (const r of rows) for (const n of r.newsItems) if (n.ts >= cut) out.push({ ...n, r });
    return out.sort((a, b) => b.ts - a.ts).slice(0, 30);
  }, [rows, hours, now]);
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        <Tip tip={{ t: "Latest on your names", d: "Google News in English and each name's home-market language, plus this app's feeds — only headlines that name the company." }}>
          <span style={kickerStyle(fs)}>LATEST ON YOUR NAMES</span>
        </Tip>
        {[24, 72].map(h => <button key={h} onClick={() => setHours(h)} style={chipBtn(hours === h, C.ink)}>{h}h</button>)}
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {items.map((n, i) => (
          <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.line2}` }}>
            <span style={{ fontFamily: MONO, fontSize: fs(9), color: C.red, fontWeight: 600, marginRight: 6 }}>{n.r.ticker}</span>
            {n.lang !== "en" && <span style={{ fontFamily: MONO, fontSize: fs(8.5), color: C.blue, fontWeight: 700, marginRight: 4 }}>{LANG_TAG[n.r.market.hl] || "LOCAL"}</span>}
            <a href={n.link} target="_blank" rel="noreferrer" style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, textDecoration: "none" }}>{n.title}</a>
            <span style={{ ...smallMono(fs), marginLeft: 6 }}>{n.outlet || ""} · {timeAgo(n.ts)}</span>
          </div>
        ))}
        {!items.length && <div style={{ ...smallMono(fs), padding: "6px 0" }}>No headlines on your names in the last {hours} hours yet — news loads in the background.</div>}
      </div>
    </div>
  );
}

const SYNC_TIP = { t: "Synced with Gloomberg", d: "Names come from Gloomberg's watchlist and holdings, with your latest thesis where there is one. Adding, editing or removing a watchlist name here changes it in Gloomberg; changes made in Gloomberg appear here when you open this tab, switch back to the window, or within 5 minutes.",
  r: "Why tracked, group, local name, benchmark and mute are this app's own settings and don't change Gloomberg." };

function Health({ w }) {
  const fs = useFs();
  const rows = w.rows;
  const priced = rows.filter(r => r.q).length;
  const valued = rows.filter(r => r.f?.fpe || r.f?.pe || r.f?.mcap).length;
  const newsable = rows.filter(r => !r.skipNews);
  const newsDone = newsable.filter(r => r.newsState).length;
  const stale = rows.filter(r => r.stale);
  const ccy = rows.filter(r => r.ccyMismatch);
  const noPrice = rows.filter(r => !r.q);
  const l = w.list;
  return (
    <div style={{ ...card, padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: "2px 14px", ...smallMono(fs) }}>
      <span>Gloomberg: {l ? `synced ${fmtStamp(w.listAt)} · ${l.watch.length} watchlist · ${l.hold.length} held · ${Object.keys(l.theses || {}).length} theses` : "not loaded"}{w.listErr && !["no-key", "bad-key"].includes(w.listErr) ? <b style={{ color: C.red }}> · ⚠ {w.listErr}</b> : null}</span>
      <span title="Yahoo Finance spark endpoint · SECONDARY-reliable">prices {priced}/{rows.length}{w.quotesMeta.at ? ` · ${fmtStamp(w.quotesMeta.at)}` : ""}{w.quotesMeta.error ? <b style={{ color: C.red }}> ⚠ {w.quotesMeta.error}</b> : null}</span>
      <span title="Yahoo v7 quote through Gloomberg's yahoo-proxy edge function · SECONDARY-reliable">valuations {valued}/{rows.length}{w.fundMeta.error ? <b style={{ color: C.red }}> ⚠ {w.fundMeta.error}</b> : null}</span>
      <span title="Google News RSS · SECONDARY">news {newsDone}/{newsable.length}{w.newsBusy ? " · loading" : ""}</span>
      {noPrice.length > 0 && <span style={{ color: C.amber }} title={noPrice.map(r => `${r.ticker}: ${w.quotesMeta.errors?.[r.ticker] || "no data"}`).join("\n")}>no price: {noPrice.map(r => r.ticker).join(", ")}</span>}
      {stale.length > 0 && <span style={{ color: C.amber }} title="Yahoo has not updated these for over 5 days">stale: {stale.map(r => r.ticker).join(", ")}</span>}
      {rows.some(r => r.unitsOff) && <span style={{ color: C.amber }} title="A level more than 20× away from the price — probably pence vs pounds or a split. Not compared or alerted until fixed in Gloomberg.">check level units: {rows.filter(r => r.unitsOff).map(r => r.ticker).join(", ")}</span>}
      {ccy.length > 0 && <span style={{ color: C.amber }} title="A thesis or holding level is in a different currency from the quote, so it isn't compared or alerted">level currency ≠ quote: {ccy.map(r => r.ticker).join(", ")}</span>}
    </div>
  );
}

export default function NamesView({ w, setAppKey }) {
  const fs = useFs();
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);
  const today = localDay(now);
  const rows = w.rows;
  const newsLoaded = rows.some(r => r.newsState);
  const summary = useMemo(() => watchBottomLine(rows, { today, newsLoaded }), [rows, today, newsLoaded]);

  if (!w.ready) return <div style={{ textAlign: "center", padding: 60, fontFamily: MONO, fontSize: 11, color: C.mute }}><Dots /> loading watchlist…</div>;
  if (!w.list && ["no-key", "bad-key"].includes(w.listErr)) return <KeyPrompt state={w.listErr} setAppKey={setAppKey} />;
  if (!w.list) return <div style={{ textAlign: "center", padding: 60, fontFamily: MONO, fontSize: 11, color: w.listErr ? C.red : C.mute }}>{w.listErr ? `⚠ ${w.listErr}` : <><Dots /> loading your Gloomberg watchlist…</>}</div>;

  const l = w.list;
  const lastPx = rows.map(r => r.q?.lastDate).filter(Boolean).sort().pop();
  return (
    <div className="gm-macro" style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{".gm-macro *{font-family:inherit}"}</style>
      <div style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(16), color: C.ink, fontWeight: 700 }}>Watchlist Monitor</span>
            </div>
            <div style={{ ...smallMono(fs), marginTop: 1 }}>
              {rows.length} names ({l.watch.length} watchlist · {l.hold.length} held · {rows.filter(r => r.thesis).length} with thesis) · prices to {lastPx ? fmtDay(lastPx) : "—"} · <Tip tip={SYNC_TIP} underline={false}>synced {fmtStamp(w.listAt)}</Tip>
              {w.alerts.length > 0 && <span style={{ color: C.red }}> · {w.alerts.length} alert{w.alerts.length > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setAdding(a => !a)} style={{ ...chipBtn(adding, C.red), padding: "4px 10px", fontSize: 10, ...(adding ? {} : { color: C.red, borderColor: `${C.red}66` }) }}>+ add name</button>
            <button onClick={w.refreshAll} style={{ ...chipBtn(false, C.ink), padding: "4px 10px", fontSize: 10 }}>⟳ refresh</button>
          </div>
        </div>
        <BottomLine rows={summary} />
        <Alerts w={w} />
      </div>

      {adding && <AddName w={w} onClose={() => setAdding(false)} />}

      <NamesBoard w={w} rows={rows} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(380px,100%),1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        <ComingUp rows={rows} today={today} />
        <Headlines rows={rows} now={now} />
      </div>

      <Health w={w} />

      {w.undo && (
        <div role="status" style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: C.ink, color: "#fff", maxWidth: "calc(100vw - 32px)",
          borderRadius: 6, padding: "8px 14px", display: "flex", gap: 12, alignItems: "center", fontFamily: MONO, fontSize: 11, boxShadow: "0 4px 18px rgba(0,0,0,0.25)" }}>
          <span>Removed <b>{w.undo.label}</b> from your watchlist (Gloomberg too){w.undo.held ? " · still shown: you hold it" : ""}</span>
          <button onClick={w.undoRemove} disabled={w.busy} style={{ background: "#fff", border: "none", color: C.ink, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: MONO, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>undo</button>
        </div>
      )}
    </div>
  );
}
