import Spark from "./Spark.jsx";
import { SourceTag } from "./SeriesTable.jsx";
import { C, MONO, card, kickerStyle, smallMono, useFs } from "./macroStyles.js";
import { fmtLevel, fmtChg, bigMove, sourceTitle } from "../../macroFormat.js";

// Stat tiles: label · level · 1d and 1m change · 6-month sparkline · source.
// Change figures stay in ink — for commodities "up" is neither good nor bad —
// and only a move past the series' alert threshold is highlighted.
function Tile({ s, fs }) {
  const has = s?.points?.length > 0;
  const big = bigMove(s);
  return (
    <div title={sourceTitle(s)} style={{ border: `1px solid ${big ? C.amber + "66" : C.line2}`, background: big ? C.amberBg : "#fff",
      borderRadius: 6, padding: "7px 9px", minWidth: 0 }}>
      <div style={{ ...smallMono(fs), fontSize: fs(8.5), letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {s.label.toUpperCase()}
      </div>
      {has ? <>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: fs(14), fontWeight: 600, color: C.ink }}>{fmtLevel(s)}</span>
          <SourceTag s={s} fs={fs} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub, display: "flex", gap: 8 }}>
          {s.freq === "M" ? <>
            <span>1m {fmtChg(s, s.chg1m)}</span>
            <span>1y {fmtChg(s, s.chg1y)}</span>
          </> : <>
            <span style={{ color: big ? C.amber : C.sub, fontWeight: big ? 700 : 400 }}>1d {fmtChg(s, s.chg1d)}</span>
            <span>1m {fmtChg(s, s.chg1m)}</span>
          </>}
        </div>
        {s.thrFrom && s.thr?.length ? (() => {
          const ref = s.thr[s.thr.length - 1];
          const gap = s.last - ref.v;
          return (
            <div title={ref.label} style={{ fontFamily: MONO, fontSize: fs(9.5), color: Math.abs(gap) >= 5 ? C.amber : C.sub, fontWeight: Math.abs(gap) >= 5 ? 700 : 400 }}>
              vs {ref.label}: {fmtLevel(s, ref.v)} ({fmtChg({ ...s, chg: "abs" }, gap)})
            </div>
          );
        })() : null}
        <div style={{ marginTop: 3 }}>
          <Spark points={s.points} thr={s.thr} fmt={v => fmtLevel(s, v)} width={132} height={24} monthly={s.freq === "M"} />
        </div>
      </> : (
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.faint, padding: "6px 0 14px" }}>
          unavailable{s?.error ? ` · ${String(s.error).slice(0, 40)}` : ""}
        </div>
      )}
    </div>
  );
}

export default function CommodityTiles({ groups, series, onlineNote }) {
  const fs = useFs();
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={kickerStyle(fs)}>COMMODITIES</span>
        <span style={smallMono(fs)}>hover a tile for source, tier and date · * = fallback source · amber = daily move past its alert threshold</span>
        {onlineNote && <span style={{ ...smallMono(fs, C.amber) }}>{onlineNote}</span>}
      </div>
      {groups.map(g => (
        <div key={g.id} style={{ marginBottom: 8 }}>
          <div style={{ ...smallMono(fs, C.sub), fontWeight: 600, letterSpacing: "0.08em", margin: "2px 0 4px" }}>{g.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(152px,100%),1fr))", gap: 6 }}>
            {g.ids.map(id => series[id] && <Tile key={id} s={series[id]} fs={fs} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
