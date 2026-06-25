import { SK, sSet } from "../storage.js";
import { Dots } from "./helpers.jsx";
import BriefRenderer from "./BriefRenderer.jsx";

export default function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading, generateBrief}) {
  const briefData=briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);
  const briefArts = briefData?.articles ?? articles;
  const generatedAt = briefData?.generatedAt ?? null;
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    try {
      const b=await generateBrief(articles,label,null,150);
      if(b.text) setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
    } catch(e) {
      console.warn("brief generation failed:",e);
    } finally {
      setLoading(p=>({...p,[briefKey]:false}));
    }
  };
  const formatTime = (ms) => {
    try {
      return new Date(ms).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    } catch { return ""; }
  };
  return (
    <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
      padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>
              AI INVESTMENT BRIEF · {articles.length} articles analysed{generatedAt ? ` · generated ${formatTime(generatedAt)}` : ""}
            </div>
            <div style={{fontFamily:"'Spectral',serif",fontSize:15,color:"#1a1a1a",fontWeight:700}}>
              {label}
            </div>
          </div>
        </div>
        <button onClick={run} disabled={isLoading}
          style={{background:"none",border:"1px solid #bbb",color:"#333",
            padding:"6px 14px",borderRadius:5,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background="none"}>
          {isLoading?<><Dots/> generating…</>:brief?"↺ refresh":"✦ generate brief"}
        </button>
      </div>
      {brief && <BriefRenderer text={brief} articles={briefArts}/>}
    </div>
  );
}
