import { SOURCE_META } from "../../data/macroSeries.js";
import { C, MONO, smallMono, useFs, TIER_COLOR } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

// One chip per source: status, series answered, reliability tier, last fetch.
// A failing source is named with its error so a stale number never passes for
// a current one.
export default function SourceHealth({ health }) {
  const fs = useFs();
  const entries = Object.entries(SOURCE_META).filter(([k]) => health[k]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={smallMono(fs, C.sub)}>SOURCES</span>
      {entries.map(([k, meta]) => {
        const h = health[k];
        const errs = Object.values(h.errors || {});
        const needsKey = errs.some(e => String(e).includes("_API_KEY"));
        const ok = h.ok > 0 && !h.error;
        const partial = ok && h.ok < h.requested;
        const color = needsKey ? C.goldDark : !ok ? C.red : partial ? C.amber : C.green;
        const why = needsKey ? `needs ${meta.key} in Vercel` : h.error || (errs[0] ? String(errs[0]).slice(0, 60) : "");
        return (
          <span key={k} title={`${meta.label} — ${meta.tier}\n${h.ok}/${h.requested} series · fetched ${fmtStamp(h.fetchedAt)}${why ? `\n${why}` : ""}`}
            style={{ fontFamily: MONO, fontSize: fs(9), color: C.sub, border: `1px solid ${C.line}`, borderRadius: 3, padding: "1px 6px", background: "#fff" }}>
            <span style={{ color }}>●</span> {meta.short} {h.ok}/{h.requested}
            <span style={{ color: TIER_COLOR[meta.tier], marginLeft: 4 }}>{meta.tier === "PRIMARY" ? "P" : meta.tier === "SECONDARY-reliable" ? "S-r" : "S-u"}</span>
            {!ok || needsKey ? <span style={{ color, marginLeft: 4 }}>{needsKey ? "key" : why.slice(0, 28)}</span> : null}
          </span>
        );
      })}
      <span style={smallMono(fs)}>P = PRIMARY · S-r = SECONDARY-reliable · S-u = SECONDARY-unverified · hover for detail</span>
    </div>
  );
}
