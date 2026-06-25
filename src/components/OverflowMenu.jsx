import { useState, useEffect, useRef } from "react";
import { mono } from "../ui.jsx";
import { SK, EM_SK, sSet } from "../storage.js";
import { FONT_SCALES } from "../context.js";

export default function OverflowMenu({allArticles, enrichedCount, dupeCount, showDupes, setShowDupes,
                     isLoading, enriching, runEnrichment, setAllArticles,
                     setBriefs, setLastFetch, setStatusMsg,
                     fontScale, setFontScale}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const unenriched = allArticles.filter(a => !a.insight).length;

  const item = (label, onClick, color="#333", disabled=false) => (
    <button onClick={() => { if (!disabled) { onClick(); setOpen(false); } }}
      disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 16px",
        background:"none",border:"none",color:disabled?"#ccc":color,
        cursor:disabled?"not-allowed":"pointer",...mono,fontSize:11,
        textAlign:"left",whiteSpace:"nowrap",opacity:disabled?0.5:1}}
      onMouseOver={e=>{ if(!disabled) e.currentTarget.style.background="#f5f5f5"; }}
      onMouseOut={e=>e.currentTarget.style.background="none"}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button onClick={() => setOpen(p => !p)}
        style={{padding:"5px 10px",border:"1px solid #ccc",borderRadius:5,
          background:open?"#f0f0f0":"none",color:"#555",cursor:"pointer",
          ...mono,fontSize:14,lineHeight:1,letterSpacing:"0.1em"}}>
        ···
      </button>

      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",
          background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:300,minWidth:230,overflow:"hidden"}}>

          {/* Text size */}
          <div style={{padding:"8px 14px 8px",borderBottom:"1px solid #f0ece4"}}>
            <div style={{...mono,fontSize:9,color:"#aaa",letterSpacing:"0.1em",marginBottom:6}}>TEXT SIZE</div>
            <div style={{display:"flex",gap:4}}>
              {FONT_SCALES.map(({id,label,scale})=>(
                <button key={id} onClick={()=>{setFontScale(scale);sSet(SK.fontScale,scale);}}
                  style={{...mono,fontSize:id==="compact"?9:id==="normal"?11:14,padding:"4px 0",flex:1,
                    border:`1px solid ${fontScale===scale?"#c0392b":"#ddd"}`,borderRadius:4,
                    background:fontScale===scale?"#fdecea":"#fafafa",
                    color:fontScale===scale?"#c0392b":"#888",cursor:"pointer",transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{padding:"8px 16px",borderBottom:"1px solid #f0ece4",...mono,fontSize:9,color:"#888",display:"flex",gap:14}}>
            <span style={{color:"#2a4a6a"}}>{allArticles.length} fetched</span>
            <span style={{color:"#1a3a2a"}}>−{dupeCount} dupes</span>
            <span style={{color:"#2a3a1a"}}>{enrichedCount} enriched</span>
          </div>

          {item(
            <><span style={{animation:enriching?"spin 1s linear infinite":"none",display:"inline-block"}}>✦</span> {enriching ? "Enriching…" : `Enrich headlines (${unenriched})`}</>,
            () => { if (unenriched) runEnrichment(allArticles, allArticles.filter(a=>!a.insight)); },
            "#7b68ee",
            isLoading || enriching || unenriched === 0
          )}

          {item(
            showDupes ? "∙ Hide duplicates" : "∙ Show duplicates",
            () => setShowDupes(p => !p)
          )}

          <div style={{borderTop:"1px solid #f0ece4"}}/>

          {item(
            <>✕ Clear cache</>,
            () => {
              if (!window.confirm("Clear all cached headlines and summaries? The app will re-fetch everything from scratch.")) return;
              Object.values(SK).forEach(k => localStorage.removeItem(k));
              Object.values(EM_SK).forEach(k => localStorage.removeItem(k));
              setAllArticles([]); setBriefs({}); setLastFetch({});
              setStatusMsg("Cache cleared — reloading…");
              setTimeout(() => window.location.reload(), 800);
            },
            "#c0392b"
          )}
        </div>
      )}
    </div>
  );
}
