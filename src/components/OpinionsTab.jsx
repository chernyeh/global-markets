import { useState } from "react";
import { mono } from "../ui.jsx";
import { SK, sSet } from "../storage.js";
import { SOURCES } from "../data/sources.js";
import { OPINION_CATEGORIES, OPINION_MAP } from "../data/taxonomy.js";
import { resolveOpinion, findFreeAlternative, generateOpinionDigest } from "../opinions.js";
import { Dots } from "./helpers.jsx";
import ArticleCard from "./ArticleCard.jsx";
import BriefRenderer from "./BriefRenderer.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// OPINIONS TAB — opinion pieces by category, free-coverage for paywalled items,
// and a "who is saying what" digest.
// ═══════════════════════════════════════════════════════════════════════════════
export default function OpinionsTab({canonical, briefs, setBriefs, setAllArticles}) {
  const [briefLoading, setBriefLoading] = useState({});
  const [findingFree, setFindingFree] = useState({});
  const [activeCat, setActiveCat] = useState("ALL");

  const isPaywalled = a =>
    !!(SOURCES.find(s=>s.id===a.sourceId)?.paywall || SOURCES.find(s=>s.id===a.originalSourceId)?.paywall);

  // Opinion pieces with their resolved category attached
  const opinionArts = canonical
    .map(a => { const r = resolveOpinion(a); return { ...a, _opCat: r.category, _op: r.isOpinion }; })
    .filter(a => a._op);

  const catCounts = {};
  opinionArts.forEach(a => { catCounts[a._opCat] = (catCounts[a._opCat]||0) + 1; });

  const viewArts = activeCat==="ALL" ? opinionArts : opinionArts.filter(a => a._opCat===activeCat);

  const activeLabel = activeCat==="ALL" ? "All Opinion Pieces" : (OPINION_MAP[activeCat]?.label || activeCat);
  const activeKey = activeCat==="ALL" ? "opinions_master" : `opinions_${activeCat}`;
  const activeData = briefs[activeKey];
  const activeBrief = activeData?.text ?? (typeof activeData==="string" ? activeData : null);

  const runDigest = async (arts, key, label) => {
    if (!arts.length) return;
    setBriefLoading(p=>({...p,[key]:true}));
    try {
      const b = await generateOpinionDigest(arts, label);
      if (b.text) setBriefs(p=>{const n={...p,[key]:b};sSet(SK.summaries,n);return n;});
    } finally {
      setBriefLoading(p=>({...p,[key]:false}));
    }
  };

  const handleFindFree = async (art) => {
    setFindingFree(p=>({...p,[art.id]:true}));
    try {
      const alt = await findFreeAlternative(art, canonical);
      setAllArticles(prev => {
        const updated = prev.map(a => a.id===art.id ? {...a, freeAlt:alt, freeAltChecked:true} : a);
        sSet(SK.articles, updated);
        return updated;
      });
    } finally {
      setFindingFree(p=>({...p,[art.id]:false}));
    }
  };

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Digest card — "who is saying what" */}
      <div style={{background:"#fff",border:"1px solid #e8e2d6",borderLeft:"3px solid #8e44ad",borderRadius:10,padding:"16px 18px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:activeBrief?10:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>💬</span>
            <div>
              <div style={{...mono,fontSize:9,color:"#8e44ad",letterSpacing:"0.1em",fontWeight:600}}>
                OPINION ROUND-UP · WHO IS SAYING WHAT · {viewArts.length} pieces{activeData?.generatedAt ? ` · generated ${new Date(activeData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}
              </div>
              <div style={{fontFamily:"'Spectral',serif",fontSize:15,color:"#1a1a1a",fontWeight:700}}>{activeLabel}</div>
            </div>
          </div>
          <button onClick={()=>runDigest(viewArts, activeKey, activeLabel)} disabled={briefLoading[activeKey]||!viewArts.length}
            style={{...mono,fontSize:10,padding:"5px 13px",border:"1px solid #8e44ad55",borderRadius:5,background:"none",color:"#8e44ad",
              cursor:briefLoading[activeKey]||!viewArts.length?"not-allowed":"pointer",opacity:!viewArts.length?0.4:1}}
            onMouseOver={e=>{ if(!briefLoading[activeKey]) e.currentTarget.style.background="#f5eefa"; }}
            onMouseOut={e=>e.currentTarget.style.background="none"}>
            {briefLoading[activeKey]?<><Dots color="#8e44ad"/> summarizing…</>:activeBrief?"↺ refresh":"✦ summarize opinions"}
          </button>
        </div>
        {activeBrief && <div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}><BriefRenderer text={activeBrief} articles={activeData?.articles||viewArts}/></div>}
      </div>

      {/* Category filter chips */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:18}}>
        {[{code:"ALL",label:"All",icon:"▤",color:"#8e44ad"},...OPINION_CATEGORIES].map(c=>{
          const cnt = c.code==="ALL" ? opinionArts.length : (catCounts[c.code]||0);
          if (c.code!=="ALL" && !cnt) return null;
          const active = activeCat===c.code;
          const col = c.color;
          return (
            <button key={c.code} onClick={()=>setActiveCat(c.code)}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:6,
                border:active?`1px solid ${col}`:`1px solid ${col}33`,background:active?`${col}18`:`${col}0a`,
                color:col,cursor:"pointer",...mono,fontSize:11,fontWeight:active?600:400}}>
              {c.icon} {c.label}
              {cnt>0 && <span style={{fontSize:8,background:active?"#fff":`${col}18`,padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Opinion list, grouped by category */}
      {viewArts.length===0 ? (
        <div style={{textAlign:"center",padding:"70px 0",...mono,color:"#1a2a38",fontSize:13}}>
          no opinion pieces yet — hit refresh, then Enrich headlines
        </div>
      ) : (
        (activeCat==="ALL" ? OPINION_CATEGORIES.map(c=>c.code) : [activeCat]).map(catCode => {
          const catArts = viewArts.filter(a => a._opCat===catCode);
          if (!catArts.length) return null;
          const cat = OPINION_MAP[catCode];
          return (
            <div key={catCode} style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                borderBottom:`2px solid ${cat.color}`,paddingBottom:6,marginBottom:8}}>
                <span style={{...mono,fontSize:12,color:cat.color,fontWeight:600,letterSpacing:"0.05em"}}>
                  {cat.icon} {cat.label.toUpperCase()} · {catArts.length}
                </span>
                <button onClick={()=>runDigest(catArts, `opinions_${catCode}`, cat.label)} disabled={briefLoading[`opinions_${catCode}`]}
                  style={{...mono,fontSize:9,padding:"3px 9px",border:`1px solid ${cat.color}44`,borderRadius:3,background:"none",color:cat.color,
                    cursor:briefLoading[`opinions_${catCode}`]?"wait":"pointer"}}
                  onMouseOver={e=>e.currentTarget.style.background=`${cat.color}11`}
                  onMouseOut={e=>e.currentTarget.style.background="none"}>
                  {briefLoading[`opinions_${catCode}`]?<Dots color={cat.color}/>:"✦ brief"}
                </button>
              </div>
              <div style={{maxWidth:900}}>
                {catArts.map((art,i)=>(
                  <ArticleCard key={art.id||i} art={art}
                    freeCoverage={isPaywalled(art)}
                    findingFree={!!findingFree[art.id]}
                    onFindFree={()=>handleFindFree(art)}/>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
