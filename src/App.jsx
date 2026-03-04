import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MSCI GICS SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
const MSCI_SECTORS = [
  { code:"FIN", label:"Financials",             icon:"◈", color:"#2980b9" },
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
  { code:"MAC", label:"Macro / Policy",         icon:"⊕", color:"#c0392b" },
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
      let title = g("title").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
      // Strip Google News source suffix e.g. "Headline - Source Name"
      // and datestamp garbage e.g. "20260303 - 即時財經新聞 - 明報財經網"
      title = title
        .replace(/\s*[-–]\s*\d{8}\s*[-–].*$/,"")   // remove date suffix
        .replace(/\s*[-–]\s*[^-–]{3,50}$/, "")       // remove source suffix
        .trim();
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
// Translate a single non-English title using Google Translate free endpoint
async function googleTranslate(text, sourceLang) {
  // Try up to 2 language variants
  const langs = sourceLang === "zh" ? ["zh-CN", "zh-TW"] : [sourceLang];
  for (const lang of langs) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translated = data?.[0]?.map(x=>x?.[0]||"").join("") || "";
      // Check result is actually English (not CJK)
      const cjkRatio = (translated.match(/[\u4e00-\u9fff\uac00-\ud7ff]/g)||[]).length / (translated.length||1);
      if (translated && cjkRatio < 0.1) return translated;
    } catch {}
  }
  return text; // return original if all attempts fail
}

