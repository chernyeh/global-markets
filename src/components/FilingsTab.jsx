import { useState, useEffect } from "react";
import { mono } from "../ui.jsx";
import { callClaude } from "../api.js";
import { classifyMicro } from "../utils.js";

const FILING_EXCHANGES = [
  { code:"US",  label:"SEC (US)",      flag:"🇺🇸", desc:"8-K / 10-Q / 10-K from SEC EDGAR — free public API, real-time" },
];

const SEC_FORM_TYPES = [
  { id:"8-K",    label:"8-K",   desc:"Material events — earnings, M&A, CEO changes, guidance" },
  { id:"10-Q",   label:"10-Q",  desc:"Quarterly financial statements" },
  { id:"10-K",   label:"10-K",  desc:"Annual reports" },
  { id:"SC 13D", label:"13D",   desc:">5% ownership stake disclosures" },
  { id:"DEF 14A",label:"Proxy", desc:"Shareholder votes, executive compensation" },
];

async function fetchSecFilings(formType, count=100) {
  try {
    const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=${count}&search_text=&output=atom`;
    const res = await fetch(`/api/rss?url=${encodeURIComponent(edgarUrl)}`);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML parse error");
    return [...doc.querySelectorAll("entry")].map(e => {
      const rawTitle   = e.querySelector("title")?.textContent?.trim() || "";
      const summary    = e.querySelector("summary")?.textContent || "";
      const updated    = e.querySelector("updated")?.textContent || "";
      const linkEl     = e.querySelector("link");
      const link       = linkEl?.getAttribute("href") || linkEl?.textContent?.trim() || "";
      const idEl       = e.querySelector("id")?.textContent || "";
      const titleParts = rawTitle.match(/^([^\-]+)\s*-\s*(.+?)\s*\(\d+\)/);
      const ftype      = titleParts ? titleParts[1].trim() : formType;
      const company    = titleParts ? titleParts[2].trim() : rawTitle;
      const filedMatch = summary.match(/Filed:<\/b>\s*([\d-]+)/);
      const filed      = filedMatch ? filedMatch[1] : updated.slice(0, 10);
      const accMatch   = (idEl + summary).match(/(\d{10}-\d{2}-\d{6})/);
      const accNum     = accMatch ? accMatch[1] : "";
      const id = accNum || (company + filed + ftype).replace(/\s/g, "").slice(0, 30);
      return { id, title: rawTitle, company, formType: ftype, filed, link, exchange: "US" };
    }).filter(f => f.company || f.title);
  } catch(e) {
    console.warn("SEC EDGAR fetch error:", e.message);
    return [];
  }
}

async function fetchAllSecFilings() {
  const results = await Promise.all(SEC_FORM_TYPES.map(ft => fetchSecFilings(ft.id, 40)));
  const seen = new Set();
  const all = results.flat().filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
  return all.sort((a, b) => (new Date(b.filed||0)) - (new Date(a.filed||0)));
}

async function generateGlobalFilingsBrief(filingsByExchange, secForm) {
  const usFilings = (filingsByExchange["US"] || []).slice(0, 30);
  const lines = usFilings.map((f, i) => {
    const date = f.filed
      ? (() => { try { return new Date(f.filed).toLocaleDateString("en-SG",{day:"numeric",month:"short"}); } catch(e){ return ""; } })()
      : "";
    return `${i+1}. [${f.formType}] ${f.company||f.title}${date?` (${date})`:""}${f.title!==f.company&&f.company?` — ${f.title}`:""}`;
  }).join("\n");
  const sectionsTruncated = (`🇺🇸 United States · SEC EDGAR · ${secForm}:\n${lines}`).slice(0, 5000);

  const prompt = `You are a buy-side analyst. Based on the following SEC regulatory filings from the last 48 hours, write an investment briefing.

${sectionsTruncated}

FORMAT:

## SEC Filings Brief — [headline summarising main themes]

[2-3 sentence executive summary of the most important filings]

## Key Corporate Events
- [most material filing: company name, what happened, investment implication]
- [next — be specific: earnings beat/miss by how much, M&A deal size, CEO name change, etc.]

## Sector Themes
- [Cross-company patterns: multiple companies in same sector, directional earnings trend, M&A wave]

## Watch List
- [High priority items to monitor — follow-up catalysts, risk events]

Rules:
- Name EVERY company, include ticker where inferable
- Quantify: deal sizes, EPS beat/miss, % changes
- Earnings, M&A, dividend changes, CEO changes = highest priority
- Each bullet 1-2 sentences, specific and actionable`;

  try {
    return await callClaude(prompt, 2000);
  } catch(e) {
    console.warn("Global filing brief error:", e.message);
    return `Error generating briefing: ${e.message}`;
  }
}

export default function FilingsTab() {
  const [secForm,      setSecForm]      = useState("8-K");
  const [filings,      setFilings]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [brief,        setBrief]        = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setFilings([]);
    setBrief("");
    if (secForm === "ALL") {
      const all = [];
      const seen = new Set();
      for (const ft of SEC_FORM_TYPES) {
        const results = await fetchSecFilings(ft.id, 40);
        results.forEach(f => { if (!seen.has(f.id)) { seen.add(f.id); all.push(f); } });
        await new Promise(r => setTimeout(r, 200));
      }
      setFilings(all.sort((a,b)=>(new Date(b.filed||0))-(new Date(a.filed||0))));
    } else {
      setFilings(await fetchSecFilings(secForm, 100));
    }
    setLoading(false);
  };

  const generateBrief = async () => {
    if (!filtered.length) return;
    setBriefLoading(true);
    setBrief("");
    const byEx = { US: filtered };
    const text = await generateGlobalFilingsBrief(byEx, secForm === "ALL" ? "All Form Types" : secForm);
    setBrief(text);
    setBriefLoading(false);
  };

  useEffect(() => { load(); }, [secForm]);

  const filtered = filings.filter(f =>
    !searchFilter ||
    f.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (f.company || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  const renderBrief = (text) => {
    if (!text) return null;
    const rawLines = text.split("\n");
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      const t = rawLines[i].trim();
      if (t === "---" || t === "***" || t === "___") continue;
      if (/^\*\*[^*]+\*\*:?$/.test(t) && !t.startsWith("- ")) {
        let j = i + 1;
        while (j < rawLines.length && !rawLines[j].trim()) j++;
        const next = rawLines[j]?.trim() || "";
        if (next && !next.startsWith("#") && !next.startsWith("- ") && !next.startsWith("**")) {
          lines.push(t + "\n" + next); i = j; continue;
        }
      }
      lines.push(rawLines[i]);
    }
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{height:5}}/>;
      if (trimmed.startsWith("### ")) return (
        <div key={i} style={{...mono,fontSize:12,fontWeight:600,color:"#1a1a1a",
          marginTop:i===0?0:18,marginBottom:5,borderBottom:"1px solid #e8e2d6",paddingBottom:5}}>
          {trimmed.replace("### ","")}
        </div>
      );
      if (trimmed.startsWith("## ")) return (
        <div key={i} style={{fontFamily:"'Spectral',serif",fontSize:15,fontWeight:700,
          color:"#1a1a1a",marginTop:i===0?0:20,marginBottom:7}}>
          {trimmed.replace("## ","")}
        </div>
      );
      if (trimmed.startsWith("- ")) return (
        <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:13,lineHeight:1.6,paddingLeft:4}}>
          <span style={{color:"#c0392b",flexShrink:0,marginTop:3}}>•</span>
          <span>{trimmed.replace("- ","").replace(/\*\*([^*]+)\*\*/g,(_,t)=>t)}</span>
        </div>
      );
      const mergedMatch = trimmed.match(/^\*\*([^*]+)\*\*:?\n([\s\S]+)$/);
      return (
        <p key={i} style={{fontSize:13,lineHeight:1.65,marginBottom:8,color:"#333"}}>
          {mergedMatch
            ? <><strong>{mergedMatch[1]}</strong>{": "}{mergedMatch[2]}</>
            : trimmed.replace(/\*\*([^*]+)\*\*/g, (_,t) => t)
          }
        </p>
      );
    });
  };

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{...mono,fontSize:10,color:"#888"}}>Form type:</span>
          <button onClick={()=>setSecForm("ALL")}
            style={{...mono,fontSize:10,padding:"3px 9px",borderRadius:4,cursor:"pointer",
              border: secForm==="ALL" ? "2px solid #1a1a1a" : "1px solid #ddd",
              background: secForm==="ALL" ? "#1a1a1a" : "#fff",
              color: secForm==="ALL" ? "#fff" : "#555"}}>All</button>
          {SEC_FORM_TYPES.map(ft => (
            <button key={ft.id} onClick={()=>setSecForm(ft.id)} title={ft.desc}
              style={{...mono,fontSize:10,padding:"3px 9px",borderRadius:4,cursor:"pointer",
                border: secForm===ft.id ? "2px solid #1a1a1a" : "1px solid #ddd",
                background: secForm===ft.id ? "#1a1a1a" : "#fff",
                color: secForm===ft.id ? "#fff" : "#555"}}>
              {ft.id}
            </button>
          ))}
        </div>
        <input value={searchFilter} onChange={e=>setSearchFilter(e.target.value)}
          placeholder="Filter by company or keyword…"
          style={{...mono,fontSize:11,padding:"4px 10px",border:"1px solid #ccc",
            borderRadius:4,background:"#fff",flex:1,minWidth:180}} />
        <button onClick={load} disabled={loading}
          style={{...mono,fontSize:11,padding:"4px 10px",borderRadius:4,
            border:"1px solid #888",background:"#fff",cursor:"pointer",opacity:loading?0.5:1}}>
          ↺ Refresh
        </button>
        <button onClick={generateBrief} disabled={briefLoading||loading||filtered.length===0}
          style={{...mono,fontSize:11,padding:"5px 14px",borderRadius:4,cursor:"pointer",
            border:"2px solid #c0392b",
            background: brief ? "#fff5f5" : "#c0392b",
            color: brief ? "#c0392b" : "#fff",fontWeight:600,
            opacity:(briefLoading||loading||filtered.length===0)?0.45:1}}>
          {briefLoading ? "⊕ Generating briefing…" : brief ? "↺ Regenerate briefing" : `⊕ Generate briefing (all forms)`}
        </button>
      </div>
      <div style={{...mono,fontSize:10,color:"#888",marginBottom:16,padding:"5px 10px",
        background:"#f9f5ed",borderRadius:4,border:"1px solid #e8e2d6"}}>
        🇺🇸 SEC EDGAR · {secForm === "ALL" ? "All form types (8-K, 10-Q, 10-K, 13D, Proxy)" : SEC_FORM_TYPES.find(f=>f.id===secForm)?.desc}
        {" · "}{loading ? "loading…" : `${filtered.length} filings`}{" · Free public API · No key required"}
      </div>
      {(brief || briefLoading) && (
        <div style={{background:"#fff",border:"2px solid #1a1a1a",borderRadius:6,padding:"20px 24px",marginBottom:24}}>
          <div style={{...mono,fontSize:9,color:"#888",marginBottom:14,textTransform:"uppercase",
            letterSpacing:"0.08em",display:"flex",justifyContent:"space-between"}}>
            <span>◈ SEC Filings Intelligence Brief · {secForm}</span>
            <span>{new Date().toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {briefLoading
            ? <div style={{...mono,fontSize:12,color:"#888",padding:"16px 0",textAlign:"center"}}>Analysing {filtered.length} filings…</div>
            : <div>{renderBrief(brief)}</div>
          }
        </div>
      )}
      {loading && <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>Loading SEC EDGAR filings…</div>}
      {!loading && filtered.length===0 && <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>No filings found. Try refreshing.</div>}
      {!loading && filtered.length>0 && (
        <div>
          <div style={{...mono,fontSize:10,color:"#888",marginBottom:8,borderBottom:"1px solid #e8e2d6",paddingBottom:6}}>
            {filtered.length} filings — click to view on SEC EDGAR
          </div>
          {filtered.map(filing => (
            <div key={filing.id} style={{display:"flex",gap:10,alignItems:"flex-start",borderBottom:"1px solid #f0ebe0",padding:"8px 0"}}>
              <span style={{...mono,fontSize:9,background:"#1a1a1a",color:"#fff",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2,whiteSpace:"nowrap"}}>{filing.formType}</span>
              <span style={{...mono,fontSize:9,color:"#aaa",flexShrink:0,marginTop:2,minWidth:80,whiteSpace:"nowrap"}}>
                {filing.filed ? (() => { try { return new Date(filing.filed).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); } catch(e){ return filing.filed?.slice(0,10)||""; } })() : ""}
              </span>
              {classifyMicro(filing.title) && <span style={{...mono,fontSize:9,background:"#2e7d32",color:"#fff",padding:"2px 4px",borderRadius:3,flexShrink:0,marginTop:2}}>◈</span>}
              <div style={{flex:1,minWidth:0}}>
                <a href={filing.link} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:13,color:"#1a1a1a",textDecoration:"none",lineHeight:1.4}}>
                  {filing.company && filing.company !== filing.title
                    ? <><strong>{filing.company}</strong> — {filing.title.replace(filing.company,"").replace(/^[\s–-]+/,"")}</>
                    : filing.title}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{...mono,fontSize:9,color:"#bbb",textAlign:"center",marginTop:20,paddingBottom:8}}>
        Source: SEC EDGAR public Atom feed · sec.gov · Free · No API key required
      </div>
    </div>
  );
}
