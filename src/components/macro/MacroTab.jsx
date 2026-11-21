import { useState, useEffect, useMemo } from "react";
import ArticleCard from "../ArticleCard.jsx";
import { Dots } from "../helpers.jsx";
import { topicMatches } from "../../topicDials.js";
import { TABLE_PANELS, TILE_GROUPS } from "../../data/macroSeries.js";
import SignalsBoard from "./SignalsBoard.jsx";
import ScenarioStrip from "./ScenarioStrip.jsx";
import PolicyPanel from "./PolicyPanel.jsx";
import SeriesTable from "./SeriesTable.jsx";
import InflationCard from "./InflationCard.jsx";
import BreadthCard from "./BreadthCard.jsx";
import GasBaseCard from "./GasBaseCard.jsx";
import EuroHicpCard from "./EuroHicpCard.jsx";
import CommodityTiles from "./CommodityTiles.jsx";
import MacroCalendar from "./MacroCalendar.jsx";
import AlertInbox from "./AlertInbox.jsx";
import SourceHealth from "./SourceHealth.jsx";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtDate, fmtStamp } from "../../macroFormat.js";

const HEADLINE_TOPICS = new Set(["rates", "macro", "oil", "credit", "fx"]);
const FOOTNOTES = {
  rates: "Hover a row for source and date. OAT–Bund and BTP–Bund are monthly ECB averages; paste a daily spread on signal 8. * = fallback source.",
  credit: "CoreWeave bond yields and CDS have no free feed — the shares are a proxy. Equal- vs cap-weight rising = breadth improving.",
  fx: "USD/SGD line at 1.25 = where an unhedged USD T-bill's ≈2pp carry is lost (playbook).",
};
const localDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// The cover page: conclusions first (scenarios and signals), then the policy
// read, then the data behind it, then the news that explains the moves.
export default function MacroTab({ m, canonical, onOpenTab }) {
  const fs = useFs();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60 * 1000); return () => clearInterval(id); }, []);
  const today = localDay(now);

  const S = m.series;
  const healthList = Object.values(m.health);
  const srcOk = healthList.filter(h => h.ok > 0 && !h.error).length;
  const yahooDown = m.health.yahoo && m.health.yahoo.ok === 0;
  const dataTo = S.ust10y?.lastDate;

  const headlines = useMemo(() => {
    const cutoff = now - 24 * 3600 * 1000;
    return (canonical || [])
      .filter(a => { const t = a.pubDate ? new Date(a.pubDate).getTime() : a.fetchedAt || 0; return t > cutoff; })
      .filter(a => topicMatches(a).some(t => HEADLINE_TOPICS.has(t.id)))
      .slice(0, 10);
  }, [canonical, now]);

  if (!m.ready) return <div style={{ textAlign: "center", padding: 60, fontFamily: MONO, fontSize: 11, color: C.mute }}><Dots /> loading macro monitor…</div>;

  return (
    <div className="gm-macro" data-macro style={{ animation: "fadeIn 0.4s ease" }}>
      {/* App.jsx sets *{font-family:Spectral}; inside the Macro tab children inherit their
          parent's font instead, so a <b> inside a mono figure stays mono. News cards keep the app default. */}
      <style>{`.gm-macro *{font-family:inherit}.gm-macro .gm-news *{font-family:'Spectral',Georgia,serif}`}</style>
      {/* Header: regime + scenarios */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={kickerStyle(fs)}>
              MACRO MONITOR · {dataTo ? `data to ${fmtDate(dataTo)}` : "no data yet"} · refreshed {fmtStamp(m.fetchedAt)} · sources {srcOk}/{healthList.length} ok
              {m.unread > 0 && <span style={{ color: C.ink }}> · {m.unread} new alert{m.unread > 1 ? "s" : ""}</span>}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: fs(16), color: C.ink, fontWeight: 700, marginTop: 1 }}>Macro & Policy Monitor</div>
            <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.sub, marginTop: 2, maxWidth: 980, lineHeight: 1.45 }}>
              <b style={{ color: C.ink }}>Regime (playbook, 20 Nov):</b> an inflation shock with a credit-bust tail — 2022's energy-and-rates shock,
              2000's concentration in AI, 2007's early credit cracks. The equity low in this template comes when bond yields peak, not when the Fed cuts:
              watch the 10y and core services, not rate-cut odds.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {m.fetchError && <span style={smallMono(fs, C.red)} title={m.fetchError}>⚠ refresh failed</span>}
            <button onClick={m.refresh} disabled={m.loading} style={{ ...chipBtn(false, C.ink), padding: "4px 10px", fontSize: 10, opacity: m.loading ? 0.6 : 1 }}>
              {m.loading ? <Dots /> : "⟳ refresh data"}
            </button>
          </div>
        </div>
        <ScenarioStrip tally={m.tally} scen={m.scen} onSave={m.setScenWeights} flipsSinceWeights={m.flipsSinceWeights} />
      </div>

      <AlertInbox alerts={m.alerts} unread={m.unread} markRead={m.markRead} notify={m.notify} toggleNotify={m.toggleNotify} />

      <SignalsBoard results={m.results} onSetManual={m.setManual} pasted={m.pasted} setPasted={m.setPasted} now={now} />

      <PolicyPanel today={today} now={now} series={S} paths={m.paths} pasted={m.pasted} setPasted={m.setPasted} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        {TABLE_PANELS.filter(p => p.id !== "fx").map(p => (
          <SeriesTable key={p.id} label={p.label} ids={p.ids} series={S} footnote={FOOTNOTES[p.id]} />
        ))}
        {/* FX is the shortest table; euro-area HICP sits under it so the row stays level */}
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          {TABLE_PANELS.filter(p => p.id === "fx").map(p => (
            <SeriesTable key={p.id} label={p.label} ids={p.ids} series={S} footnote={FOOTNOTES[p.id]} />
          ))}
          <EuroHicpCard series={S} />
        </div>
      </div>

      {/* Inflation detail: the prints, the breadth behind them, and what base effects will do next */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(380px,100%),1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        <InflationCard series={S} />
        <BreadthCard series={S} />
        <GasBaseCard series={S} assume={m.pasted?.gasAssume} setAssume={v => m.setPasted("gasAssume", v)} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <CommodityTiles groups={TILE_GROUPS} series={S}
          onlineNote={yahooDown ? "Yahoo did not answer this refresh — futures tiles show FRED spot fallbacks where listed, or the last stored value" : null} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(420px,100%),1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
        <MacroCalendar today={today} userEvents={m.userEvents} setUserEvents={m.setUserEvents} />
        <div className="gm-news" style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={kickerStyle(fs)}>RELATED HEADLINES · LAST 24H</span>
            <span style={smallMono(fs)}>rates & central banks, macro data, oil, credit, FX — from your news feeds</span>
            <button onClick={() => onOpenTab("breaking")} style={{ ...chipBtn(false, C.ink), marginLeft: "auto" }}>all news → Breaking</button>
          </div>
          {headlines.length ? headlines.map((a, i) => <ArticleCard key={a.id || i} art={a} />)
            : <div style={{ ...smallMono(fs), padding: "10px 0" }}>No macro headlines in the last 24 hours yet — feeds load in the background.</div>}
        </div>
      </div>

      <div style={{ ...card, padding: "8px 14px" }}>
        <SourceHealth health={m.health} />
      </div>
    </div>
  );
}
