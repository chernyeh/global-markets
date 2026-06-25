import { useState, useEffect } from "react";
import { SK, sGet, sSet } from "../storage.js";
import { callClaude } from "../api.js";
import { Dots, timeAgo } from "./helpers.jsx";
import ArticleCard from "./ArticleCard.jsx";
import BriefRenderer from "./BriefRenderer.jsx";

async function intelligentMatch(keyword, articles) {
  if (!articles.length) return [];
  const prompt=`You are an investment research analyst monitoring news for relevance to a specific subject.

Subject being tracked: "${keyword}"

Your job: For EACH headline below, decide if it is relevant to "${keyword}" — either DIRECTLY (mentions it) or INDIRECTLY (affects it, involves competitors/peers/suppliers/customers/regulators/macro factors that impact it).

Think broadly: if tracking "Samsung", flag news about TSMC, SK Hynix, Apple, Qualcomm, memory chip demand, Korean Won, Korean economy, semiconductor regulations, etc.

Return ONLY a JSON array. Include ONLY relevant articles (skip irrelevant ones):
[{"idx": <number>, "matchType": "direct"|"related", "reason": "brief explanation of why relevant (1 sentence)"}]

${articles.length} headlines:
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}, ${a.country}]`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 3000);
    const clean = text.replace(/```json|```/g,"").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch { return []; }
}

async function runWatchlistAnalysis(keywords, articles, onProgress) {
  let working = articles.map(a => ({ ...a, watchMatches: [] }));
  for (let ki = 0; ki < keywords.length; ki++) {
    const kw = keywords[ki].trim();
    if (!kw) continue;
    onProgress(`Analysing keyword ${ki+1}/${keywords.length}: "${kw}"…`);
    const BATCH = 50;
    for (let i = 0; i < working.length; i += BATCH) {
      const batch = working.slice(i, i + BATCH);
      const results = await intelligentMatch(kw, batch);
      results.forEach(r => {
        const art = batch[r.idx];
        if (!art) return;
        const globalIdx = working.findIndex(a => a.id === art.id);
        if (globalIdx === -1) return;
        const existing = working[globalIdx].watchMatches || [];
        if (!existing.find(m => m.keyword === kw)) {
          working[globalIdx] = {
            ...working[globalIdx],
            watchMatches: [...existing, { keyword: kw, matchType: r.matchType, reason: r.reason }]
          };
        }
      });
    }
  }
  return working;
}

async function generateKeywordBrief(keyword, articles) {
  if (!articles.length) return "";
  const direct = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="direct"));
  const related = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="related"));
  const prompt=`You are an investment analyst producing a comprehensive intelligence brief on: "${keyword}"

You have ${direct.length} direct mentions and ${related.length} related/indirect stories from global news sources.
Synthesise ALL of them into a complete picture:
(1) What is happening directly with ${keyword} right now — breaking news, earnings, corporate events
(2) The broader ecosystem: competitors, suppliers, customers, regulators, macro factors — what are they signalling
(3) Strategic depth: any in-depth business features, executive interviews, or long-form analysis that reveal business model changes, competitive dynamics, or strategic pivots affecting valuation — include these even if they carry no immediate price catalyst
(4) Expert views: fund manager, investment strategist, or analyst panel commentary on ${keyword} or its sector — what are experienced investors saying about direction, fundamentals, or valuation?
(5) Overall investment assessment: risks, opportunities, and what to watch

Name specific companies, figures, and events. Flowing prose, no bullets. Be thorough — cover everything, prioritising depth and context as much as breaking news.

DIRECT MENTIONS (${direct.length}):
${direct.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")||"(none)"}

RELATED/INDIRECT (${related.length}):
${related.map(a=>`• ${a.translatedTitle||a.title} [${a.source}] — ${a.watchMatches?.find(m=>m.keyword===keyword)?.reason||""}`).join("\n")||"(none)"}`;
  const text = await callClaude(prompt, 3000);
  return text;
}


// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST TAB
// ═══════════════════════════════════════════════════════════════════════════════
export default function WatchlistTab({allArticles, setAllArticles}) {
  const [keywords,     setKeywords]     = useState([]);
  const [inputVal,     setInputVal]     = useState("");
  const [analysing,    setAnalysing]    = useState(false);
  const [statusMsg,    setStatusMsg]    = useState("");
  const [activeKw,     setActiveKw]     = useState(null);
  const [kwBriefs,     setKwBriefs]     = useState({});
  const [kwBriefLoad,  setKwBriefLoad]  = useState({});
  const [lastAnalysed, setLastAnalysed] = useState(null);

  useEffect(()=>{
    sGet(SK.watchlist).then(kws=>{ if(kws) setKeywords(kws); });
    sGet(SK.watchHits).then(hits=>{
      if(!hits) return;
      setAllArticles(prev=>prev.map(a=>({...a, watchMatches: hits[a.id] || a.watchMatches || []})));
    });
  },[]);

  const canonical = allArticles.filter(a=>!a.duplicateOf);

  const addKeyword = () => {
    const kw = inputVal.trim();
    if (!kw || keywords.includes(kw)) { setInputVal(""); return; }
    const updated = [...keywords, kw];
    setKeywords(updated); sSet(SK.watchlist, updated); setInputVal("");
  };

  const removeKeyword = (kw) => {
    const updated = keywords.filter(k=>k!==kw);
    setKeywords(updated); sSet(SK.watchlist, updated);
    if (activeKw===kw) setActiveKw(null);
    setAllArticles(prev=>prev.map(a=>({...a, watchMatches:(a.watchMatches||[]).filter(m=>m.keyword!==kw)})));
  };

  const runAnalysis = async () => {
    if (!keywords.length) return;
    setAnalysing(true);
    const updated = await runWatchlistAnalysis(keywords, canonical, setStatusMsg);
    setAllArticles(prev=>{
      const result = prev.map(a=>{ const upd=updated.find(u=>u.id===a.id); return upd?{...a,watchMatches:upd.watchMatches}:a; });
      const hitMap = {};
      result.forEach(a=>{ if(a.watchMatches?.length) hitMap[a.id]=a.watchMatches; });
      sSet(SK.watchHits, hitMap);
      return result;
    });
    setLastAnalysed(Date.now()); setStatusMsg(""); setAnalysing(false);
    if (!activeKw && keywords.length) setActiveKw(keywords[0]);
  };

  const kwArticles = activeKw ? canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw)) : [];
  const directArts  = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="direct"));
  const relatedArts = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="related"));
  const kwCounts = {};
  keywords.forEach(kw=>{
    kwCounts[kw] = {
      direct:  canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="direct")).length,
      related: canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="related")).length,
    };
  });

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"20px 24px",marginBottom:20}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em",marginBottom:4}}>WATCHLIST TRACKER</div>
        <div style={{fontFamily:"'Spectral',serif",fontSize:15,color:"#1a1a1a",fontWeight:600,marginBottom:14}}>Intelligent Keyword Monitoring</div>
        <p style={{fontSize:12,color:"#4a6a8a",fontFamily:"'Spectral',Georgia,serif",lineHeight:1.7,margin:"0 0 16px"}}>
          Add companies, people, sectors, or themes to track. Claude will flag both direct mentions and related stories — competitors, suppliers, regulators, macro factors — giving you a complete picture around each subject.
        </p>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addKeyword()}
            placeholder="e.g. Samsung, Fed rate cut, TSMC, Reliance Industries…"
            style={{flex:1,background:"#fff",border:"1px solid #ddd",borderRadius:6,padding:"9px 14px",color:"#1a1a1a",fontFamily:"'Spectral',Georgia,serif",fontSize:13,outline:"none"}}/>
          <button onClick={addKeyword}
            style={{padding:"9px 18px",background:"#c0392b11",border:"1px solid #c0392b66",color:"#c0392b",borderRadius:6,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.15s"}}
            onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>+ add</button>
        </div>
        {keywords.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {keywords.map(kw=>(
              <div key={kw} onClick={()=>setActiveKw(kw)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:activeKw===kw?"#fdecea":"#fff",
                  border:`1px solid ${activeKw===kw?"#c0392b":"#ddd"}`,borderRadius:20,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:activeKw===kw?"#c0392b":"#333"}}>{kw}</span>
                {kwCounts[kw]&&(kwCounts[kw].direct||kwCounts[kw].related)>0&&(
                  <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#3a6080"}}>
                    <span style={{color:"#c0392b"}}>{kwCounts[kw].direct}</span>
                    {kwCounts[kw].related>0&&<span style={{color:"#2980b9"}}> +{kwCounts[kw].related}</span>}
                  </span>
                )}
                <span onClick={e=>{e.stopPropagation();removeKeyword(kw);}}
                  style={{fontSize:12,color:"#2a4050",cursor:"pointer",lineHeight:1,transition:"color 0.15s"}}
                  onMouseOver={e=>e.target.style.color="#f87171"} onMouseOut={e=>e.target.style.color="#2a4050"}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={runAnalysis} disabled={analysing||!keywords.length||!canonical.length}
            style={{padding:"9px 20px",background:(!keywords.length||!canonical.length)?"#f5f5f5":"#fdecea",
              border:"1px solid #bbb",color:"#333",borderRadius:6,cursor:(!keywords.length||!canonical.length)?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",opacity:(!keywords.length||!canonical.length)?0.4:1}}
            onMouseOver={e=>{if(!analysing)e.currentTarget.style.background="#c9a84c22"}}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            {analysing?<><Dots/> {statusMsg}</>:`⟳ run analysis (${canonical.length} articles × ${keywords.length} keywords)`}
          </button>
          {lastAnalysed&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>last run {timeAgo(lastAnalysed)}</span>}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
            <span style={{color:"#c0392b"}}>⦿ direct mention</span>
            <span style={{color:"#2980b9"}}>◎ related / indirect</span>
          </div>
        </div>
      </div>

      {activeKw && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"18px 22px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:kwBriefs[activeKw]?12:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>INTELLIGENCE BRIEF · {kwArticles.length} relevant articles</div>
                <div style={{fontFamily:"'Spectral',serif",fontSize:15,color:"#1a1a1a",fontWeight:600}}>"{activeKw}" — Full Picture</div>
              </div>
              <button onClick={async()=>{
                  setKwBriefLoad(p=>({...p,[activeKw]:true}));
                  const b=await generateKeywordBrief(activeKw,kwArticles);
                  setKwBriefs(p=>({...p,[activeKw]:b}));
                  setKwBriefLoad(p=>({...p,[activeKw]:false}));
                }}
                disabled={kwBriefLoad[activeKw]||!kwArticles.length}
                style={{background:"none",border:"1px solid #bbb",color:"#333",padding:"6px 14px",borderRadius:5,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",opacity:!kwArticles.length?0.4:1}}
                onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
                onMouseOut={e=>e.currentTarget.style.background="none"}>
                {kwBriefLoad[activeKw]?<><Dots/> generating…</>:kwBriefs[activeKw]?"↺ refresh brief":"✦ generate intelligence brief"}
              </button>
            </div>
            {kwBriefs[activeKw]&&<BriefRenderer text={kwBriefs[activeKw]} articles={kwArticles}/>}
          </div>
          {kwArticles.length===0 ? (
            <div style={{textAlign:"center",padding:"40px",fontFamily:"'DM Mono',monospace",color:"#1e2a38",fontSize:12}}>No matches yet — run analysis first</div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span>⦿ DIRECT MENTIONS</span>
                  <span style={{background:"#c0392b18",color:"#c0392b",padding:"1px 7px",borderRadius:10,fontSize:9}}>{directArts.length}</span>
                </div>
                {directArts.length===0?<div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",padding:"20px 0"}}>No direct mentions found</div>
                  :directArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)}
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2980b9",fontWeight:600,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span>◎ RELATED / INDIRECT</span>
                  <span style={{background:"#4a9eff22",color:"#2980b9",padding:"1px 7px",borderRadius:10,fontSize:9}}>{relatedArts.length}</span>
                </div>
                {relatedArts.length===0?<div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",padding:"20px 0"}}>No related stories found</div>
                  :relatedArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)}
              </div>
            </div>
          )}
        </div>
      )}
      {!activeKw && keywords.length>0 && <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",color:"#2a4050",fontSize:12}}>Select a keyword above to view its matches, or run analysis first</div>}
      {keywords.length===0&&<div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",color:"#1e2a38",fontSize:12}}>Add keywords above to start tracking</div>}
    </div>
  );
}
