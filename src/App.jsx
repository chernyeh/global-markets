import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MSCI GICS SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
const MSCI_SECTORS = [
  { code:"FIN", label:"Financials",             icon:"◈", color:"#4a9eff" },
  { code:"IT",  label:"Information Technology", icon:"⬡", color:"#a78bfa" },
  { code:"IND", label:"Industrials",            icon:"⬢", color:"#fb923c" },
  { code:"CD",  label:"Consumer Discretionary", icon:"◉", color:"#f472b6" },
  { code:"CS",  label:"Consumer Staples",       icon:"◎", color:"#86efac" },
  { code:"HC",  label:"Health Care",            icon:"✦", color:"#67e8f9" },
  { code:"EN",  label:"Energy",                 icon:"◆", color:"#fbbf24" },
  { code:"MAT", label:"Materials",              icon:"◇", color:"#a3e635" },
  { code:"COM", label:"Comm. Services",         icon:"◐", color:"#f87171" },
  { code:"RE",  label:"Real Estate",            icon:"⬛", color:"#c084fc" },
  { code:"UTL", label:"Utilities",              icon:"◑", color:"#94a3b8" },
  { code:"MAC", label:"Macro / Policy",         icon:"⊕", color:"#c9a84c" },
  { code:"UNK", label:"Unclassified",           icon:"○", color:"#3a4a5a" },
];
const SECTOR_MAP = Object.fromEntries(MSCI_SECTORS.map(s => [s.code, s]));

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES
// ═══════════════════════════════════════════════════════════════════════════════
const GN = (q,hl="en-US",gl="US",ceid="US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const SOURCES = [
  {id:"reuters",    country:"US",name:"Reuters Business",       lang:"en",flag:"🇺🇸",url:GN("site:reuters.com business finance")},
  {id:"marketwatch",country:"US",name:"MarketWatch",            lang:"en",flag:"🇺🇸",url:GN("site:marketwatch.com markets stocks")},
  {id:"wsj",        country:"US",name:"Wall Street Journal",    lang:"en",flag:"🇺🇸",url:GN("site:wsj.com business finance markets")},
  {id:"bloomberg",  country:"US",name:"Bloomberg",              lang:"en",flag:"🇺🇸",url:GN("site:bloomberg.com finance markets economy")},
  {id:"ft",         country:"US",name:"Financial Times",        lang:"en",flag:"🇺🇸",url:GN("site:ft.com business economy markets")},
  {id:"globe_mail", country:"CA",name:"Globe and Mail",         lang:"en",flag:"🇨🇦",url:GN("site:theglobeandmail.com business")},
  {id:"fin_post",   country:"CA",name:"Financial Post",         lang:"en",flag:"🇨🇦",url:GN("site:financialpost.com")},
  {id:"bnn",        country:"CA",name:"BNN Bloomberg Canada",   lang:"en",flag:"🇨🇦",url:GN("site:bnnbloomberg.ca")},
  {id:"bt_sg",      country:"SG",name:"Business Times SG",      lang:"en",flag:"🇸🇬",url:GN("site:businesstimes.com.sg")},
  {id:"st_sg",      country:"SG",name:"Straits Times Business", lang:"en",flag:"🇸🇬",url:GN("site:straitstimes.com business")},
  {id:"cna_sg",     country:"SG",name:"CNA Business",           lang:"en",flag:"🇸🇬",url:GN("site:channelnewsasia.com business")},
  {id:"edge_sg",    country:"SG",name:"The Edge Singapore",     lang:"en",flag:"🇸🇬",url:GN("site:theedgesingapore.com")},
  {id:"scmp",       country:"HK",name:"South China Morning Post",lang:"en",flag:"🇭🇰",url:GN("site:scmp.com business finance")},
  {id:"mingtiandi", country:"HK",name:"Mingtiandi",             lang:"en",flag:"🇭🇰",url:GN("site:mingtiandi.com")},
  {id:"hket",       country:"HK",name:"香港經濟日報 HKET",        lang:"zh",flag:"🇭🇰",url:GN("site:hket.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"mingpao",    country:"HK",name:"明報財經 Ming Pao",       lang:"zh",flag:"🇭🇰",url:GN("site:mingpao.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"ked",        country:"KR",name:"KED Global",             lang:"en",flag:"🇰🇷",url:GN("site:kedglobal.com")},
  {id:"kr_herald",  country:"KR",name:"Korea Herald Business",  lang:"en",flag:"🇰🇷",url:GN("site:koreaherald.com business")},
  {id:"yonhap",     country:"KR",name:"Yonhap Economy",         lang:"en",flag:"🇰🇷",url:GN("site:en.yna.co.kr economy business")},
  {id:"hankyung",   country:"KR",name:"한국경제 Hankyung",        lang:"ko",flag:"🇰🇷",url:GN("site:hankyung.com 경제 주식","ko","KR","KR:ko")},
  {id:"maeil",      country:"KR",name:"매일경제 Maeil",           lang:"ko",flag:"🇰🇷",url:GN("site:mk.co.kr 경제 주식","ko","KR","KR:ko")},
  {id:"chosunbiz",  country:"KR",name:"조선비즈 Chosunbiz",      lang:"ko",flag:"🇰🇷",url:GN("site:biz.chosun.com 경제 기업","ko","KR","KR:ko")},
  {id:"taipei_t",   country:"TW",name:"Taipei Times Business",  lang:"en",flag:"🇹🇼",url:GN("site:taipeitimes.com business")},
  {id:"focus_tw",   country:"TW",name:"Focus Taiwan CNA",       lang:"en",flag:"🇹🇼",url:GN("site:focustaiwan.tw business")},
  {id:"udn_money",  country:"TW",name:"經濟日報 UDN Money",       lang:"zh",flag:"🇹🇼",url:GN("site:money.udn.com","zh-TW","TW","TW:zh-Hant")},
  {id:"ctee",       country:"TW",name:"工商時報 CTEE",            lang:"zh",flag:"🇹🇼",url:GN("site:ctee.com.tw","zh-TW","TW","TW:zh-Hant")},
  {id:"digitimes",  country:"TW",name:"DigiTimes",              lang:"en",flag:"🇹🇼",url:GN("site:digitimes.com")},
  {id:"econ_times", country:"IN",name:"Economic Times",         lang:"en",flag:"🇮🇳",url:GN("site:economictimes.indiatimes.com markets stocks")},
  {id:"biz_std",    country:"IN",name:"Business Standard",      lang:"en",flag:"🇮🇳",url:GN("site:business-standard.com markets")},
  {id:"mint",       country:"IN",name:"Mint / LiveMint",        lang:"en",flag:"🇮🇳",url:GN("site:livemint.com markets business")},
  {id:"ndtv_p",     country:"IN",name:"NDTV Profit",            lang:"en",flag:"🇮🇳",url:GN("site:ndtvprofit.com")},
  {id:"moneyctrl",  country:"IN",name:"Moneycontrol",           lang:"en",flag:"🇮🇳",url:GN("site:moneycontrol.com markets stocks")},
  {id:"afr",        country:"AU",name:"Australian Fin. Review", lang:"en",flag:"🇦🇺",url:GN("site:afr.com business markets")},
  {id:"the_aus",    country:"AU",name:"The Australian Business",lang:"en",flag:"🇦🇺",url:GN("site:theaustralian.com.au business")},
  {id:"abc_au",     country:"AU",name:"ABC Business",           lang:"en",flag:"🇦🇺",url:GN("site:abc.net.au business economy")},
  {id:"smh",        country:"AU",name:"Sydney Morning Herald",  lang:"en",flag:"🇦🇺",url:GN("site:smh.com.au business")},
  {id:"caixin",     country:"CN",name:"Caixin Global",          lang:"en",flag:"🇨🇳",url:GN("site:caixinglobal.com")},
  {id:"yicai",      country:"CN",name:"Yicai Global",           lang:"en",flag:"🇨🇳",url:GN("site:yicaiglobal.com")},
  {id:"peoples_d",  country:"CN",name:"People's Daily",         lang:"en",flag:"🇨🇳",url:GN("site:en.people.cn business economy")},
];

const COUNTRIES = [
  {code:"ALL",label:"All Markets",   flag:"🌐"},
  {code:"US", label:"United States", flag:"🇺🇸"},
  {code:"CA", label:"Canada",        flag:"🇨🇦"},
  {code:"SG", label:"Singapore",     flag:"🇸🇬"},
  {code:"HK", label:"Hong Kong",     flag:"🇭🇰"},
  {code:"KR", label:"Korea",         flag:"🇰🇷"},
  {code:"TW", label:"Taiwan",        flag:"🇹🇼"},
  {code:"IN", label:"India",         flag:"🇮🇳"},
  {code:"AU", label:"Australia",     flag:"🇦🇺"},
  {code:"CN", label:"China",         flag:"🇨🇳"},
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SK = {
  articles:  "gm_arts_v4",
  summaries: "gm_briefs_v4",
  lastFetch: "gm_fetch_v4",
  watchlist: "gm_watch_v4",
  watchHits: "gm_watchhits_v4",
};
async function sGet(k) {
  try {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function sSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch(e) { console.warn("Storage full:", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSS FETCH
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchFeed(source) {
  try {
    const res = await fetch("/api/rss?url=" + encodeURIComponent(source.url));
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || text.length < 100) return [];
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const items = Array.from(xml.querySelectorAll("item"));
    if (!items.length) return [];
    return items.slice(0,10).map(item => {
      const g = t => item.querySelector(t)?.textContent?.trim() || "";
      const title = g("title").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
      if (!title) return null;
      return {
        id: btoa(encodeURIComponent(title.slice(0,60))).replace(/[^a-zA-Z0-9]/g,"").slice(0,20),
        title,
        description: g("description").replace(/<[^>]+>/g,"").replace(/<!\[CDATA\[|\]\]>/g,"").trim().slice(0,260),
        link: g("link")||g("guid"),
        pubDate: g("pubDate")||g("dc:date")||"",
        source: source.name, sourceId: source.id,
        country: source.country, flag: source.flag, lang: source.lang,
        fetchedAt: Date.now(),
        translatedTitle: null, insight: null, sector: null, duplicateOf: null,
        watchMatches: [],
      };
    }).filter(Boolean);
  } catch(e) {
    console.warn("fetchFeed error:", source.id, e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════
const STOP = new Set(["that","this","with","from","have","been","will","were","their","they","about","after","into","over","under","more","also","when","than","just","like","says","said"]);
function fingerprint(t) {
  return (t||"").toLowerCase().replace(/[^\w\s]/g,"").split(/\s+/)
    .filter(w=>w.length>3&&!STOP.has(w)).sort().join(" ");
}
function jaccard(a,b) {
  const sa=new Set(a.split(" ")),sb=new Set(b.split(" "));
  const inter=[...sa].filter(w=>sb.has(w)).length;
  const union=new Set([...sa,...sb]).size;
  return union===0?0:inter/union;
}
function localDedup(articles) {
  const seen=[];
  return articles.map(art=>{
    const fp=fingerprint(art.translatedTitle||art.title);
    const match=seen.find(s=>jaccard(fp,s.fp)>0.45);
    if(match) return {...art,duplicateOf:match.id};
    seen.push({fp,id:art.id});
    return {...art,duplicateOf:null};
  });
}
async function claudeDedup(articles) {
  const candidates=articles.filter(a=>!a.duplicateOf);
  if(candidates.length<3) return articles;
  const prompt=`Identify groups of headlines covering the SAME news story (across languages too).
Return ONLY a JSON array of index arrays e.g. [[0,3],[1,5]]. Only groups of 2+. Empty array [] if none.
${candidates.map((a,i)=>`${i}. [${a.lang}] ${a.translatedTitle||a.title}`).join("\n")}`;
  try {
    const res=await callClaude(prompt,600);
    const groups=JSON.parse(res.replace(/```json|```/g,"").trim());
    const updated=[...articles];
    groups.forEach(grp=>{
      if(!Array.isArray(grp)||grp.length<2) return;
      const canon=candidates[grp[0]];
      if(!canon) return;
      grp.slice(1).forEach(idx=>{
        const dup=candidates[idx];
        if(!dup) return;
        const i=updated.findIndex(a=>a.id===dup.id);
        if(i!==-1) updated[i]={...updated[i],duplicateOf:canon.id};
      });
    });
    return updated;
  } catch { return articles; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE API HELPER
// ═══════════════════════════════════════════════════════════════════════════════
// Haiku: fast + cheap — used for translation, enrichment, summaries
async function callClaude(prompt, maxTokens=2000) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// Sonnet: used only for watchlist intelligence (needs deeper reasoning)
async function callClaudeSonnet(prompt, maxTokens=2000) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHMENT — translate + insight + sector
// ═══════════════════════════════════════════════════════════════════════════════
async function enrichBatch(articles) {
  if(!articles.length) return [];
  const prompt=`Financial analyst. For each headline return JSON array (one object per item):
{"translated":"English translation of title (if already English, copy it exactly)","insight":"One sentence investor takeaway in English","sector":"FIN|IT|IND|CD|CS|HC|EN|MAT|COM|RE|UTL|MAC|UNK"}
IMPORTANT: If the headline language is zh, ko, ja, or any non-English language, you MUST translate the title to English. Never leave a non-English title untranslated.
Sectors: FIN=banks/insurance/capital markets, IT=software/hardware/semis, IND=manufacturing/transport/conglomerates, CD=autos/retail/luxury/leisure, CS=food/beverages/household, HC=pharma/biotech/hospitals, EN=oil/gas/renewables, MAT=mining/chemicals/steel, COM=media/telecom/internet platforms, RE=property/REITs, UTL=power/water, MAC=central bank/rates/GDP/trade/FX/fiscal/elections/tariffs, UNK=unclear.
Return ONLY valid JSON array, no other text. ${articles.length} items:
${articles.map((a,i)=>`${i}. [${a.lang}] ${a.title}`).join("\n")}`;
  try {
    const text=await callClaude(prompt,2000);
    const cleaned=text.replace(/```json|```/g,"").trim();
    const parsed=JSON.parse(cleaned);
    return parsed;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLIMITED SUMMARY — splits into chunks, summarises each, then synthesises
// ═══════════════════════════════════════════════════════════════════════════════
async function generateBriefUnlimited(articles, label) {
  if (!articles.length) return "";
  const CHUNK = 20; // headlines per chunk

  // If small enough, do it in one call
  if (articles.length <= CHUNK) {
    const prompt=`Investment analyst. Concise brief on ${label}: (1) market backdrop, (2) key corporate/sector moves — name companies, (3) risks & opportunities. Prose, no bullets.

Headlines (${articles.length}):
${articles.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    return await callClaude(prompt, 1000);
  }

  // Multi-chunk: summarise each chunk, then synthesise
  const chunks=[];
  for(let i=0;i<articles.length;i+=CHUNK) chunks.push(articles.slice(i,i+CHUNK));

  const chunkSummaries=await Promise.all(chunks.map(async(chunk,ci)=>{
    const prompt=`Summarise these ${chunk.length} business headlines for ${label} in 2-3 sentences. Name key companies/events only.
${chunk.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    return await callClaude(prompt,600);
  }));

  // Synthesise all chunk summaries into final brief
  const synthPrompt=`Investment analyst. Synthesise these ${chunks.length} news summaries for ${label} into one crisp brief: (1) market backdrop, (2) key corporate/sector moves, (3) risks & opportunities. Prose, no bullets.

${chunkSummaries.map((s,i)=>`[${i+1}]: ${s}`).join("\n\n")}`;
  return await callClaude(synthPrompt, 1500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Fast local check: does article directly mention keyword?
function directMatch(art, keyword) {
  const kw = keyword.toLowerCase();
  const text = `${art.translatedTitle||art.title} ${art.description||""} ${art.insight||""}`.toLowerCase();
  return text.includes(kw);
}

// Claude: intelligent batch relevance check for a keyword across all articles
async function intelligentMatch(keyword, articles) {
  if (!articles.length) return [];
  // Send all articles at once — Claude decides which are relevant and why
  const prompt=`You are an investment research analyst monitoring news for relevance to a specific subject.

Subject being tracked: "${keyword}"

Your job: For EACH headline below, decide if it is relevant to "${keyword}" — either DIRECTLY (mentions it) or INDIRECTLY (affects it, involves competitors/peers/suppliers/customers/regulators/macro factors that impact it).

Think broadly: if tracking "Samsung", flag news about TSMC, SK Hynix, Apple, Qualcomm, memory chip demand, Korean Won, Korean economy, semiconductor regulations, etc.
If tracking "Fed" or "interest rates", flag inflation data, bond markets, bank earnings, housing data, etc.
If tracking a sector like "semiconductors", flag any company, policy, or macro event that affects the supply chain.

Return ONLY a JSON array. Include ONLY relevant articles (skip irrelevant ones):
[{"idx": <number>, "matchType": "direct"|"related", "reason": "brief explanation of why relevant (1 sentence)"}]

${articles.length} headlines:
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}, ${a.country}]`).join("\n")}`;

  try {
    const text = await callClaudeSonnet(prompt, 3000);
    const clean = text.replace(/```json|```/g,"").trim();
    // Find the JSON array in the response
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch { return []; }
}

// Run full watchlist analysis across all canonical articles
async function runWatchlistAnalysis(keywords, articles, onProgress) {
  // Reset all watchMatches
  let working = articles.map(a => ({ ...a, watchMatches: [] }));

  for (let ki = 0; ki < keywords.length; ki++) {
    const kw = keywords[ki].trim();
    if (!kw) continue;
    onProgress(`Analysing keyword ${ki+1}/${keywords.length}: "${kw}"…`);

    // Split into batches of 50 for Claude (context efficiency)
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
        // Avoid duplicate match entries for same keyword
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

// Generate a keyword intelligence brief
async function generateKeywordBrief(keyword, articles) {
  if (!articles.length) return "";
  const direct = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="direct"));
  const related = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="related"));

  const prompt=`You are an investment analyst producing a comprehensive intelligence brief on: "${keyword}"

You have ${direct.length} direct mentions and ${related.length} related/indirect stories from global news sources.
Synthesise ALL of them into a complete picture:
(1) What is happening directly with ${keyword} right now
(2) The broader ecosystem: competitors, suppliers, customers, regulators, macro factors — what are they signalling
(3) Overall investment assessment: risks, opportunities, and what to watch

Name specific companies, figures, and events. Flowing prose, no bullets. Be thorough — cover everything.

DIRECT MENTIONS (${direct.length}):
${direct.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")||"(none)"}

RELATED/INDIRECT (${related.length}):
${related.map(a=>`• ${a.translatedTitle||a.title} [${a.source}] — ${a.watchMatches?.find(m=>m.keyword===keyword)?.reason||""}`).join("\n")||"(none)"}`;

  return await callClaudeSonnet(prompt, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS & SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function timeAgo(ms) {
  if(!ms) return "";
  const d=(Date.now()-ms)/60000;
  if(d<1) return "just now";
  if(d<60) return `${Math.round(d)}m ago`;
  if(d<1440) return `${Math.round(d/60)}h ago`;
  return `${Math.round(d/1440)}d ago`;
}

function Dots({color="#c9a84c"}) {
  return (
    <span style={{display:"inline-flex",gap:3,alignItems:"center"}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:4,height:4,borderRadius:"50%",background:color,
          animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>
      ))}
    </span>
  );
}

function Tag({children,color="#c9a84c",onClick}) {
  return (
    <span onClick={onClick} style={{fontSize:9,padding:"1px 6px",borderRadius:3,
      fontFamily:"'DM Mono',monospace",background:`${color}18`,color,
      border:`1px solid ${color}44`,whiteSpace:"nowrap",cursor:onClick?"pointer":"default"}}>
      {children}
    </span>
  );
}

function ArticleCard({art, highlightKeyword=null}) {
  const sec = art.sector ? SECTOR_MAP[art.sector] : null;
  const displayTitle = art.translatedTitle || art.title;

  // Watchlist match info
  const directMatches = (art.watchMatches||[]).filter(m=>m.matchType==="direct");
  const relatedMatches = (art.watchMatches||[]).filter(m=>m.matchType==="related");
  const isHighlighted = art.watchMatches?.length > 0;

  // If we're in watchlist view filtering by a keyword, show that match's reason
  const focusMatch = highlightKeyword
    ? art.watchMatches?.find(m=>m.keyword===highlightKeyword)
    : null;

  return (
    <div style={{
      padding:"13px 0",
      borderBottom:"1px solid #0f1d2a",
      animation:"fadeIn 0.3s ease",
      background: isHighlighted ? "linear-gradient(90deg,#c9a84c04 0%,transparent 100%)" : "transparent",
      borderLeft: isHighlighted ? `2px solid ${directMatches.length?"#c9a84c":"#4a9eff"}` : "2px solid transparent",
      paddingLeft: isHighlighted ? 10 : 0,
    }}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:5}}>
        <span style={{fontSize:11,color:"#c9a84c",fontFamily:"'DM Mono',monospace",fontWeight:600}}>
          {art.flag} {art.source}
        </span>
        {art.lang!=="en" && <Tag color="#7a8fa6">{art.lang.toUpperCase()}→EN</Tag>}
        {sec && sec.code!=="UNK" && <Tag color={sec.color}>{sec.icon} {sec.label}</Tag>}
        {/* Watchlist match badges */}
        {directMatches.map(m=>(
          <Tag key={m.keyword} color="#c9a84c">⦿ {m.keyword}</Tag>
        ))}
        {relatedMatches.map(m=>(
          <Tag key={m.keyword} color="#4a9eff">◎ {m.keyword}</Tag>
        ))}
        {art.pubDate&&(
          <span style={{fontSize:9,color:"#2a3a4a",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>
            {timeAgo(new Date(art.pubDate).getTime())}
          </span>
        )}
      </div>

      <a href={art.link} target="_blank" rel="noopener noreferrer"
        style={{color:"#dde6f0",fontFamily:"'Playfair Display',Georgia,serif",
          fontSize:14,lineHeight:1.5,fontWeight:600,textDecoration:"none",
          display:"block",marginBottom:4,transition:"color 0.15s"}}
        onMouseOver={e=>e.target.style.color="#c9a84c"}
        onMouseOut={e=>e.target.style.color="#dde6f0"}>
        {displayTitle}
      </a>

      {/* Focus match reason in watchlist view */}
      {focusMatch && (
        <div style={{fontSize:11,color:focusMatch.matchType==="direct"?"#c9a84c":"#4a9eff",
          lineHeight:1.6,paddingLeft:0,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>
          {focusMatch.matchType==="direct"?"⦿ direct":"◎ related"} — {focusMatch.reason}
        </div>
      )}

      {art.insight&&(
        <div style={{fontSize:12,color:"#6a8fa8",lineHeight:1.65,
          borderLeft:"2px solid #c9a84c33",paddingLeft:9,
          fontStyle:"italic",fontFamily:"'DM Sans',sans-serif"}}>
          {art.insight}
        </div>
      )}
    </div>
  );
}

function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading}) {
  const brief=briefs[briefKey];
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    const b=await generateBriefUnlimited(articles,label);
    setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
    setLoading(p=>({...p,[briefKey]:false}));
  };
  return (
    <div style={{background:"#080f1a",border:"1px solid #182535",borderRadius:10,
      padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:brief?12:0}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c9a84c",letterSpacing:"0.12em"}}>
              AI INVESTMENT BRIEF · {articles.length} articles analysed
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#e8edf3",fontWeight:600}}>
              {label}
            </div>
          </div>
        </div>
        <button onClick={run} disabled={isLoading}
          style={{background:"none",border:"1px solid #c9a84c55",color:"#c9a84c",
            padding:"6px 14px",borderRadius:5,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#c9a84c11"}
          onMouseOut={e=>e.currentTarget.style.background="none"}>
          {isLoading?<><Dots/> generating…</>:brief?"↺ refresh":"✦ generate brief"}
        </button>
      </div>
      {brief&&(
        <p style={{fontSize:13,color:"#7a9ab8",lineHeight:1.9,fontStyle:"italic",
          margin:0,borderTop:"1px solid #141f2e",paddingTop:12,
          fontFamily:"'DM Sans',sans-serif",whiteSpace:"pre-wrap"}}>
          {brief}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST TAB
// ═══════════════════════════════════════════════════════════════════════════════
function WatchlistTab({allArticles, setAllArticles}) {
  const [keywords,     setKeywords]     = useState([]);
  const [inputVal,     setInputVal]     = useState("");
  const [analysing,    setAnalysing]    = useState(false);
  const [statusMsg,    setStatusMsg]    = useState("");
  const [activeKw,     setActiveKw]     = useState(null); // which keyword to view
  const [kwBriefs,     setKwBriefs]     = useState({});
  const [kwBriefLoad,  setKwBriefLoad]  = useState({});
  const [lastAnalysed, setLastAnalysed] = useState(null);

  // Load from storage
  useEffect(()=>{
    sGet(SK.watchlist).then(kws=>{ if(kws) setKeywords(kws); });
    sGet(SK.watchHits).then(hits=>{
      // hits are stored as { articleId: [{keyword, matchType, reason}] }
      if(!hits) return;
      setAllArticles(prev=>prev.map(a=>({
        ...a,
        watchMatches: hits[a.id] || a.watchMatches || []
      })));
    });
  },[]);

  const canonical = allArticles.filter(a=>!a.duplicateOf);

  const addKeyword = () => {
    const kw = inputVal.trim();
    if (!kw || keywords.includes(kw)) { setInputVal(""); return; }
    const updated = [...keywords, kw];
    setKeywords(updated);
    sSet(SK.watchlist, updated);
    setInputVal("");
  };

  const removeKeyword = (kw) => {
    const updated = keywords.filter(k=>k!==kw);
    setKeywords(updated);
    sSet(SK.watchlist, updated);
    if (activeKw===kw) setActiveKw(null);
    // Clear matches for this keyword
    setAllArticles(prev=>prev.map(a=>({
      ...a,
      watchMatches:(a.watchMatches||[]).filter(m=>m.keyword!==kw)
    })));
  };

  const runAnalysis = async () => {
    if (!keywords.length) return;
    setAnalysing(true);
    const updated = await runWatchlistAnalysis(keywords, canonical, setStatusMsg);
    // Merge back into allArticles (including dupes)
    setAllArticles(prev=>{
      const result = prev.map(a=>{
        const upd = updated.find(u=>u.id===a.id);
        return upd ? {...a, watchMatches: upd.watchMatches} : a;
      });
      // Persist hit map
      const hitMap = {};
      result.forEach(a=>{ if(a.watchMatches?.length) hitMap[a.id]=a.watchMatches; });
      sSet(SK.watchHits, hitMap);
      return result;
    });
    setLastAnalysed(Date.now());
    setStatusMsg("");
    setAnalysing(false);
    if (!activeKw && keywords.length) setActiveKw(keywords[0]);
  };

  // Articles matching active keyword
  const kwArticles = activeKw
    ? canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw))
    : [];
  const directArts  = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="direct"));
  const relatedArts = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="related"));

  // Summary counts per keyword
  const kwCounts = {};
  keywords.forEach(kw=>{
    kwCounts[kw] = {
      direct:  canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="direct")).length,
      related: canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="related")).length,
    };
  });

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Input area */}
      <div style={{background:"#080f1a",border:"1px solid #182535",borderRadius:10,
        padding:"20px 24px",marginBottom:20}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c9a84c",
          letterSpacing:"0.12em",marginBottom:4}}>WATCHLIST TRACKER</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#e8edf3",
          fontWeight:600,marginBottom:14}}>
          Intelligent Keyword Monitoring
        </div>
        <p style={{fontSize:12,color:"#4a6a8a",fontFamily:"'DM Sans',sans-serif",
          lineHeight:1.7,margin:"0 0 16px"}}>
          Add companies, people, sectors, or themes to track. Claude will flag both direct mentions and related stories — competitors, suppliers, regulators, macro factors — giving you a complete picture around each subject.
        </p>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input
            value={inputVal}
            onChange={e=>setInputVal(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addKeyword()}
            placeholder="e.g. Samsung, Fed rate cut, TSMC, Reliance Industries…"
            style={{flex:1,background:"#0d1a26",border:"1px solid #1e3040",borderRadius:6,
              padding:"9px 14px",color:"#dde6f0",fontFamily:"'DM Sans',sans-serif",fontSize:13,
              outline:"none"}}
          />
          <button onClick={addKeyword}
            style={{padding:"9px 18px",background:"#c9a84c11",border:"1px solid #c9a84c44",
              color:"#c9a84c",borderRadius:6,cursor:"pointer",fontFamily:"'DM Mono',monospace",
              fontSize:11,transition:"all 0.15s"}}
            onMouseOver={e=>e.currentTarget.style.background="#c9a84c22"}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            + add
          </button>
        </div>

        {/* Keyword chips */}
        {keywords.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {keywords.map(kw=>(
              <div key={kw}
                onClick={()=>setActiveKw(kw)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:activeKw===kw?"#1a2d48":"#0d1a26",
                  border:`1px solid ${activeKw===kw?"#c9a84c55":"#1e3040"}`,
                  borderRadius:20,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                  color:activeKw===kw?"#c9a84c":"#4a6a8a"}}>
                  {kw}
                </span>
                {kwCounts[kw]&&(kwCounts[kw].direct||kwCounts[kw].related)>0&&(
                  <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#3a6080"}}>
                    <span style={{color:"#c9a84c"}}>{kwCounts[kw].direct}</span>
                    {kwCounts[kw].related>0&&<span style={{color:"#4a9eff"}}> +{kwCounts[kw].related}</span>}
                  </span>
                )}
                <span onClick={e=>{e.stopPropagation();removeKeyword(kw);}}
                  style={{fontSize:12,color:"#2a4050",cursor:"pointer",lineHeight:1,
                    transition:"color 0.15s"}}
                  onMouseOver={e=>e.target.style.color="#f87171"}
                  onMouseOut={e=>e.target.style.color="#2a4050"}>×</span>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={runAnalysis} disabled={analysing||!keywords.length||!canonical.length}
            style={{padding:"9px 20px",
              background:(!keywords.length||!canonical.length)?"#0d1a26":"#c9a84c11",
              border:"1px solid #c9a84c44",color:"#c9a84c",borderRadius:6,
              cursor:(!keywords.length||!canonical.length)?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",
              opacity:(!keywords.length||!canonical.length)?0.4:1}}
            onMouseOver={e=>{if(!analysing)e.currentTarget.style.background="#c9a84c22"}}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            {analysing?<><Dots/> {statusMsg}</>:`⟳ run analysis (${canonical.length} articles × ${keywords.length} keywords)`}
          </button>
          {lastAnalysed&&(
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
              last run {timeAgo(lastAnalysed)}
            </span>
          )}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",
            fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
            <span style={{color:"#c9a84c"}}>⦿ direct mention</span>
            <span style={{color:"#4a9eff"}}>◎ related / indirect</span>
          </div>
        </div>
      </div>

      {/* Active keyword view */}
      {activeKw && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          {/* Keyword intel brief */}
          <div style={{background:"#080f1a",border:"1px solid #182535",borderRadius:10,
            padding:"18px 22px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              marginBottom:kwBriefs[activeKw]?12:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c9a84c",
                  letterSpacing:"0.12em"}}>INTELLIGENCE BRIEF · {kwArticles.length} relevant articles</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#e8edf3",fontWeight:600}}>
                  "{activeKw}" — Full Picture
                </div>
              </div>
              <button onClick={async()=>{
                  setKwBriefLoad(p=>({...p,[activeKw]:true}));
                  const b=await generateKeywordBrief(activeKw,kwArticles);
                  setKwBriefs(p=>({...p,[activeKw]:b}));
                  setKwBriefLoad(p=>({...p,[activeKw]:false}));
                }}
                disabled={kwBriefLoad[activeKw]||!kwArticles.length}
                style={{background:"none",border:"1px solid #c9a84c55",color:"#c9a84c",
                  padding:"6px 14px",borderRadius:5,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",
                  opacity:!kwArticles.length?0.4:1}}
                onMouseOver={e=>e.currentTarget.style.background="#c9a84c11"}
                onMouseOut={e=>e.currentTarget.style.background="none"}>
                {kwBriefLoad[activeKw]?<><Dots/> generating…</>:kwBriefs[activeKw]?"↺ refresh brief":"✦ generate intelligence brief"}
              </button>
            </div>
            {kwBriefs[activeKw]&&(
              <p style={{fontSize:13,color:"#7a9ab8",lineHeight:1.9,fontStyle:"italic",
                margin:0,borderTop:"1px solid #141f2e",paddingTop:12,
                fontFamily:"'DM Sans',sans-serif",whiteSpace:"pre-wrap"}}>
                {kwBriefs[activeKw]}
              </p>
            )}
          </div>

          {kwArticles.length===0 ? (
            <div style={{textAlign:"center",padding:"40px",fontFamily:"'DM Mono',monospace",
              color:"#1e2a38",fontSize:12}}>
              No matches yet — run analysis first
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {/* Direct mentions */}
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c9a84c",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>⦿ DIRECT MENTIONS</span>
                  <span style={{background:"#c9a84c22",color:"#c9a84c",padding:"1px 7px",
                    borderRadius:10,fontSize:9}}>{directArts.length}</span>
                </div>
                {directArts.length===0?(
                  <div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",
                    padding:"20px 0"}}>No direct mentions found</div>
                ):(
                  directArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)
                )}
              </div>

              {/* Related / indirect */}
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#4a9eff",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>◎ RELATED / INDIRECT</span>
                  <span style={{background:"#4a9eff22",color:"#4a9eff",padding:"1px 7px",
                    borderRadius:10,fontSize:9}}>{relatedArts.length}</span>
                </div>
                {relatedArts.length===0?(
                  <div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",
                    padding:"20px 0"}}>No related stories found</div>
                ):(
                  relatedArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* If no active keyword, show overview grid */}
      {!activeKw && keywords.length>0 && (
        <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",
          color:"#2a4050",fontSize:12}}>
          Select a keyword above to view its matches, or run analysis first
        </div>
      )}
      {keywords.length===0&&(
        <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",
          color:"#1e2a38",fontSize:12}}>
          Add keywords above to start tracking
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const STALE_MS = 45*60*1000;

export default function App() {
  const [mainTab,       setMainTab]       = useState("region");
  const [activeCountry, setActiveCountry] = useState("ALL");
  const [activeSector,  setActiveSector]  = useState("ALL");
  const [allArticles,   setAllArticles]   = useState([]);
  const [loading,       setLoading]       = useState({});
  const [lastFetch,     setLastFetch]     = useState({});
  const [briefs,        setBriefs]        = useState({});
  const [briefLoading,  setBriefLoading]  = useState({});
  const [statusMsg,     setStatusMsg]     = useState("Loading…");
  const [enriching,     setEnriching]     = useState(false);
  const [showDupes,     setShowDupes]     = useState(false);
  const [storageReady,  setStorageReady]  = useState(false);

  // Boot
  useEffect(()=>{
    (async()=>{
      const [arts,bfs,lf]=await Promise.all([sGet(SK.articles),sGet(SK.summaries),sGet(SK.lastFetch)]);
      if(arts?.length) setAllArticles(arts);
      if(bfs) setBriefs(bfs);
      if(lf)  setLastFetch(lf);
      setStatusMsg("");
      setStorageReady(true);
    })();
  },[]);

  useEffect(()=>{
    if(!storageReady) return;
    const stale=SOURCES.filter(s=>!lastFetch[s.id]||(Date.now()-lastFetch[s.id])>STALE_MS);
    if(stale.length) fetchSources(stale);
    else setStatusMsg("");
  },[storageReady]);

  const fetchSources = useCallback(async(sources)=>{
    setStatusMsg(`Fetching ${sources.length} feeds…`);
    sources.forEach(s=>setLoading(p=>({...p,[s.id]:true})));
    const results=await Promise.all(sources.map(async s=>{
      const items=await fetchFeed(s);
      setLoading(p=>({...p,[s.id]:false}));
      return {sourceId:s.id,items};
    }));
    const now=Date.now();
    setLastFetch(p=>{const u={...p,...Object.fromEntries(results.map(r=>[r.sourceId,now]))};sSet(SK.lastFetch,u);return u;});
    const fresh=results.flatMap(r=>r.items);
    setStatusMsg(`Fetched ${fresh.length} items. Deduplicating…`);
    setAllArticles(prev=>{
      const kept=prev.filter(a=>!results.some(r=>r.sourceId===a.sourceId));
      const merged=localDedup([...kept,...fresh]);
      sSet(SK.articles,merged);
      const toEnrich=fresh.filter(a=>!a.insight);
      if(toEnrich.length) runEnrichment(merged,toEnrich);
      else setStatusMsg("");
      return merged;
    });
  },[]);

  const runEnrichment=useCallback(async(currentArticles,toEnrich)=>{
    setEnriching(true);
    const BATCH=10;
    let working=[...currentArticles];
    for(let i=0;i<toEnrich.length;i+=BATCH){
      const batch=toEnrich.slice(i,i+BATCH);
      setStatusMsg(`Enriching ${i+1}–${Math.min(i+BATCH,toEnrich.length)} of ${toEnrich.length}…`);
      const results=await enrichBatch(batch);
      working=working.map(a=>{
        const idx=batch.findIndex(b=>b.id===a.id);
        if(idx===-1||!results[idx]) return a;
        const r=results[idx];
        // For non-English articles, always store translation even if looks same
        const shouldStore = a.lang !== "en" ? r.translated : (r.translated && r.translated !== a.title ? r.translated : null);
        return {...a,
          translatedTitle: shouldStore || a.translatedTitle,
          insight:r.insight||a.insight,sector:r.sector||a.sector};
      });
      setAllArticles(working);
    }
    setStatusMsg("Cross-language dedup…");
    working=localDedup(working);
    const afterClaude=await claudeDedup(working);
    setAllArticles(afterClaude);
    sSet(SK.articles,afterClaude);
    setEnriching(false);
    setStatusMsg("");
  },[]);

  // Computed
  const canonical=allArticles.filter(a=>showDupes||!a.duplicateOf);
  const forCountry=c=>c==="ALL"?canonical:canonical.filter(a=>a.country===c);
  const forSector=s=>s==="ALL"?canonical:canonical.filter(a=>a.sector===s);
  const countryArts=forCountry(activeCountry);
  const sectorArts=forSector(activeSector);
  const sourcesInView=SOURCES.filter(s=>activeCountry==="ALL"||s.country===activeCountry);
  const sourceGroups=sourcesInView.map(s=>({s,arts:canonical.filter(a=>a.sourceId===s.id)})).filter(g=>g.arts.length);
  const sectorGroups=MSCI_SECTORS.map(sec=>({sec,arts:canonical.filter(a=>a.sector===sec.code)})).filter(g=>g.arts.length).sort((a,b)=>b.arts.length-a.arts.length);
  const sectorForActive=SECTOR_MAP[activeSector];
  const isLoading=Object.values(loading).some(Boolean);
  const dupeCount=allArticles.filter(a=>a.duplicateOf).length;
  const enrichedCount=allArticles.filter(a=>a.insight).length;
  const sectorCountsForCountry={};
  countryArts.forEach(a=>{if(a.sector)sectorCountsForCountry[a.sector]=(sectorCountsForCountry[a.sector]||0)+1;});
  const watchlistHits=canonical.filter(a=>a.watchMatches?.length>0).length;

  const MAIN_TABS=[
    {id:"region", label:"⊕ Regions"},
    {id:"sector", label:"▦ Sectors"},
    {id:"watchlist", label:`◎ Watchlist${watchlistHits>0?` (${watchlistHits})`:""}` },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#060c13",color:"#c8d4e0",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        input{outline:none}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      {/* HEADER */}
      <header style={{background:"#03070e",borderBottom:"1px solid #111e2d",padding:"0 24px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1500,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#eaeff5",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1}}>GLOBAL MARKETS</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#c9a84c",letterSpacing:"0.2em",marginTop:2}}>INTELLIGENCE WIRE</div>
            </div>
            <div style={{display:"flex",gap:2,background:"#0b1420",borderRadius:6,padding:3,border:"1px solid #182535"}}>
              {MAIN_TABS.map(({id,label})=>(
                <button key={id} onClick={()=>setMainTab(id)}
                  style={{padding:"5px 13px",borderRadius:4,border:"none",
                    background:mainTab===id?"#182d48":"none",
                    color:mainTab===id?(id==="watchlist"?"#4a9eff":"#c9a84c"):"#8aa8bc",
                    cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {(isLoading||enriching||statusMsg)&&(
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#3a6a8a",display:"flex",alignItems:"center",gap:6}}>
                <Dots/>{statusMsg||"processing…"}
              </span>
            )}
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,display:"flex",gap:10,color:"#2a3a4a"}}>
              <span style={{color:"#2a4a6a"}}>{allArticles.length} fetched</span>
              <span style={{color:"#1a3a2a"}}>−{dupeCount} dupes</span>
              <span style={{color:"#2a3a1a"}}>{enrichedCount} enriched</span>
            </div>
            <button onClick={()=>setShowDupes(p=>!p)}
              style={{fontSize:9,padding:"4px 9px",border:"1px solid #182535",borderRadius:4,
                background:showDupes?"#182518":"none",color:showDupes?"#86efac":"#2a4a5a",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.15s"}}>
              {showDupes?"∙ hide dupes":"∙ show dupes"}
            </button>
            <button onClick={()=>fetchSources(SOURCES)} disabled={isLoading||enriching}
              style={{display:"flex",alignItems:"center",gap:5,background:"#c9a84c0e",
                border:"1px solid #c9a84c44",color:"#c9a84c",padding:"6px 14px",borderRadius:5,
                cursor:(isLoading||enriching)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",
                fontSize:11,opacity:(isLoading||enriching)?0.5:1,transition:"all 0.2s"}}
              onMouseOver={e=>e.currentTarget.style.background="#c9a84c1a"}
              onMouseOut={e=>e.currentTarget.style.background="#c9a84c0e"}>
              <span style={{display:"inline-block",animation:isLoading?"spin 1s linear infinite":"none"}}>⟳</span>
              {isLoading?"refreshing…":"refresh all"}
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAV (only for region/sector) */}
      {mainTab!=="watchlist"&&(
        <div style={{background:"#03070e",borderBottom:"1px solid #0d1a26",position:"sticky",top:58,zIndex:199,overflowX:"auto"}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px",display:"flex",minWidth:"max-content"}}>
            {mainTab==="region"?(
              COUNTRIES.map(c=>{
                const cnt=c.code==="ALL"?canonical.length:canonical.filter(a=>a.country===c.code).length;
                const active=activeCountry===c.code;
                return (
                  <button key={c.code} onClick={()=>setActiveCountry(c.code)}
                    style={{padding:"11px 14px",border:"none",background:"none",
                      color:active?"#c9a84c":"#8aa8bc",
                      borderBottom:active?"2px solid #c9a84c":"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c9a84c"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#8aa8bc"}}>
                    {c.flag} {c.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?"#c9a84c22":"#0d1a26",color:active?"#c9a84c":"#7a9ab8",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })
            ):(
              [{code:"ALL",label:"All Sectors",icon:"▤",color:"#c9a84c"},...MSCI_SECTORS].map(sec=>{
                const cnt=sec.code==="ALL"?canonical.length:canonical.filter(a=>a.sector===sec.code).length;
                const active=activeSector===sec.code;
                const col=sec.color||"#c9a84c";
                return (
                  <button key={sec.code} onClick={()=>setActiveSector(sec.code)}
                    style={{padding:"11px 13px",border:"none",background:"none",
                      color:active?col:"#8aa8bc",borderBottom:active?`2px solid ${col}`:"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c9a84c"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#8aa8bc"}}>
                    <span>{sec.icon||"▤"}</span> {sec.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?`${col}22`:"#0d1a26",color:active?col:"#7a9ab8",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{maxWidth:1500,margin:"0 auto",padding:"22px 24px"}}>

        {/* WATCHLIST */}
        {mainTab==="watchlist"&&(
          <WatchlistTab allArticles={allArticles} setAllArticles={setAllArticles}/>
        )}

        {/* REGION */}
        {mainTab==="region"&&(
          <>
            {activeCountry!=="ALL"&&(
              <>
                <BriefBox
                  label={`${COUNTRIES.find(c=>c.code===activeCountry)?.flag} ${COUNTRIES.find(c=>c.code===activeCountry)?.label} Market Overview`}
                  icon={COUNTRIES.find(c=>c.code===activeCountry)?.flag}
                  briefKey={`country_${activeCountry}`}
                  briefs={briefs} setBriefs={setBriefs} articles={countryArts}
                  loading={briefLoading} setLoading={setBriefLoading}
                />
                {Object.keys(sectorCountsForCountry).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
                    {MSCI_SECTORS.filter(s=>sectorCountsForCountry[s.code]).map(sec=>(
                      <button key={sec.code} onClick={()=>{setMainTab("sector");setActiveSector(sec.code);}}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",
                          borderRadius:5,border:`1px solid ${sec.color}44`,background:`${sec.color}0d`,
                          color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,transition:"all 0.15s"}}
                        onMouseOver={e=>e.currentTarget.style.background=`${sec.color}22`}
                        onMouseOut={e=>e.currentTarget.style.background=`${sec.color}0d`}>
                        {sec.icon} {sec.label} ({sectorCountsForCountry[sec.code]})
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {sourceGroups.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",fontFamily:"'DM Mono',monospace",color:"#1a2a38",fontSize:13}}>
                {isLoading?<><Dots/> fetching feeds…</>:"no articles — hit refresh"}
              </div>
            ):(
              <div style={{columns:"2 520px",columnGap:24}}>
                {sourceGroups.map(({s,arts})=>(
                  <div key={s.id} style={{breakInside:"avoid",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:"1px solid #c9a84c18",marginBottom:1}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c9a84c",fontWeight:600,letterSpacing:"0.06em"}}>
                        {s.flag} {s.name.toUpperCase()}
                      </span>
                      <span style={{fontSize:9,color:"#1e2e3e",fontFamily:"'DM Mono',monospace"}}>{arts.length}</span>
                      {lastFetch[s.id]&&<span style={{fontSize:8,color:"#182535",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{timeAgo(lastFetch[s.id])}</span>}
                    </div>
                    {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SECTOR */}
        {mainTab==="sector"&&(
          <>
            {activeSector==="ALL"?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))",gap:16}}>
                {sectorGroups.map(({sec,arts})=>{
                  const briefKey=`sector_${sec.code}`;
                  return (
                    <div key={sec.code} style={{background:"#070e1a",border:`1px solid ${sec.color}22`,borderRadius:10,padding:"16px 18px",animation:"fadeIn 0.4s ease"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20,color:sec.color}}>{sec.icon}</span>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sec.color,letterSpacing:"0.1em",fontWeight:600}}>{sec.code} · {arts.length} stories</div>
                            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#dde6f0",fontWeight:600}}>{sec.label}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>setActiveSector(sec.code)}
                            style={{fontSize:9,padding:"3px 9px",border:`1px solid ${sec.color}33`,borderRadius:4,background:"none",color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}
                            onMouseOver={e=>e.currentTarget.style.background=`${sec.color}11`}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>view all →</button>
                          <button onClick={async()=>{
                              setBriefLoading(p=>({...p,[briefKey]:true}));
                              const b=await generateBriefUnlimited(arts,sec.label);
                              setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                              setBriefLoading(p=>({...p,[briefKey]:false}));
                            }}
                            disabled={briefLoading[briefKey]}
                            style={{fontSize:9,padding:"3px 9px",border:`1px solid ${sec.color}44`,borderRadius:4,background:"none",color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}
                            onMouseOver={e=>e.currentTarget.style.background=`${sec.color}11`}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>
                            {briefLoading[briefKey]?<Dots color={sec.color}/>:"✦ brief"}
                          </button>
                        </div>
                      </div>
                      {briefs[briefKey]&&<p style={{fontSize:11,color:"#6a8fa8",lineHeight:1.8,fontStyle:"italic",margin:"0 0 10px",borderBottom:"1px solid #111f2e",paddingBottom:10,fontFamily:"'DM Sans',sans-serif",whiteSpace:"pre-wrap"}}>{briefs[briefKey]}</p>}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                        {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                          const n=arts.filter(a=>a.country===c.code).length;
                          return n?<span key={c.code} style={{fontSize:9,color:"#3a6080",fontFamily:"'DM Mono',monospace"}}>{c.flag}{n}</span>:null;
                        })}
                      </div>
                      {arts.slice(0,4).map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      {arts.length>4&&<button onClick={()=>setActiveSector(sec.code)} style={{fontSize:10,color:"#2a5a7a",background:"none",border:"none",cursor:"pointer",paddingTop:8,fontFamily:"'DM Mono',monospace"}}>+{arts.length-4} more →</button>}
                    </div>
                  );
                })}
              </div>
            ):(
              <>
                <BriefBox
                  label={`${sectorForActive?.icon} ${sectorForActive?.label} — Global Sector View`}
                  icon={sectorForActive?.icon}
                  briefKey={`sector_${activeSector}`}
                  briefs={briefs} setBriefs={setBriefs} articles={sectorArts}
                  loading={briefLoading} setLoading={setBriefLoading}
                />
                <div style={{columns:"2 520px",columnGap:24}}>
                  {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                    const arts=sectorArts.filter(a=>a.country===c.code);
                    if(!arts.length) return null;
                    const col=sectorForActive?.color||"#c9a84c";
                    return (
                      <div key={c.code} style={{breakInside:"avoid",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:`1px solid ${col}22`,marginBottom:1}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:col,fontWeight:600}}>{c.flag} {c.label.toUpperCase()}</span>
                          <span style={{fontSize:9,color:"#1e2e3e",fontFamily:"'DM Mono',monospace"}}>{arts.length}</span>
                        </div>
                        {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <footer style={{borderTop:"1px solid #0c1826",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>{SOURCES.length} sources · {COUNTRIES.length-1} markets · {MSCI_SECTORS.length} GICS sectors</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>persisted locally · stale threshold 45 min</span>
      </footer>
    </div>
  );
}
