import { useState } from "react";
import { mono } from "../ui.jsx";
import { SK, sSet } from "../storage.js";
import { NEWS_BRIEF_GROUPS, SOURCES } from "../data/sources.js";
import { Dots, WindowSelector, withinWindow } from "./helpers.jsx";
import ArticleCard from "./ArticleCard.jsx";
import BriefRenderer from "./BriefRenderer.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS BRIEFS TAB
// ═══════════════════════════════════════════════════════════════════════════════
// Maps a generation failure to a short, human-readable message for the UI.
function humanizeBriefError(e) {
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

// Cap the master brief so the all-articles synthesis stays fast and within the
// upstream time budget (the serverless function is capped at 60s on Vercel
// Hobby). Articles are already ordered by recency/priority, so the top slice
// keeps the strongest signals. Kept low so the synthesis finishes in time.
const MASTER_CAP = 70;

export default function NewsBriefsTab({canonical, briefs, setBriefs, generateBrief, briefLoading, setBriefLoading, briefError, setBriefError}) {
  // How far back (in hours) briefings and article lists reach. 0 = all articles.
  const [windowHours, setWindowHours] = useState(12);

  // Article pool scoped to the selected time window.
  const windowed = canonical.filter(a => withinWindow(a, windowHours));

  // Compute articles for each market group
  const groupArts = (group) =>
    windowed.filter(a => group.sources.includes(a.sourceId) || group.sources.includes(a.originalSourceId));

  // Master brief spans ALL markets (developed + emerging). generateBriefUnlimited
  // ranks by signal and keeps the top company-relevant stories, so feeding the full
  // deduplicated pool surfaces the strongest company news across every market.
  const allBriefArts = windowed;
  const masterBriefKey = "newsbriefs_master";

  const generateGroupBrief = async (group) => {
    const key = `newsbriefs_${group.market}`;
    const arts = groupArts(group);
    if (!arts.length) return;
    setBriefError(p=>({...p,[key]:null}));
    setBriefLoading(p=>({...p,[key]:true}));
    try {
      const b = await generateBrief(arts, `${group.flag} ${group.market} Company News`);
      if (!b.text) setBriefError(p=>({...p,[key]:"No briefing returned. Retry."}));
      else setBriefs(p=>{const n={...p,[key]:b};sSet(SK.summaries,n);return n;});
    } catch (e) {
      setBriefError(p=>({...p,[key]:humanizeBriefError(e)}));
    } finally {
      setBriefLoading(p=>({...p,[key]:false}));
    }
  };

  const generateMasterBrief = async () => {
    if (!allBriefArts.length) return;
    setBriefError(p=>({...p,[masterBriefKey]:null}));
    setBriefLoading(p=>({...p,[masterBriefKey]:true}));
    try {
      const masterPriority = "COVERAGE PRIORITY: When two items are equally actionable, prefer US, Canada, Germany, pan-European, Singapore, Hong Kong/China, Korea, Taiwan, Israel, Latin America, and Australia. Give less weight to other markets, and mention Philippines, Nigeria, Malaysia, and Indian stories only briefly unless they carry clear global or sector impact.";
      const b = await generateBrief(allBriefArts, "Global Company News Briefs", masterPriority, MASTER_CAP, true);
      if (!b.text) setBriefError(p=>({...p,[masterBriefKey]:"No briefing returned. Retry."}));
      else setBriefs(p=>{const n={...p,[masterBriefKey]:b};sSet(SK.summaries,n);return n;});
    } catch (e) {
      setBriefError(p=>({...p,[masterBriefKey]:humanizeBriefError(e)}));
    } finally {
      setBriefLoading(p=>({...p,[masterBriefKey]:false}));
    }
  };

  const masterBriefData = briefs[masterBriefKey];
  const masterBrief = masterBriefData?.text ?? (typeof masterBriefData==="string" ? masterBriefData : null);

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Master brief card */}
      <div style={{background:"#fff",border:"1px solid #e8e2d6",borderRadius:10,padding:"16px 18px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:masterBrief?10:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>📰</span>
            <div>
              <div style={{...mono,fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>GLOBAL NEWS BRIEFS · {allBriefArts.length>MASTER_CAP ? `top ${MASTER_CAP} by signal of ${allBriefArts.length}` : `${allBriefArts.length}`} articles{windowHours>0?` · last ${windowHours}h`:""}{masterBriefData?.generatedAt ? ` · generated ${new Date(masterBriefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
              <div style={{fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Company News Intelligence</div>
            </div>
            <WindowSelector value={windowHours} onChange={setWindowHours} color="#c0392b" />
          </div>
          <button onClick={generateMasterBrief} disabled={briefLoading[masterBriefKey]||!allBriefArts.length}
            style={{...mono,fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",
              cursor:briefLoading[masterBriefKey]||!allBriefArts.length?"not-allowed":"pointer",opacity:!allBriefArts.length?0.4:1}}
            onMouseOver={e=>{ if(!briefLoading[masterBriefKey]) e.currentTarget.style.background="#fdecea"; }}
            onMouseOut={e=>e.currentTarget.style.background="none"}>
            {briefLoading[masterBriefKey]?<Dots color="#c0392b"/>:"✦ brief all"}
          </button>
        </div>
        {masterBrief&&<div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}><BriefRenderer text={masterBrief} articles={masterBriefData?.articles||allBriefArts}/></div>}
        {briefError[masterBriefKey]&&!briefLoading[masterBriefKey]&&<div style={{...mono,fontSize:10,color:"#c0392b",marginTop:8}}>⚠ {briefError[masterBriefKey]}</div>}
      </div>

      {/* Per-market group columns — sectioned by type */}
      {[
        { heading:"ANALYST ACTIONS",  color:"#7b1fa2", markets:["Broker Calls & Analyst Actions","Asia Broker Calls & Analyst Actions"] },
        { heading:"IDEAS",            color:"#1565c0", markets:["Ideas & Commentary"] },
        { heading:"REGIONAL MARKETS", color:"#c0392b", markets:["United States","Canada","United Kingdom","Singapore","Australia","Hong Kong / China","Japan","Korea / Taiwan"] },
        { heading:"GLOBAL",           color:"#1a1a1a", markets:["🌐 Global Overview"] },
      ].map(section => {
        const sectionGroups = section.markets.map(m => NEWS_BRIEF_GROUPS.find(g => g.market === m)).filter(Boolean);
        if (!sectionGroups.length) return null;
        return (
          <div key={section.heading} style={{marginBottom:28}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:section.color,letterSpacing:"0.12em",fontWeight:700,marginBottom:12,paddingBottom:6,borderBottom:`2px solid ${section.color}22`}}>
              {section.heading}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
              {sectionGroups.map(group => {
                const arts = groupArts(group);
                const key = `newsbriefs_${group.market}`;
          const briefData = briefs[key];
          const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);

          // Group articles by source
          const bySource = {};
          arts.forEach(a => {
            const sid = a.sourceId;
            if (!bySource[sid]) bySource[sid] = { source: SOURCES.find(s=>s.id===sid), arts: [] };
            bySource[sid].arts.push(a);
          });

          // Signal summary counts
          const signalCounts = { SP2:0, SP1:0, SN1:0, SN2:0 };
          arts.forEach(a => { if (a.signal && a.signal !== "N") signalCounts[a.signal]++; });
          const hasSignals = Object.values(signalCounts).some(v=>v>0);

          return (
            <div key={group.market} style={{background:"#fff",border:`1px solid ${group.color}22`,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${group.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{...mono,fontSize:9,color:group.color,letterSpacing:"0.08em",fontWeight:600}}>{group.flag} {group.market.toUpperCase()} · {arts.length} articles{briefData?.generatedAt ? ` · generated ${new Date(briefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                  <div style={{...mono,fontSize:8,color:"#aaa",marginTop:2}}>{group.desc}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {hasSignals && (
                    <div style={{display:"flex",gap:3}}>
                      {signalCounts.SP2>0&&<span style={{...mono,fontSize:8,background:"#1b7a3e",color:"#fff",padding:"1px 5px",borderRadius:2}}>▲▲{signalCounts.SP2}</span>}
                      {signalCounts.SP1>0&&<span style={{...mono,fontSize:8,background:"#e6f4ec",color:"#1b7a3e",padding:"1px 5px",borderRadius:2}}>▲{signalCounts.SP1}</span>}
                      {signalCounts.SN1>0&&<span style={{...mono,fontSize:8,background:"#fff3ee",color:"#b84a00",padding:"1px 5px",borderRadius:2}}>▽{signalCounts.SN1}</span>}
                      {signalCounts.SN2>0&&<span style={{...mono,fontSize:8,background:"#c0392b",color:"#fff",padding:"1px 5px",borderRadius:2}}>▽▽{signalCounts.SN2}</span>}
                    </div>
                  )}
                  <button onClick={()=>generateGroupBrief(group)} disabled={briefLoading[key]||!arts.length}
                    style={{...mono,fontSize:8,padding:"3px 8px",border:`1px solid ${group.color}44`,borderRadius:3,background:"none",color:group.color,cursor:briefLoading[key]||!arts.length?"not-allowed":"pointer",opacity:!arts.length?0.4:1}}
                    onMouseOver={e=>e.currentTarget.style.background=`${group.color}11`}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[key]?<Dots color={group.color}/>:"✦ brief"}
                  </button>
                </div>
              </div>

              {brief && <div style={{borderBottom:"1px solid #e8e2d6",paddingBottom:10,marginBottom:10}}><BriefRenderer text={brief} articles={briefData?.articles||arts}/></div>}
              {briefError[key]&&!briefLoading[key]&&<div style={{...mono,fontSize:9,color:group.color,marginBottom:8}}>⚠ {briefError[key]}</div>}

              {arts.length===0 ? (
                <div style={{...mono,fontSize:10,color:"#bbb",padding:"16px 0",textAlign:"center"}}>no articles — refresh feeds</div>
              ) : (
                Object.entries(bySource).map(([sid, {source: src, arts: srcArts}]) => (
                  <div key={sid} style={{marginBottom:8}}>
                    <div style={{...mono,fontSize:9,color:"#c0392b",fontWeight:600,padding:"4px 0",borderBottom:"1px solid #f0ece4",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{src?.flag} {src?.name || sid}</span>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        {src?.paywall && <span style={{fontSize:7,color:"#aaa"}}>🔒</span>}
                        <span style={{color:"#bbb",fontSize:8}}>{srcArts.length}</span>
                      </div>
                    </div>
                    {srcArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                  </div>
                ))
              )}
            </div>
          );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