async function enrichBatch(articles) {
  if(!articles.length) return [];

  // Step 1: Pre-translate all non-English titles via Google Translate
  const withTranslations = await Promise.all(articles.map(async a => {
    if (a.lang === "en") return { ...a, _preTranslated: a.title };
    const translated = await googleTranslate(a.title, a.lang === "zh" ? "zh-CN" : a.lang);
    return { ...a, _preTranslated: translated };
  }));

  // Step 2: Enrich with Claude using pre-translated titles
  const prompt=`Financial analyst. For each headline return a JSON array (one object per item).
Each item: {"translated":"<English title>","insight":"<one sentence investor takeaway>","sector":"<code>"}
Use EXACTLY the pre-translated title provided — do not re-translate.
Sector codes: FIN=banks/insurance/capital markets, IT=software/hardware/semis, IND=manufacturing/transport/conglomerates, CD=autos/retail/luxury/leisure, CS=food/beverages/household, HC=pharma/biotech/hospitals, EN=oil/gas/renewables, MAT=mining/chemicals/steel, COM=media/telecom/internet platforms, RE=property/REITs, UTL=power/water, MAC=central bank/rates/GDP/trade/FX/fiscal/elections/tariffs, UNK=unclear.
Return ONLY a valid JSON array. ${withTranslations.length} items:
${withTranslations.map((a,i)=>`${i}. ${a._preTranslated}`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 2000);
    const cleaned = text.replace(/```json|```/g,"").trim();
    return JSON.parse(cleaned);
  } catch { 
    // Fallback: return pre-translations without insight
    return withTranslations.map(a=>({translated:a._preTranslated, insight:"", sector:"UNK"}));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLIMITED SUMMARY — splits into chunks, summarises each, then synthesises
// ═══════════════════════════════════════════════════════════════════════════════
async function generateBriefUnlimited(articles, label) {
  if (!articles.length) return {text:"", articles:[]};
  const sourceArticles = articles; // keep reference for link matching

  // Split into chunks of 25 and summarise ALL in parallel — no sequential steps
  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < articles.length; i += CHUNK) chunks.push(articles.slice(i, i + CHUNK));

  if (chunks.length === 1) {
    const prompt = `You are a senior financial analyst writing a detailed investment briefing for ${label}.

Use this exact format:

## [Descriptive title summarising the main theme, e.g. "Korea Markets: Tech Sell-off Amid Fed Uncertainty"]

[2-3 sentence executive summary of the most important developments and overall market tone]

## [Section heading for first major theme, e.g. "Energy & Commodities"]
- [Specific development with context and investor implication. Be precise — name companies, figures, percentages where available. Explain WHY it matters to investors.]
- [Next bullet — same level of detail]

## [Section heading for second major theme]
- [Detailed bullet with company names and implications]
- [Next bullet]

(Add as many sections and bullets as needed to cover all significant stories)

## Risks & Outlook
- [Specific risk with context]
- [Opportunity or thing to watch]

Rules:
- Each bullet must be 1-2 sentences with real detail and investor perspective
- Name EVERY company mentioned in the headlines
- End each bullet with [REF:N] citing the article number(s) that support it (e.g. [REF:2] or [REF:0,4])
- Group related stories under thematic section headers
- Do not use vague language — be specific about what happened and why it matters

Articles (cite using [REF:N] at end of each bullet, N = article number, can cite multiple e.g. [REF:0,3]):
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} — ${a.source}`).join("\n")}`;
    const text = await callClaude(prompt, 2000);
    return {text, articles: sourceArticles};
  }

  // Multiple chunks — ALL summarised in parallel, then one fast synthesis
  const summaries = await Promise.all(chunks.map(chunk => {
    const prompt = `Summarise these headlines for ${label}. For each story name the company, what happened, and the investor implication in 1 sentence.
${chunk.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    return callClaude(prompt, 600);
  }));

  const synthPrompt = `You are a senior financial analyst. Synthesise these summaries into a detailed investment briefing for ${label}.

Format:
## [Descriptive title capturing the main theme]

[2-3 sentence executive summary of the key developments]

## [Thematic section heading]
- [Detailed bullet: company name + what happened + investor implication, 1-2 sentences]
- [Next bullet with same detail]

## [Next thematic section]
- [Detailed bullet]

## Risks & Outlook
- [Specific risk or opportunity with context]

Rules: name every company, be specific with figures/percentages, explain investor implications, group by theme.

Summaries to synthesise:
${summaries.map((s,i)=>`[${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, 1800);
  return {text, articles: sourceArticles};
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

  const text = await callClaudeSonnet(prompt, 3000);
  return text;
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

function Dots({color="#c0392b"}) {
  return (
    <span style={{display:"inline-flex",gap:3,alignItems:"center"}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:4,height:4,borderRadius:"50%",background:color,
          animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>
      ))}
    </span>
  );
}

function Tag({children,color="#c0392b",onClick}) {
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
  const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.25;
  const rawTitle = art.translatedTitle || art.title;
  const displayTitle = isCJK(rawTitle) && art.lang !== "en"
    ? (art.translatedTitle && !isCJK(art.translatedTitle) ? art.translatedTitle : "[Translation pending…] " + rawTitle)
    : rawTitle;

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
      borderBottom:"1px solid #e8e2d6",
      animation:"fadeIn 0.3s ease",
      background: isHighlighted ? "linear-gradient(90deg,#c9a84c04 0%,transparent 100%)" : "transparent",
      borderLeft: isHighlighted ? `2px solid ${directMatches.length?"#c0392b":"#4a9eff"}` : "2px solid transparent",
      paddingLeft: isHighlighted ? 10 : 0,
    }}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:5}}>
        <span style={{fontSize:11,color:"#c0392b",fontFamily:"'DM Mono',monospace",fontWeight:600}}>
          {art.flag} {art.source}
        </span>
        {art.lang!=="en" && <Tag color="#7a8fa6">{art.lang.toUpperCase()}→EN</Tag>}
        {sec && sec.code!=="UNK" && <Tag color={sec.color}>{sec.icon} {sec.label}</Tag>}
        {/* Watchlist match badges */}
        {directMatches.map(m=>(
          <Tag key={m.keyword} color="#c0392b">⦿ {m.keyword}</Tag>
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
        style={{color:"#1a1a1a",fontFamily:"'Playfair Display',Georgia,serif",
          fontSize:14,lineHeight:1.5,fontWeight:600,textDecoration:"none",
          display:"block",marginBottom:4,transition:"color 0.15s"}}
        onMouseOver={e=>e.target.style.color="#c0392b"}
        onMouseOut={e=>e.target.style.color="#1a1a1a"}>
        {displayTitle}
      </a>

      {/* Focus match reason in watchlist view */}
      {focusMatch && (
        <div style={{fontSize:11,color:focusMatch.matchType==="direct"?"#c0392b":"#4a9eff",
          lineHeight:1.6,paddingLeft:0,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>
          {focusMatch.matchType==="direct"?"⦿ direct":"◎ related"} — {focusMatch.reason}
        </div>
      )}

      {art.insight&&(
        <div style={{fontSize:12,color:"#666",lineHeight:1.65,
          borderLeft:"2px solid #c9a84c33",paddingLeft:9,
          fontStyle:"italic",fontFamily:"'DM Sans',sans-serif"}}>
          {art.insight}
        </div>
      )}
    </div>
  );
}

// Find articles relevant to a bullet line by keyword overlap
function findLinksForBullet(bulletText, articles) {
  if (!articles?.length || !bulletText) return [];
  // Extract [REF:N,M,...] markers Claude inserts
  const refMatch = bulletText.match(/\[REF:([\d,\s]+)\]/);
  if (refMatch) {
    const indices = refMatch[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    return indices.map(i=>articles[i]).filter(Boolean);
  }
  // Fallback: keyword matching
  const words = bulletText.toLowerCase()
    .replace(/[^a-z0-9\s]/g," ").split(/\s+/)
    .filter(w => w.length > 4);
  return articles
    .map(a => {
      const haystack = ((a.translatedTitle||a.title)+" "+(a.source||"")).toLowerCase();
      const hits = words.filter(w => haystack.includes(w)).length;
      return {art: a, score: hits};
    })
    .filter(x => x.score >= 2)
    .sort((a,b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.art);
}

// Renders brief text with headers (##) and bullets (-) and LINK badges
function BriefRenderer({text, articles=[]}) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:14,marginTop:4}}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{height:6}}/>;
        // ## Section header
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:13,
              fontWeight:700,color:"#8B4513",margin:"22px 0 10px",
              textTransform:"uppercase",letterSpacing:"0.1em",
              borderBottom:"2px solid #e0d8cc",paddingBottom:6}}>
              {trimmed.replace(/^## /,"")}
            </div>
          );
        }
        // # Title header
        if (trimmed.startsWith("# ")) {
          return (
            <div key={i} style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:20,
              fontWeight:700,color:"#1a1a1a",margin:"4px 0 14px",lineHeight:1.3}}>
              {trimmed.replace(/^# /,"")}
            </div>
          );
        }
        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const txt = trimmed.replace(/^[-*] /,"");
          // Strip [REF:...] from display, use for links
          const cleanTxt = txt.replace(/\[REF:[\d,\s]+\]/g, "").trim();
          const boldMatch = cleanTxt.match(/^\*\*(.+?)\*\*:?\s*(.*)/s);
          const links = findLinksForBullet(txt, articles);
          return (
            <div key={i} style={{display:"flex",gap:8,margin:"8px 0",
              paddingLeft:8,alignItems:"flex-start"}}>
              <span style={{color:"#c0392b",fontWeight:700,marginTop:2,flexShrink:0,fontSize:16}}>•</span>
              <span style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:17,
                color:"#1a1a1a",lineHeight:1.85}}>
                {boldMatch
                  ? <><strong style={{color:"#1a1a1a"}}>{boldMatch[1]}</strong>{boldMatch[2] ? ": "+boldMatch[2] : ""}</>
                  : cleanTxt}
                {links.map((a,li) => (
                  <a key={li} href={a.link} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-block",marginLeft:7,padding:"2px 8px",
                      background:"#8B4513",color:"#fff",borderRadius:3,
                      fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:700,
                      textDecoration:"none",letterSpacing:"0.05em",verticalAlign:"middle"}}
                    onMouseOver={e=>e.currentTarget.style.background="#a0522d"}
                    onMouseOut={e=>e.currentTarget.style.background="#8B4513"}>
                    LINK
                  </a>
                ))}
              </span>
            </div>
          );
        }
        // Plain paragraph — executive summary box
        return (
          <p key={i} style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:17,
            color:"#1a1a1a",lineHeight:1.9,margin:"10px 0",
            background:"#f0ece4",padding:"16px 20px",borderRadius:4}}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading}) {
  const briefData=briefs[briefKey]; // {text, articles} or legacy string
  const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);
  const briefArts = briefData?.articles ?? articles;
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    const b=await generateBriefUnlimited(articles,label);
    setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
    setLoading(p=>({...p,[briefKey]:false}));
  };
  return (
    <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
      padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>
              AI INVESTMENT BRIEF · {articles.length} articles analysed
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:700}}>
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
      <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
        padding:"20px 24px",marginBottom:20}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",
          letterSpacing:"0.12em",marginBottom:4}}>WATCHLIST TRACKER</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",
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
            style={{flex:1,background:"#fff",border:"1px solid #ddd",borderRadius:6,
              padding:"9px 14px",color:"#1a1a1a",fontFamily:"'DM Sans',sans-serif",fontSize:13,
              outline:"none"}}
          />
          <button onClick={addKeyword}
            style={{padding:"9px 18px",background:"#c0392b11",border:"1px solid #c0392b66",
              color:"#c0392b",borderRadius:6,cursor:"pointer",fontFamily:"'DM Mono',monospace",
              fontSize:11,transition:"all 0.15s"}}
            onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
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
                  background:activeKw===kw?"#fdecea":"#fff",
                  border:`1px solid ${activeKw===kw?"#c0392b":"#ddd"}`,
                  borderRadius:20,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                  color:activeKw===kw?"#c0392b":"#333"}}>
                  {kw}
                </span>
                {kwCounts[kw]&&(kwCounts[kw].direct||kwCounts[kw].related)>0&&(
                  <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#3a6080"}}>
                    <span style={{color:"#c0392b"}}>{kwCounts[kw].direct}</span>
                    {kwCounts[kw].related>0&&<span style={{color:"#2980b9"}}> +{kwCounts[kw].related}</span>}
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
              background:(!keywords.length||!canonical.length)?"#f5f5f5":"#fdecea",
              border:"1px solid #bbb",color:"#333",borderRadius:6,
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
            <span style={{color:"#c0392b"}}>⦿ direct mention</span>
            <span style={{color:"#2980b9"}}>◎ related / indirect</span>
          </div>
        </div>
      </div>

      {/* Active keyword view */}
      {activeKw && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          {/* Keyword intel brief */}
          <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
            padding:"18px 22px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              marginBottom:kwBriefs[activeKw]?12:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",
                  letterSpacing:"0.12em"}}>INTELLIGENCE BRIEF · {kwArticles.length} relevant articles</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:600}}>
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
                style={{background:"none",border:"1px solid #bbb",color:"#333",
                  padding:"6px 14px",borderRadius:5,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",
                  opacity:!kwArticles.length?0.4:1}}
                onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
                onMouseOut={e=>e.currentTarget.style.background="none"}>
                {kwBriefLoad[activeKw]?<><Dots/> generating…</>:kwBriefs[activeKw]?"↺ refresh brief":"✦ generate intelligence brief"}
              </button>
            </div>
            {kwBriefs[activeKw]&&(
              <BriefRenderer text={kwBriefs[activeKw]} articles={kwArticles}/>
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
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>⦿ DIRECT MENTIONS</span>
                  <span style={{background:"#c0392b18",color:"#c0392b",padding:"1px 7px",
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
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2980b9",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>◎ RELATED / INDIRECT</span>
                  <span style={{background:"#4a9eff22",color:"#2980b9",padding:"1px 7px",
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
      const toEnrich=fresh.filter(a=>!a.insight||(a.lang!=="en"&&!a.translatedTitle));
      if(toEnrich.length) runEnrichment(merged,toEnrich);
      else setStatusMsg("");
      return merged;
    });
  },[]);

  const runEnrichment=useCallback(async(currentArticles,toEnrich)=>{
    setEnriching(true);
    const BATCH=15;
    let working=[...currentArticles];
    for(let i=0;i<toEnrich.length;i+=BATCH){
      const batch=toEnrich.slice(i,i+BATCH);
      setStatusMsg(`Enriching ${i+1}–${Math.min(i+BATCH,toEnrich.length)} of ${toEnrich.length}…`);
      const results=await enrichBatch(batch);
      working=working.map(a=>{
        const idx=batch.findIndex(b=>b.id===a.id);
        if(idx===-1||!results[idx]) return a;
        const r=results[idx];
        // For non-English: store translation only if it looks like real English (not CJK chars)
        const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.2;
        const translationOk = a.lang !== "en" && r.translated && !isCJK(r.translated);
        const shouldStore = translationOk ? r.translated
          : a.lang === "en" && r.translated && r.translated !== a.title ? r.translated
          : null;
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
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const sortByDate = arts => [...arts].sort((a,b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    const db = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
    return db - da; // newest first
  });
  const isRecent = a => {
    const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    return t === 0 || (Date.now() - t) < FIVE_DAYS_MS;
  };
  const canonical = sortByDate(
    allArticles.filter(a => (showDupes||!a.duplicateOf) && isRecent(a))
  );
  const forCountry=c=>c==="ALL"?canonical:canonical.filter(a=>a.country===c);
  const forSector=s=>s==="ALL"?canonical:canonical.filter(a=>a.sector===s);
  const countryArts=forCountry(activeCountry);
  const sectorArts=forSector(activeSector);
  const sourcesInView=SOURCES.filter(s=>activeCountry==="ALL"||s.country===activeCountry);
  const sourceGroups=sourcesInView.map(s=>({s,arts:canonical.filter(a=>a.sourceId===s.id)})).filter(g=>g.arts.length);
  const sectorGroups=MSCI_SECTORS.map(sec=>({sec,arts:canonical.filter(a=>a.sector===sec.code)})).filter(g=>g.arts.length).sort((a,b)=>b.arts.length-a.arts.length);
  // Also show unenriched articles under a pending group if sectors tab is empty
  const unenrichedArts=canonical.filter(a=>!a.sector);
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
    <div style={{minHeight:"100vh",background:"#f5f0e8",color:"#1a1a1a",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        input{outline:none}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      {/* HEADER */}
      <header style={{background:"#fff",borderBottom:"2px solid #1a1a1a",padding:"0 24px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1500,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:23,color:"#1a1a1a",fontWeight:700,letterSpacing:"-0.03em",lineHeight:1}}>GLOBAL MARKETS</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",letterSpacing:"0.3em",marginTop:2}}>INTELLIGENCE WIRE</div>
            </div>
            <div style={{display:"flex",gap:2,background:"none",borderRadius:0,padding:"2px 0",border:"none"}}>
              {MAIN_TABS.map(({id,label})=>(
                <button key={id} onClick={()=>setMainTab(id)}
                  style={{padding:"5px 13px",borderRadius:4,border:"none",
                    background:"none",
                    color:mainTab===id?"#c0392b":"#333",
                    borderBottom:mainTab===id?"2px solid #c0392b":"2px solid transparent",
                    fontWeight:mainTab===id?600:400,
                    borderRadius:0,
                    cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {(isLoading||enriching||statusMsg)&&(
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",display:"flex",alignItems:"center",gap:6}}>
                <Dots/>{statusMsg||"processing…"}
              </span>
            )}
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,display:"flex",gap:10,color:"#888"}}>
              <span style={{color:"#2a4a6a"}}>{allArticles.length} fetched</span>
              <span style={{color:"#1a3a2a"}}>−{dupeCount} dupes</span>
              <span style={{color:"#2a3a1a"}}>{enrichedCount} enriched</span>
            </div>
            <button onClick={()=>setShowDupes(p=>!p)}
              style={{fontSize:9,padding:"4px 9px",border:"1px solid #ccc",borderRadius:4,
                background:showDupes?"#f0f0f0":"none",color:showDupes?"#333":"#888",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.15s"}}>
              {showDupes?"∙ hide dupes":"∙ show dupes"}
            </button>
            <button onClick={()=>{
                if(!window.confirm("Clear all cached headlines and summaries? The app will re-fetch and re-enrich everything from scratch.")) return;
                Object.values(SK).forEach(k=>localStorage.removeItem(k));
                setAllArticles([]);
                setBriefs({});
                setLastFetch({});
                setStatusMsg("Cache cleared — reloading…");
                setTimeout(()=>window.location.reload(), 800);
              }}
              style={{fontSize:9,padding:"4px 9px",border:"1px solid #e0b0b0",borderRadius:4,
                background:"none",color:"#c0392b",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.15s"}}
              onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              ✕ clear cache
            </button>
            <button onClick={()=>fetchSources(SOURCES)} disabled={isLoading||enriching}
              style={{display:"flex",alignItems:"center",gap:5,background:"none",
                border:"1px solid #bbb",color:"#333",padding:"6px 14px",borderRadius:5,
                cursor:(isLoading||enriching)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",
                fontSize:11,opacity:(isLoading||enriching)?0.5:1,transition:"all 0.2s"}}
              onMouseOver={e=>e.currentTarget.style.background="#f5f5f5"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              <span style={{display:"inline-block",animation:isLoading?"spin 1s linear infinite":"none"}}>⟳</span>
              {isLoading?"refreshing…":"refresh all"}
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAV (only for region/sector) */}
      {mainTab!=="watchlist"&&(
        <div style={{background:"#fff",borderBottom:"1px solid #ddd",position:"sticky",top:58,zIndex:199,overflowX:"auto"}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px",display:"flex",minWidth:"max-content"}}>
            {mainTab==="region"?(
              COUNTRIES.map(c=>{
                const cnt=c.code==="ALL"?canonical.length:canonical.filter(a=>a.country===c.code).length;
                const active=activeCountry===c.code;
                return (
                  <button key={c.code} onClick={()=>setActiveCountry(c.code)}
                    style={{padding:"11px 14px",border:"none",background:"none",
                      color:active?"#c0392b":"#8aa8bc",
                      borderBottom:active?"2px solid #c9a84c":"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#333"}}>
                    {c.flag} {c.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?"#fdecea":"#f0f0f0",color:active?"#c0392b":"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })
            ):(
              [{code:"ALL",label:"All Sectors",icon:"▤",color:"#c0392b"},...MSCI_SECTORS].map(sec=>{
                const cnt=sec.code==="ALL"?canonical.length:canonical.filter(a=>a.sector===sec.code).length;
                const active=activeSector===sec.code;
                const col=sec.color||"#c0392b";
                return (
                  <button key={sec.code} onClick={()=>setActiveSector(sec.code)}
                    style={{padding:"11px 13px",border:"none",background:"none",
                      color:active?col:"#333",borderBottom:active?`2px solid ${col}`:"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#333"}}>
                    <span>{sec.icon||"▤"}</span> {sec.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?`${col}18`:"#f0f0f0",color:active?col:"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
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
            {countryArts.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",fontFamily:"'DM Mono',monospace",color:"#1a2a38",fontSize:13}}>
                {isLoading?<><Dots/> fetching feeds…</>:"no articles — hit refresh"}
              </div>
            ):activeCountry==="ALL"?(
              // All Markets: flat chronological list, newest first
              <div style={{maxWidth:860,margin:"0 auto"}}>
                {countryArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
              </div>
            ):(
              // Individual country: grouped by source
              <div style={{columns:"2 520px",columnGap:24}}>
                {sourceGroups.map(({s,arts})=>(
                  <div key={s.id} style={{breakInside:"avoid",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:"1px solid #e8e2d6",marginBottom:1}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.06em"}}>
                        {s.flag} {s.name.toUpperCase()}
                      </span>
                      <span style={{fontSize:9,color:"#888",fontFamily:"'DM Mono',monospace"}}>{arts.length}</span>
                      {lastFetch[s.id]&&<span style={{fontSize:8,color:"#aaa",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{timeAgo(lastFetch[s.id])}</span>}
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
                    <div key={sec.code} style={{background:"#ffffff",border:`1px solid ${sec.color}22`,borderRadius:10,padding:"16px 18px",animation:"fadeIn 0.4s ease"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20,color:sec.color}}>{sec.icon}</span>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sec.color,letterSpacing:"0.1em",fontWeight:600}}>{sec.code} · {arts.length} stories</div>
                            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>{sec.label}</div>
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
                      {briefs[briefKey]&&<div style={{marginBottom:10,borderBottom:"1px solid #e8e2d6",paddingBottom:10}}><BriefRenderer text={typeof briefs[briefKey]==="string"?briefs[briefKey]:briefs[briefKey]?.text} articles={typeof briefs[briefKey]==="string"?arts:briefs[briefKey]?.articles||arts}/></div>}
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
                    const col=sectorForActive?.color||"#c0392b";
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

      <footer style={{borderTop:"1px solid #ddd",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>{SOURCES.length} sources · {COUNTRIES.length-1} markets · {MSCI_SECTORS.length} GICS sectors</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>persisted locally · stale threshold 45 min</span>
      </footer>
    </div>
  );
}
