import { useContext } from "react";
import { FontScaleCtx } from "../context.js";
import { SECTOR_MAP, SIGNAL_META, SIGNAL_CATEGORIES } from "../data/taxonomy.js";
import { SOURCES } from "../data/sources.js";
import { Tag, timeAgo } from "./helpers.jsx";

export default function ArticleCard({art, highlightKeyword=null}) {
  const fontScale = useContext(FontScaleCtx);
  const sec = art.sector ? SECTOR_MAP[art.sector] : null;
  const sigMeta   = art.signal ? SIGNAL_META[art.signal] : null;
  const catMeta   = art.signalCategory ? SIGNAL_CATEGORIES[art.signalCategory] : null;
  const isMgmt    = catMeta?.mgmt === true;
  const isStrong  = art.signal === "SP2" || art.signal === "SN2";
  const isWeakCtx = art.weaknessContext === true;
  const isCJK = s => s && (s.match(/[一-鿿가-퟿぀-ゟ]/g)||[]).length / s.length > 0.25;
  const rawTitle = art.translatedTitle || art.title;
  const displayTitle = isCJK(rawTitle) && art.lang !== "en"
    ? (art.translatedTitle && !isCJK(art.translatedTitle) ? art.translatedTitle : "[Translation pending…] " + rawTitle)
    : rawTitle;
  const directMatches = (art.watchMatches||[]).filter(m=>m.matchType==="direct");
  const relatedMatches = (art.watchMatches||[]).filter(m=>m.matchType==="related");
  const isHighlighted = art.watchMatches?.length > 0;
  const focusMatch = highlightKeyword ? art.watchMatches?.find(m=>m.keyword===highlightKeyword) : null;
  const cardBg = isMgmt && isWeakCtx
    ? "linear-gradient(90deg,#fdf6e3 0%,#fff9f0 60%,transparent 100%)"
    : isStrong && art.signal==="SP2"
      ? "linear-gradient(90deg,#e6f4ec44 0%,transparent 100%)"
      : isStrong && art.signal==="SN2"
        ? "linear-gradient(90deg,#fdecea44 0%,transparent 100%)"
        : isHighlighted
          ? "linear-gradient(90deg,#c9a84c04 0%,transparent 100%)"
          : "transparent";
  const cardBorderLeft = isMgmt && isWeakCtx
    ? "3px solid #c9a84c"
    : isStrong
      ? `3px solid ${art.signal==="SP2"?"#1b7a3e":"#c0392b"}`
      : isHighlighted
        ? `2px solid ${directMatches.length?"#c0392b":"#4a9eff"}`
        : "2px solid transparent";

  return (
    <div style={{padding:"13px 0",borderBottom:"1px solid #e8e2d6",animation:"fadeIn 0.3s ease",
      background:cardBg,borderLeft:cardBorderLeft,
      paddingLeft:(isMgmt&&isWeakCtx)||isStrong||isHighlighted?10:0}}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:5}}>
        <span style={{fontSize:11,color:"#c0392b",fontFamily:"'DM Mono',monospace",fontWeight:600}}>
          {art.flag} {art.source}
        </span>
        {art.originalSourceId&&(()=>{
          const orig=SOURCES.find(s=>s.id===art.originalSourceId);
          if(!orig) return null;
          const label = "Originally from " + orig.name.split(" ").slice(0,2).join(" ");
          return art.originalSourceLink ? (
            <a href={art.originalSourceLink} target="_blank" rel="noopener noreferrer"
              style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#8a6a20",
                background:"#fdf6e3",padding:"1px 6px",borderRadius:3,
                border:"1px solid #e8d9a0",textDecoration:"none",cursor:"pointer"}}>
              ↗ {label}
            </a>
          ) : (
            <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#888",
              background:"#f5f0e8",padding:"1px 6px",borderRadius:3,border:"1px solid #e0d8cc"}}>
              {label}
            </span>
          );
        })()}
        {art.lang!=="en" && <Tag color="#7a8fa6">{art.lang.toUpperCase()}→EN</Tag>}
        {sec && sec.code!=="UNK" && <Tag color={sec.color}>{sec.icon} {sec.label}</Tag>}
        {sigMeta && art.signal !== "N" && (
          <span style={{display:"inline-flex",alignItems:"center",gap:3,
            fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,
            padding:"2px 7px",borderRadius:3,letterSpacing:"0.04em",
            color:sigMeta.color,background:sigMeta.bg,border:`1px solid ${sigMeta.border}`}}>
            {sigMeta.short} {catMeta?.label||art.signalCategory}
          </span>
        )}
        {isMgmt && isWeakCtx && (
          <span style={{display:"inline-flex",alignItems:"center",gap:3,
            fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,
            padding:"2px 7px",borderRadius:3,letterSpacing:"0.04em",
            color:"#7a5c00",background:"#fdf6e3",border:"1px solid #e8c94c"}}>
            ⚑ post-weakness
          </span>
        )}
        {directMatches.map(m=>(<Tag key={m.keyword} color="#c0392b">⦿ {m.keyword}</Tag>))}
        {relatedMatches.map(m=>(<Tag key={m.keyword} color="#4a9eff">◎ {m.keyword}</Tag>))}
        {art.pubDate&&(
          <span style={{fontSize:9,color:"#2a3a4a",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>
            {timeAgo(new Date(art.pubDate).getTime())}
          </span>
        )}
      </div>
      <a href={art.link} target="_blank" rel="noopener noreferrer"
        style={{color:"#1a1a1a",fontFamily:"'Spectral',Georgia,serif",
          fontSize:Math.round(14*fontScale),lineHeight:1.5,fontWeight:600,textDecoration:"none",
          display:"block",marginBottom:4,transition:"color 0.15s"}}
        onMouseOver={e=>e.target.style.color="#c0392b"}
        onMouseOut={e=>e.target.style.color="#1a1a1a"}>
        {displayTitle}
      </a>
      {focusMatch && (
        <div style={{fontSize:11,color:focusMatch.matchType==="direct"?"#c0392b":"#4a9eff",
          lineHeight:1.6,paddingLeft:0,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>
          {focusMatch.matchType==="direct"?"⦿ direct":"◎ related"} — {focusMatch.reason}
        </div>
      )}
      {art.insight&&(
        <div style={{fontSize:Math.round(12*fontScale),color:"#666",lineHeight:1.65,
          borderLeft:"2px solid #c9a84c33",paddingLeft:9,
          fontStyle:"italic",fontFamily:"'Spectral',Georgia,serif"}}>
          {art.insight}
        </div>
      )}
    </div>
  );
}
