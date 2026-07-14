export function timeAgo(ms) {
  if(!ms) return "";
  const d=(Date.now()-ms)/60000;
  if(d<1) return "just now";
  if(d<60) return `${Math.round(d)}m ago`;
  if(d<1440) return `${Math.round(d/60)}h ago`;
  return `${Math.round(d/1440)}d ago`;
}

export function Dots({color="#c0392b"}) {
  return (
    <span style={{display:"inline-flex",gap:3,alignItems:"center"}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:4,height:4,borderRadius:"50%",background:color,
          animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>
      ))}
    </span>
  );
}

// Time-window options for scoping briefings/summaries by how recent their
// source articles are. h:0 ("All") disables the filter and uses every article.
export const WINDOW_OPTIONS = [
  { h:3, label:"3h" }, { h:6, label:"6h" }, { h:12, label:"12h" },
  { h:24, label:"24h" }, { h:48, label:"48h" }, { h:0, label:"All" },
];

// True when an article falls inside the given window (in hours). hours<=0 means
// no limit. Uses pubDate when present, else the time the article was fetched.
export function withinWindow(a, hours) {
  if (!hours || hours <= 0) return true;
  const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt || 0);
  return t > 0 && (Date.now() - t) < hours * 60 * 60 * 1000;
}

// Row of window chips (3h · 6h · … · All) for picking how far back a
// briefing/summary should reach. Mirrors the selector on the Breaking tab.
export function WindowSelector({ value, onChange, color = "#c0392b" }) {
  return (
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {WINDOW_OPTIONS.map(o=>(
        <button key={o.h} onClick={()=>onChange(o.h)}
          style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"2px 7px",borderRadius:3,cursor:"pointer",
            border:value===o.h?`1px solid ${color}`:"1px solid #ddd",
            background:value===o.h?color:"#fff",color:value===o.h?"#fff":"#888"}}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Maps a briefing-generation failure to a short, human-readable message for the UI.
export function humanizeBriefError(e) {
  const m = e?.message || "";
  if (m === "AbortError" || e?.name === "AbortError") return "Timed out — briefing took too long. Try a shorter time window.";
  if (m.includes("429")) return "Rate limited — retry shortly.";
  if (m.includes("529")) return "Service busy — retry shortly.";
  // 5xx (incl. Vercel's 504) means the synthesis exceeded the serverless time
  // limit. A shorter window / fewer articles is the fix, not a plain retry.
  if (/(^|_)5\d\d/.test(m)) return "Server timed out on a large briefing — try a shorter time window.";
  if (m === "empty_response") return "No briefing returned. Retry.";
  return `Couldn't generate briefing (${m || "unknown error"}). Retry.`;
}

export function Tag({children,color="#c0392b",onClick}) {
  return (
    <span onClick={onClick} style={{fontSize:9,padding:"1px 6px",borderRadius:3,
      fontFamily:"'DM Mono',monospace",background:`${color}18`,color,
      border:`1px solid ${color}44`,whiteSpace:"nowrap",cursor:onClick?"pointer":"default"}}>
      {children}
    </span>
  );
}
