import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { FontScaleCtx, FONT_SCALES } from "./context.js";
import { timeAgo, Dots, Tag, humanizeBriefError } from "./components/helpers.jsx";
import ArticleCard from "./components/ArticleCard.jsx";
import BriefRenderer, { findLinksForBullet, extractTickers, fetchQuotes } from "./components/BriefRenderer.jsx";
import BriefBox from "./components/BriefBox.jsx";
import OverflowMenu from "./components/OverflowMenu.jsx";
import FilingsTab from "./components/FilingsTab.jsx";
import WatchlistTab from "./components/WatchlistTab.jsx";
import SourcesTab from "./components/SourcesTab.jsx";
import NewsBriefsTab from "./components/NewsBriefsTab.jsx";
import { MSCI_SECTORS, SECTOR_MAP, SIGNAL_META, SIGNAL_CATEGORIES, WEAKNESS_CONTEXT_PATTERNS, BRIEF_CATEGORY_WEIGHT, SIGNAL_STRENGTH, BRIEF_COUNTRY_BOOST, BRIEF_COUNTRY_PENALTY, BRIEF_BOOSTED_COUNTRIES, BRIEF_PENALISED_COUNTRIES, WORLD_TOPIC_WEIGHTS, OPINION_MAP } from "./data/taxonomy.js";
import { resolveOpinion, SOURCE_WEIGHTING_NOTE } from "./opinions.js";
import OpinionsTab from "./components/OpinionsTab.jsx";
import { GN, NEWS_BRIEF_GROUPS, SOURCES, EM_SOURCES, ALL_MARKET_SOURCES, SOURCE_TIER_MAP } from "./data/sources.js";
import { COUNTRIES, EM_COUNTRIES, MARKET_REGIONS, MARKETS, MARKET_MAP } from "./data/markets.js";
import { BRIEF_FORMAT, BRIEF_RULES, WORLD_FORMAT, WORLD_RULES } from "./prompts.js";
import { mono, RED, labelSm, labelMed, pillBtn, card, HoverButton } from "./ui.jsx";
import { sleep, backoff, mapLimit, callClaude } from "./api.js";
import { SK, EM_SK, sGet, sSet } from "./storage.js";
import { classifyMicro } from "./utils.js";

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS BRIEFS TAB groups → src/data/sources.js
// ═══════════════════════════════════════════════════════════════════════════════

function isMarqueeSource(id) {
  if (!id) return false;
  const s = id.toLowerCase();
  return s.startsWith("bloomberg") || s.startsWith("bloom_") ||
    s.startsWith("wsj") || s.startsWith("reuters") ||
    s === "ft" || s === "ft_alphaville" ||
    s === "nyt" || s === "wapo" || s === "wapo_politics" || s === "semafor" ||
    s === "scmp" || s === "scmp_markets" || s === "scmp_china" ||
    s === "globe_mail" || s === "globe_itm" ||
    s === "guardian" || s === "guardian_au";
}


function worldScore(a) {
  const text = `${a.translatedTitle || a.title} ${a.description || ""}`;
  const topicScore = WORLD_TOPIC_WEIGHTS.reduce(
    (best, t) => t.re.test(text) ? Math.max(best, t.score) : best, 0
  );
  const tier = SOURCE_TIER_MAP[a.sourceId] ?? 3;
  const sourceBonus = isMarqueeSource(a.sourceId) ? 15 : tier === 1 ? 8 : tier === 2 ? 3 : 0;
  const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt || 0);
  const recency = t ? Math.min(0.999, t / Date.now()) : 0;
  return (topicScore + sourceBonus) * 10 + recency;
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
    return items.slice(0, source.limit || 10).map(item => {
      const g = t => item.querySelector(t)?.textContent?.trim() || "";
      let title = g("title").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
      title = title
        .replace(/\s*[-–]\s*\d{8}\s*[-–].*$/,"")
        .replace(/\s*[-–]\s*[^-–]{3,50}$/, "")
        .trim();
      if (!title) return null;
      const JUNK_PATTERNS = [
        /\b(award[s]?|recogni[sz]|certif|named one of|best place|top \d+ company|proud to announce|thrilled to|excited to|sponsorship|celebrate[s]?|anniversary)\b/i,
        /\b(why i (bought|sold|own|like)|my top pick|portfolio update|buy the dip|passive income|monthly dividend|drip investing|high yield|income investor|deep dive into|a closer look at|dividend king|dividend aristocrat)\b/i,
        /\b(footballer|scored? \d+ goals?|league table|match(day| report| result)|world cup final|copa (america|libertadores|sudamericana)|AFCON|UEFA|Champions League|Europa League|semi.?final|quarter.?final|grand prix|Formula [1E])\b/i,
        /please complete.*verif/i,
        /tehrantimes pdf/i,
        /verif.*to continue/i,
        /access denied/i,
        /just a moment/i,
        /checking your browser/i,
        /ddos protection/i,
        /cloudflare/i,
        /enable javascript/i,
        /why do i have to complete a captcha/i,
        // Section / landing pages and SEO market-research spam that leak through
        // broad Google News queries (not real articles):
        /latest .{0,40}news\s*(&|and|＆|–|-)\s*headlines/i,
        /^(opinions?|editorials?)\s*,\s*(editorials?|op-?eds?|commentary)/i,
        /\bmarket\s+(size|share)\b.{0,50}(forecast|outlook|20\d\d)/i,
      ];
      if (JUNK_PATTERNS.some(p => p.test(title))) return null;
      const authorEl = item.getElementsByTagName("dc:creator")[0] || item.querySelector("author") || item.querySelector("creator");
      const author = (authorEl?.textContent || "").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g,"").replace(/^\s*by\s+/i,"").trim().slice(0,80);
      return {
        id: btoa(encodeURIComponent(title.slice(0,60))).replace(/[^a-zA-Z0-9]/g,"").slice(0,20),
        title,
        description: g("description").replace(/<[^>]+>/g,"").replace(/<!\[CDATA\[|\]\]>/g,"").trim().slice(0,260),
        author,
        link: g("link")||g("guid"),
        pubDate: g("pubDate")||g("dc:date")||"",
        source: source.name, sourceId: source.id,
        country: source.country, flag: source.flag, lang: source.lang,
        fetchedAt: Date.now(),
        translatedTitle: null, insight: null, sector: null, signal: null, signalCategory: null, weaknessContext: false, duplicateOf: null, isMicro: classifyMicro(title),
        isOpinion: null, opinionCategory: null,
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
function resolveGroup(arts) {
  const src = id => SOURCES.find(s=>s.id===id);
  const free    = arts.filter(a=>!src(a.sourceId)?.paywall);
  const paywalled = arts.filter(a=> src(a.sourceId)?.paywall);
  const byDate = a => a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
  const pool   = free.length ? free : paywalled;
  const canon  = pool.slice().sort((a,b)=>byDate(b)-byDate(a))[0];
  const paywallSource = paywalled.length
    ? paywalled.slice().sort((a,b)=>byDate(b)-byDate(a))[0].sourceId
    : null;
  const paywallArticle = paywalled.length
    ? paywalled.slice().sort((a,b)=>byDate(b)-byDate(a))[0]
    : null;
  const canonUpdated = {
    ...canon,
    duplicateOf: null,
    originalSourceId: (free.length && paywallSource && !sameFamily(canon.sourceId, paywallSource))
      ? paywallSource
      : (canon.originalSourceId||null),
    originalSourceLink: (free.length && paywallArticle && !sameFamily(canon.sourceId, paywallSource))
      ? (paywallArticle.link || null)
      : (canon.originalSourceLink||null),
  };
  const dupes = arts.filter(a=>a.id!==canon.id).map(a=>({...a,duplicateOf:canon.id}));
  return [canonUpdated, ...dupes];
}
const PUBLISHER_FAMILIES = [
  ["bloomberg","bloomberg2"],
  ["wsj","wsj2"],
];
function sameFamily(idA, idB) {
  return PUBLISHER_FAMILIES.some(fam=>fam.includes(idA)&&fam.includes(idB));
}
function localDedup(articles) {
  const seenIds = new Set();
  const uniqueArts = [];
  const exactDupes = [];
  for (const art of articles) {
    if (seenIds.has(art.id)) exactDupes.push({...art, duplicateOf: art.id});
    else { seenIds.add(art.id); uniqueArts.push(art); }
  }
  const seen = [];
  const groupMap = {};
  const posToGroup = {};
  uniqueArts.forEach((art, i) => {
    const fp = fingerprint(art.translatedTitle || art.title);
    const match = seen.find(s => {
      const threshold = sameFamily(art.sourceId, uniqueArts[s.idx]?.sourceId) ? 0.25 : 0.45;
      return jaccard(fp, s.fp) > threshold;
    });
    if (match) {
      if (!groupMap[match.idx]) groupMap[match.idx] = [uniqueArts[match.idx]];
      groupMap[match.idx].push(art);
      posToGroup[i] = match.idx;
    } else {
      seen.push({fp, idx: i});
    }
  });
  const resolvedAtPos = {};
  Object.entries(groupMap).forEach(([canonIdxStr, grpArts]) => {
    const canonIdx = Number(canonIdxStr);
    const resolved = resolveGroup(grpArts);
    grpArts.forEach((origArt, j) => {
      const match = resolved.find(r => r.sourceId === origArt.sourceId && r.id === origArt.id)
                 || resolved[j];
      const pos = uniqueArts.indexOf(origArt);
      if (pos >= 0) resolvedAtPos[pos] = match;
    });
  });
  const result = uniqueArts.map((art, i) => resolvedAtPos[i] || art);
  return [...result, ...exactDupes];
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
    let updated=[...articles];
    groups.forEach(grp=>{
      if(!Array.isArray(grp)||grp.length<2) return;
      const grpArts=grp.map(idx=>candidates[idx]).filter(Boolean);
      if(grpArts.length<2) return;
      const resolved=resolveGroup(grpArts);
      resolved.forEach(a=>{
        const i=updated.findIndex(u=>u.id===a.id);
        if(i!==-1) updated[i]=a;
      });
    });
    return updated;
  } catch { return articles; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHMENT — translate + insight + sector + signal
// ═══════════════════════════════════════════════════════════════════════════════
async function googleTranslate(text, sourceLang) {
  const langs = sourceLang === "zh" ? ["zh-CN", "zh-TW"] : [sourceLang];
  for (const lang of langs) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translated = data?.[0]?.map(x=>x?.[0]||"").join("") || "";
      const cjkRatio = (translated.match(/[\u4e00-\u9fff\uac00-\ud7ff]/g)||[]).length / (translated.length||1);
      if (translated && cjkRatio < 0.1) return translated;
    } catch {}
  }
  return text;
}

async function enrichBatch(articles) {
  if(!articles.length) return [];
  const withTranslations = await Promise.all(articles.map(async a => {
    if (a.lang === "en") return { ...a, _preTranslated: a.title };
    const translated = await googleTranslate(a.title, a.lang === "zh" ? "zh-CN" : a.lang);
    return { ...a, _preTranslated: translated };
  }));
  const catCodes = Object.keys(SIGNAL_CATEGORIES).join("|");
  const prompt=`Financial analyst. For each headline return a JSON array (one object per item).
Each item: {"translated":"<English title>","insight":"<one sentence investor takeaway>","sector":"<sector code>","signal":"<signal code>","signalCategory":"<category code>","weaknessContext":<true|false>,"isOpinion":<true|false>,"opinionCategory":"<opinion code>"}
Use EXACTLY the pre-translated title provided — do not re-translate.

Sector codes: FIN=banks/insurance/capital markets, IT=software/hardware/semis, IND=manufacturing/transport/conglomerates, CD=autos/retail/luxury/leisure, CS=food/beverages/household, HC=pharma/biotech/hospitals, EN=oil/gas/renewables, MAT=mining/chemicals/steel, COM=media/telecom/internet platforms, RE=property/REITs, UTL=power/water, MAC=central bank/rates/GDP/trade/FX/fiscal/elections/tariffs, UNK=unclear.

Signal codes (what is the LIKELY SHARE PRICE impact for the named company?):
SP2 = Strong Positive: clear upside catalyst — earnings beat, contract win, buyback, special dividend, M&A target at premium, director buying, turnaround plan by credible new CEO
SP1 = Positive: mild positive — analyst upgrade, dividend raise, new CEO (no distress context), small contract win, partnership, IPO
N  = Neutral: macro/policy news, no direct named-company impact, general market commentary
SN1 = Negative: mild negative — analyst downgrade, minor regulatory query, CFO change, small earnings miss, director selling
SN2 = Strong Negative: clear downside — profit warning, dividend cut, CEO resignation under pressure, regulatory fine, accounting restatement, debt covenant breach, large earnings miss, contract loss

Signal category — pick the SINGLE best code:
${catCodes}

Special management signals:
MGMT_INTERVIEW = CEO/CFO gives interview (set weaknessContext=true if it follows poor results or under pressure)
MGMT_STRATEGY = new strategic direction announced
MGMT_TURNAROUND = explicit turnaround plan after underperformance (set signal=SP2 if new leader, SN1 if incumbent)
MGMT_UNDER_PRESSURE = management defending strategy under analyst/investor/activist pressure (signal=SN1)
MGMT_BUY = director/insider buying own stock (signal=SP2)
MGMT_SELL = director/insider selling own stock (signal=SN1)
ACTIVIST_INVESTOR = activist fund takes stake or pushes for change (signal=SP1)

BIZ_FEATURE = substantive long-form business feature, in-depth company profile, or investigative piece about a company's strategy, operations, competitive dynamics, business model change, or industry transformation — not a routine earnings headline or press release; use signal=N unless the feature reveals a clear positive or negative strategic shift (SP1/SN1)
MARKET_OUTLOOK = interview with or commentary from a fund manager, portfolio manager, investment strategist, sell-side analyst, or expert panel discussing market direction, sector rotation, valuations, or macro fundamentals from an investment perspective — includes "roundtable", "where is the market headed", "outlook" discussions; signal=N

weaknessContext: set to TRUE if the headline mentions or implies the event follows a period of poor results, execution failure, strategic miss, investor pressure, or calls for change. Otherwise false.

isOpinion: set to TRUE if the item argues a viewpoint, interprets events, or takes a stance rather than just reporting them — opinion, commentary, editorial, column, analysis, "big read"/feature, or a stock idea/thesis (e.g. op-eds, "Heard on the Street", Breakingviews, "the case for/against", "why X should…", bull/bear cases, "here's why"). Be inclusive: if a piece reads as interpretation, argument, or a call rather than a straight news report, mark it TRUE. Set FALSE for straight news reporting, earnings results, wire briefs, and routine analyst rating actions.
opinionCategory — if isOpinion is true, pick the SINGLE best code (else use "OTHER"):
MACRO = economy, GDP, inflation, growth, recession, fiscal/monetary outlook
GEO = geopolitics, war, sanctions, trade tensions, cross-border conflict
MKT = markets/trading views — equities, bonds, yields, rallies, selloffs, volatility
INVEST = investing philosophy, portfolio strategy, asset allocation, positioning
COMPANY = opinion focused on a single named company
SECTOR = opinion on a sector/industry as a whole
POLICY = regulation, central-bank policy, elections, legislation, antitrust
OTHER = opinion that fits none of the above

STRICT FACTUAL RULE: Only classify based on what is EXPLICITLY in the headline. Do not infer figures or details not present. When uncertain between two categories, pick the more conservative signal strength.

Return ONLY a valid JSON array, no markdown. ${withTranslations.length} items:
${withTranslations.map((a,i)=>`${i}. ${a._preTranslated}`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 2000);
    const cleaned = text.replace(/```json|```/g,"").trim();
    return JSON.parse(cleaned);
  } catch { 
    return withTranslations.map(a=>({translated:a._preTranslated, insight:"", sector:"UNK"}));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLIMITED SUMMARY — splits into chunks, summarises each, then synthesises
// ═══════════════════════════════════════════════════════════════════════════════
function briefCountryWeight(country) {
  if (BRIEF_BOOSTED_COUNTRIES.has(country)) return BRIEF_COUNTRY_BOOST;
  if (BRIEF_PENALISED_COUNTRIES.has(country)) return BRIEF_COUNTRY_PENALTY;
  return 1;
}

function briefScore(a, weightCountries=false) {
  const w = BRIEF_CATEGORY_WEIGHT[a.signalCategory] ?? 0;
  const s = SIGNAL_STRENGTH[a.signal] ?? 0;
  const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt || 0);
  const recency = t ? Math.min(0.999, t / Date.now()) : 0; // sub-1 tiebreak
  const base = w * 10 + s * 2 + recency;
  return weightCountries ? base * briefCountryWeight(a.country) : base;
}

// Rank by conviction/actionability and drop classified noise (uncategorised neutral,
// non-catalyst items). Unenriched articles (no signalCategory yet) are kept.
// weightCountries is opt-in, used only for the global Intel master brief.
function rankBriefArticles(articles, weightCountries=false) {
  return articles
    .filter(a => {
      if (!a.signalCategory) return true;
      const w = BRIEF_CATEGORY_WEIGHT[a.signalCategory] ?? 0;
      if (w === 0 && (!a.signal || a.signal === "N") && !a.isMicro) return false;
      return true;
    })
    .sort((x, y) => briefScore(y, weightCountries) - briefScore(x, weightCountries));
}

// Format one article line with its signal tag, category, insight and description snippet
// so the model reasons over the pre-classification and content, not the bare headline.
function fmtBriefArticle(a, n) {
  const sig = a.signal && SIGNAL_META[a.signal] ? SIGNAL_META[a.signal].short : "";
  const cat = a.signalCategory && SIGNAL_CATEGORIES[a.signalCategory] ? SIGNAL_CATEGORIES[a.signalCategory].label : "";
  const tag = (sig || cat) ? `[${[sig, cat].filter(Boolean).join(" ")}] ` : "";
  const title = a.translatedTitle || a.title;
  const insight = a.insight ? ` :: ${a.insight}` : "";
  const desc = a.description ? ` :: ${a.description.slice(0, 160)}` : "";
  return `${n}. ${tag}${title} — ${a.source}${insight}${desc}`;
}


// Output-token ceiling for a briefing/synthesis call. Kept well below what an
// 8000-token generation needs so the request completes inside the serverless
// function's 60s limit (Vercel Hobby cap) instead of timing out with a 504.
const BRIEF_MAX_TOKENS = 3000;

// Cap on articles fed into a single briefing/synthesis call, mirroring
// NewsBriefsTab's MASTER_CAP. Uncapped input (e.g. Breaking News at a 24-48h
// window) produces a synthesis prompt large enough to exceed the serverless
// function's 60s limit. Articles are pre-sorted by importance/recency, so the
// top slice keeps the strongest signals.
const WORLD_BRIEF_CAP = 70;

async function generateBriefUnlimited(articles, label, coveragePriority=null, maxArticles=null, weightCountries=false) {
  if (!articles.length) return {text:"", articles:[]};

  // Rank by conviction, drop noise, then cap (master brief) — best signals first.
  let ranked = rankBriefArticles(articles, weightCountries);
  if (!ranked.length) ranked = articles;
  if (maxArticles && ranked.length > maxArticles) ranked = ranked.slice(0, maxArticles);
  articles = ranked;
  const sourceArticles = articles;

  const DEFAULT_PRIORITY = "COVERAGE PRIORITY: When two items are equally actionable, prefer US and China, then Europe (UK, Germany, France, Italy, Switzerland, pan-European), then Hong Kong and China company news, then Singapore, Korea, Taiwan, Australia, Israel, Middle East, Iran, then Canada. Give Hong Kong, China and Singapore more weight than Korea. Mention Indian stories briefly unless they carry clear global or sector impact.";
  // Always weight summaries toward major publications & newswires, on top of any
  // country-level coverage priority.
  const effectivePriority = `${coveragePriority || DEFAULT_PRIORITY}\n${SOURCE_WEIGHTING_NOTE}`;

  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < articles.length; i += CHUNK) chunks.push(articles.slice(i, i + CHUNK));

  if (chunks.length === 1) {
    const prompt = `You are a buy-side analyst producing an ACTIONABLE Company News Intelligence briefing for ${label}. Your job is to help decide what to BUY, TRIM, or AVOID — and to surface signals that are ahead of consensus, not generic news.

Each article below is tagged with [SIGNAL CATEGORY] and may include an analyst insight and a description snippet after "::". Use these to judge significance and placement.

Write in this exact format:

${BRIEF_FORMAT}

${BRIEF_RULES(effectivePriority)}

Articles (cite using [REF:N] at end of each bullet, N = article number):
${articles.map((a,i)=>fmtBriefArticle(a,i)).join("\n")}`;
    const text = await callClaude(prompt, BRIEF_MAX_TOKENS, {throwOnError:true, timeoutMs:60000});
    return {text, articles: sourceArticles, generatedAt: Date.now()};
  }

  // Summarise chunks with bounded concurrency to avoid rate-limit/overload.
  // Individual chunk failures degrade gracefully (empty string, filtered below).
  const summaries = await mapLimit(chunks, 4, (chunk, ci) => {
    const offset = ci * CHUNK;
    const prompt = `You are a buy-side analyst. For each tagged item below, write ONE sentence: the company or subject, what changed, why it matters, and the implied action (accumulate/trim/watch/avoid). Keep the [CATEGORY] tag at the front of each line and end with the article number in parentheses, e.g. "(article 3)". Prioritise analyst rating changes, management changes, insider/activist signals, management interviews, analyst roundtables and strategic shifts. Flag a macro item only when it reflects a change in regime, trend, or sentiment.
${chunk.map((a,i)=>fmtBriefArticle(a, offset+i)).join("\n")}`;
    return callClaude(prompt, 800, {throwOnError:false});
  });

  const goodSummaries = summaries.filter(s => s && s.trim());
  if (!goodSummaries.length) throw new Error("empty_response");

  const synthPrompt = `You are a buy-side analyst producing an ACTIONABLE Company News Intelligence briefing for ${label} from the tagged summaries below. Help decide what to BUY, TRIM, or AVOID, and surface ahead-of-consensus signals rather than generic news.

Write in this exact format:

${BRIEF_FORMAT}

${BRIEF_RULES(effectivePriority)}
- The summaries carry [CATEGORY] tags and article numbers in parentheses, e.g. "(article 3)" — use those numbers for [REF:N] citations.

Summaries to synthesise:
${goodSummaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, BRIEF_MAX_TOKENS, {throwOnError:true, timeoutMs:60000});
  return {text, articles: sourceArticles, generatedAt: Date.now()};
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD NEWS BRIEFING — for Breaking News Intelligence. A cross-country/segment
// news roundup led by the big macro/geopolitical picture. Unlike the Company
// brief it does NOT filter to company signals — macro and general news are the point.
// ═══════════════════════════════════════════════════════════════════════════════
function fmtWorldArticle(a, n) {
  const m = MARKET_MAP[a.country];
  const geo = m ? `[${m.flag} ${m.label}] ` : (a.country ? `[${a.country}] ` : "");
  const title = a.translatedTitle || a.title;
  const desc = a.description ? ` :: ${a.description.slice(0, 180)}` : "";
  return `${n}. ${geo}${title} — ${a.source}${desc}`;
}


async function generateWorldBriefing(articles, label, maxArticles=null) {
  if (!articles.length) return {text:"", articles:[]};
  // Preserve the caller's ordering (recency + cross-country breadth); do not
  // re-rank by company signal — macro/general news must stay in.
  let arts = articles;
  if (maxArticles && arts.length > maxArticles) arts = arts.slice(0, maxArticles);
  const sourceArticles = arts;

  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < arts.length; i += CHUNK) chunks.push(arts.slice(i, i + CHUNK));

  if (chunks.length === 1) {
    const prompt = `You are a global markets editor writing a ${label} briefing — a concise roundup of what is happening across the world's markets and economies.

Each item below is tagged with its [Country] and may include a description snippet after "::".

Write in this exact format:

${WORLD_FORMAT}

${WORLD_RULES}
- ${SOURCE_WEIGHTING_NOTE}

Items (cite using [REF:N] at end of each bullet, N = item number):
${arts.map((a,i)=>fmtWorldArticle(a,i)).join("\n")}`;
    const text = await callClaude(prompt, BRIEF_MAX_TOKENS, {throwOnError:true, timeoutMs:60000});
    return {text, articles: sourceArticles, generatedAt: Date.now()};
  }

  const summaries = await mapLimit(chunks, 4, (chunk, ci) => {
    const offset = ci * CHUNK;
    const prompt = `You are a global markets editor. For each tagged item below, write ONE sentence: the country/region, what happened, and why it matters for markets or the world. Keep the [Country] tag at the front of each line and end with the item number in parentheses, e.g. "(item 3)". Cover macro, policy, geopolitics, regional and corporate news alike.
${chunk.map((a,i)=>fmtWorldArticle(a, offset+i)).join("\n")}`;
    return callClaude(prompt, 800, {throwOnError:false});
  });

  const goodSummaries = summaries.filter(s => s && s.trim());
  if (!goodSummaries.length) throw new Error("empty_response");

  const synthPrompt = `You are a global markets editor writing a ${label} briefing from the tagged summaries below — a concise roundup of what is happening across the world.

Write in this exact format:

${WORLD_FORMAT}

${WORLD_RULES}
- ${SOURCE_WEIGHTING_NOTE}
- The summaries carry [Country] tags and item numbers in parentheses, e.g. "(item 3)" — use those numbers for [REF:N] citations.

Summaries to synthesise:
${goodSummaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, BRIEF_MAX_TOKENS, {throwOnError:true, timeoutMs:60000});
  return {text, articles: sourceArticles, generatedAt: Date.now()};
}
// ═══════════════════════════════════════════════════════════════════════════════
function directMatch(art, keyword) {
  const kw = keyword.toLowerCase();
  const text = `${art.translatedTitle||art.title} ${art.description||""} ${art.insight||""}`.toLowerCase();
  return text.includes(kw);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const STALE_MS = 45*60*1000;

export default function App() {
  const [mainTab,       setMainTab]       = useState("breaking");
  const [marketsView,   setMarketsView]   = useState("markets");
  const [activeTier,    setActiveTier]    = useState("ALL"); // ALL | DM | EM
  const [activeRegion,  setActiveRegion]  = useState("ALL");
  const [activeCountry, setActiveCountry] = useState("ALL");
  const [activeSector,  setActiveSector]  = useState("ALL");
  const [allArticles,   setAllArticles]   = useState([]);
  const [loading,       setLoading]       = useState({});
  const [lastFetch,     setLastFetch]     = useState({});
  const [briefs,        setBriefs]        = useState({});
  const [briefLoading,  setBriefLoading]  = useState({});
  const [briefError,    setBriefError]    = useState({});
  const [statusMsg,     setStatusMsg]     = useState("Loading…");
  const [enriching,     setEnriching]     = useState(false);
  const [showDupes,     setShowDupes]     = useState(false);
  const [storageReady,  setStorageReady]  = useState(false);
  const [fontScale,     setFontScale]     = useState(1.0);

  useEffect(()=>{
    (async()=>{
      const [arts,bfs,lf,fs]=await Promise.all([sGet(SK.articles),sGet(SK.summaries),sGet(SK.lastFetch),sGet(SK.fontScale)]);
      if(arts?.length) setAllArticles(arts);
      if(bfs) setBriefs(bfs);
      if(lf)  setLastFetch(lf);
      if(typeof fs==="number") setFontScale(fs);
      setStatusMsg(""); setStorageReady(true);
    })();
  },[]);

  useEffect(()=>{
    if(!storageReady) return;
    const stale=ALL_MARKET_SOURCES.filter(s=>!lastFetch[s.id]||(Date.now()-lastFetch[s.id])>STALE_MS);
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
      const toTranslate=fresh.filter(a=>a.lang!=="en"&&!a.translatedTitle);
      if(toTranslate.length) runAutoTranslate(merged,toTranslate);
      else setStatusMsg("");
      return merged;
    });
  },[]);


  const runAutoTranslate=useCallback(async(currentArticles,toTranslate)=>{
    setStatusMsg(`Translating ${toTranslate.length} non-English titles…`);
    const translated = await Promise.all(toTranslate.map(async a => {
      const lang = a.lang === "zh" ? "zh-CN" : a.lang;
      const t = await googleTranslate(a.title, lang);
      return { ...a, translatedTitle: t };
    }));
    setAllArticles(prev => {
      const updated = prev.map(a => { const t=translated.find(x=>x.id===a.id); return t?{...a,translatedTitle:t.translatedTitle}:a; });
      sSet(SK.articles, updated); return updated;
    });
    setStatusMsg("");
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
        const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.2;
        const translationOk = a.lang !== "en" && r.translated && !isCJK(r.translated);
        const shouldStore = translationOk ? r.translated : a.lang === "en" && r.translated && r.translated !== a.title ? r.translated : null;
        let resolvedSignal = r.signal || a.signal || "N";
        const cat = r.signalCategory || a.signalCategory || "OTHER";
        const isWeakness = r.weaknessContext === true || a.weaknessContext;
        const catMeta = SIGNAL_CATEGORIES[cat];
        if (catMeta?.mgmt && isWeakness) {
          const upgrade = { SP1:"SP2", N:"SN1", SN1:"SN2" };
          resolvedSignal = upgrade[resolvedSignal] || resolvedSignal;
        }
        const resolvedIsOpinion = r.isOpinion === true ? true : (r.isOpinion === false ? false : a.isOpinion);
        const resolvedOpinionCat = OPINION_MAP[r.opinionCategory] ? r.opinionCategory : a.opinionCategory;
        return {...a, translatedTitle:shouldStore||a.translatedTitle, insight:r.insight||a.insight, sector:r.sector||a.sector, signal:resolvedSignal, signalCategory:cat, weaknessContext:isWeakness, isOpinion:resolvedIsOpinion, opinionCategory:resolvedOpinionCat};
      });
      setAllArticles(working);
    }
    setStatusMsg("Cross-language dedup…");
    working=localDedup(working);
    const afterClaude=await claudeDedup(working);
    setAllArticles(afterClaude); sSet(SK.articles,afterClaude);
    setEnriching(false); setStatusMsg("");
  },[]);

  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const sortByDate = arts => [...arts].sort((a,b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    const db = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
    return db - da;
  });
  const isRecent = a => {
    const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    return t === 0 || (Date.now() - t) < FIVE_DAYS_MS;
  };
  const canonical = sortByDate(allArticles.filter(a => (showDupes||!a.duplicateOf) && isRecent(a)));
  const forSector=s=>s==="ALL"?canonical:canonical.filter(a=>a.sector===s);
  const sectorArts=forSector(activeSector);

  // ── Unified market scope: tier (DM/EM) → region → country ───────────────────
  const tierMarkets = MARKETS.filter(m=>activeTier==="ALL"||m.tier===activeTier);
  const availRegions = MARKET_REGIONS.filter(r=>tierMarkets.some(m=>m.region===r));
  const scopeCountries = tierMarkets.filter(m=>activeRegion==="ALL"||m.region===activeRegion);
  const scopeCodes = new Set(scopeCountries.map(m=>m.code));
  const countryArts = activeCountry!=="ALL"
    ? canonical.filter(a=>a.country===activeCountry)
    : (activeTier==="ALL"&&activeRegion==="ALL")
      ? canonical
      : canonical.filter(a=>scopeCodes.has(a.country));
  const scopeLabel = activeCountry!=="ALL"
    ? `${MARKET_MAP[activeCountry]?.flag||""} ${MARKET_MAP[activeCountry]?.label||activeCountry}`
    : activeRegion!=="ALL"
      ? `${activeRegion}${activeTier!=="ALL"?` · ${activeTier==="DM"?"Developed":"Emerging"}`:""}`
      : activeTier==="DM" ? "Developed Markets"
      : activeTier==="EM" ? "Emerging Markets"
      : "All Markets";
  const scopeFlag = activeCountry!=="ALL" ? (MARKET_MAP[activeCountry]?.flag||"🌐") : "🌐";
  const scopeKey = `market_${activeTier}_${activeRegion}_${activeCountry}`;

  const sourcesInView=ALL_MARKET_SOURCES.filter(s=>activeCountry!=="ALL"&&s.country===activeCountry);
  const sourceGroups=sourcesInView.map(s=>({s,arts:canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id)})).filter(g=>g.arts.length);
  const sectorGroups=MSCI_SECTORS.map(sec=>({sec,arts:canonical.filter(a=>a.sector===sec.code)})).filter(g=>g.arts.length).sort((a,b)=>b.arts.length-a.arts.length);
  const unenrichedArts=canonical.filter(a=>!a.sector);
  const sectorForActive=SECTOR_MAP[activeSector];
  const isLoading=Object.values(loading).some(Boolean);
  const dupeCount=allArticles.filter(a=>a.duplicateOf).length;
  const enrichedCount=allArticles.filter(a=>a.insight).length;
  const sectorCountsForCountry={};
  countryArts.forEach(a=>{if(a.sector)sectorCountsForCountry[a.sector]=(sectorCountsForCountry[a.sector]||0)+1;});
  const watchlistHits=canonical.filter(a=>a.watchMatches?.length>0).length;

  const WINDOW_OPTIONS = [
    { h:3, label:"3h" }, { h:6, label:"6h" }, { h:12, label:"12h" }, { h:24, label:"24h" }, { h:48, label:"48h" },
  ];
  const [windowHours, setWindowHours] = useState(12);
  const [signalFilter, setSignalFilter] = useState("ALL");
  const WINDOW_MS = windowHours * 60 * 60 * 1000;
  const breakingArts = (() => {
    const raw = canonical.filter(a => {
      const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
      return t > 0 && (Date.now() - t) < WINDOW_MS;
    }).sort((a,b) => worldScore(b) - worldScore(a)); // importance-first: geopolitics → oil → AI → Musk → source quality → recency
    const countPerSource = {}, countPerCountry = {};
    const MAX_PER_SOURCE = 4, MAX_PER_COUNTRY = 18;
    return raw.filter(a => {
      const ns=(countPerSource[a.sourceId]||0), nc=(countPerCountry[a.country]||0);
      if(ns>=MAX_PER_SOURCE||nc>=MAX_PER_COUNTRY) return false;
      countPerSource[a.sourceId]=ns+1; countPerCountry[a.country]=nc+1; return true;
    });
  })();

  const briefsTabArts = NEWS_BRIEF_GROUPS.flatMap(g =>
    canonical.filter(a => g.sources.includes(a.sourceId) || g.sources.includes(a.originalSourceId))
  );
  const briefsTabCount = briefsTabArts.length;

  const opinionCount = canonical.filter(a => resolveOpinion(a).isOpinion).length;

  const MAIN_TABS=[
    {id:"breaking",  label:`⚡ Breaking${breakingArts.length>0?` (${breakingArts.length})`:""}`},
    {id:"newsbriefs",label:`📰 Intel${briefsTabCount>0?` (${briefsTabCount})`:""}`},
    {id:"opinions",  label:`💬 Opinions${opinionCount>0?` (${opinionCount})`:""}`},
    {id:"markets",   label:"🌍 Markets"},
    {id:"watchlist", label:`◎ Watchlist${watchlistHits>0?` (${watchlistHits})`:""}`},
    {id:"filings",   label:"📋 Filings"},
  ];

  return (
    <FontScaleCtx.Provider value={fontScale}>
    <div style={{minHeight:"100vh",background:"#f5f0e8",color:"#1a1a1a",fontFamily:"'Spectral',Georgia,serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;font-family:'Spectral',Georgia,serif}
        button,select,input,textarea{font-family:'Spectral',Georgia,serif}
        @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        input{outline:none}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      <header style={{background:"#fff",borderBottom:"2px solid #1a1a1a",position:"sticky",top:0,zIndex:200}}>
        {/* Row 1: logo + controls */}
        <div style={{maxWidth:1500,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,padding:"0 24px"}}>
          <div style={{fontFamily:"'Spectral',serif",fontSize:21,color:"#1a1a1a",fontWeight:700,letterSpacing:"-0.03em",lineHeight:1,flexShrink:0}}>
            GLOBAL MARKETS
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:"0.25em",marginLeft:8,fontWeight:400,verticalAlign:"middle"}}>WIRE</span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            {/* Status indicator — always visible */}
            {(isLoading||enriching||statusMsg)&&(
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",display:"flex",alignItems:"center",gap:5}}>
                <Dots/><span style={{display:"none",["@media(min-width:600px)"]:{display:"inline"}}}>{statusMsg||"…"}</span>
              </span>
            )}

            {/* Refresh — always visible, primary action */}
            <HoverButton onClick={()=>fetchSources(ALL_MARKET_SOURCES)} disabled={isLoading||enriching}
              style={{...pillBtn,cursor:(isLoading||enriching)?"not-allowed":"pointer",opacity:(isLoading||enriching)?0.5:1}}>
              <span style={{display:"inline-block",animation:isLoading?"spin 1s linear infinite":"none"}}>⟳</span>
              <span>{isLoading?"refreshing…":"refresh"}</span>
            </HoverButton>

            {/* ··· overflow menu */}
            <OverflowMenu
              allArticles={allArticles}
              enrichedCount={enrichedCount}
              dupeCount={dupeCount}
              showDupes={showDupes}
              setShowDupes={setShowDupes}
              isLoading={isLoading}
              enriching={enriching}
              runEnrichment={runEnrichment}
              setAllArticles={setAllArticles}
              setBriefs={setBriefs}
              setLastFetch={setLastFetch}
              setStatusMsg={setStatusMsg}
              fontScale={fontScale}
              setFontScale={setFontScale}
            />
          </div>
        </div>

        {/* Row 2: scrollable tab bar */}
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderTop:"1px solid #f0ece4",
          scrollbarWidth:"none",msOverflowStyle:"none"}}
          // hide scrollbar visually but keep scroll behaviour
        >
          <style>{`::-webkit-scrollbar{display:none}`}</style>
          <div style={{display:"flex",padding:"0 16px",width:"max-content",minWidth:"100%"}}>
            {MAIN_TABS.map(({id,label})=>(
              <button key={id} onClick={()=>setMainTab(id)}
                style={{padding:"7px 12px",border:"none",background:"none",
                  color:mainTab===id?"#c0392b":"#555",
                  borderBottom:mainTab===id?"2px solid #c0392b":"2px solid transparent",
                  fontWeight:mainTab===id?600:400,
                  cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,
                  whiteSpace:"nowrap",transition:"all 0.15s",flexShrink:0}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* SUB-NAV */}
      {/* Unified markets filter — tier · region · country */}
      {mainTab==="markets"&&marketsView==="markets"&&(
        <div style={{background:"#fff",borderBottom:"1px solid #ddd",position:"sticky",top:88,zIndex:199}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px"}}>
            {/* Row 1: tier toggle + region chips */}
            <div style={{display:"flex",alignItems:"center",gap:10,overflowX:"auto",WebkitOverflowScrolling:"touch",padding:"7px 0",borderBottom:"1px solid #f0ece4"}}>
              <div style={{display:"flex",gap:2,background:"#f5f1e8",borderRadius:6,padding:2,flexShrink:0}}>
                {[{id:"ALL",label:"All Markets"},{id:"DM",label:"Developed"},{id:"EM",label:"Emerging"}].map(t=>{
                  const active=activeTier===t.id;
                  return (
                    <button key={t.id} onClick={()=>{
                      setActiveTier(t.id); setActiveCountry("ALL");
                      const tm=MARKETS.filter(m=>t.id==="ALL"||m.tier===t.id);
                      if(activeRegion!=="ALL"&&!tm.some(m=>m.region===activeRegion)) setActiveRegion("ALL");
                    }}
                      style={{padding:"5px 12px",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,whiteSpace:"nowrap",
                        background:active?"#c0392b":"none",color:active?"#fff":"#666",fontWeight:active?600:400,transition:"all 0.15s"}}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <span style={{color:"#ddd",flexShrink:0}}>│</span>
              {[{code:"ALL",label:"All Regions"},...availRegions.map(r=>({code:r,label:r}))].map(r=>{
                const active=activeRegion===r.code;
                return (
                  <button key={r.code} onClick={()=>{setActiveRegion(r.code);setActiveCountry("ALL");}}
                    style={{padding:"5px 10px",border:"none",background:"none",cursor:"pointer",flexShrink:0,
                      fontFamily:"'DM Mono',monospace",fontSize:11,whiteSpace:"nowrap",transition:"all 0.15s",
                      color:active?"#c0392b":"#8aa8bc",borderBottom:active?"2px solid #c9a84c":"2px solid transparent",fontWeight:active?600:400}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#8aa8bc"}}>
                    {r.label}
                  </button>
                );
              })}
            </div>
            {/* Row 2: country chips within scope */}
            <div style={{display:"flex",width:"max-content",minWidth:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {[{code:"ALL",label:`All ${activeRegion!=="ALL"?activeRegion:activeTier==="DM"?"Developed":activeTier==="EM"?"Emerging":"Markets"}`,flag:"🌐"},...scopeCountries].map(c=>{
                const cnt=c.code==="ALL"?countryArts.length:canonical.filter(a=>a.country===c.code).length;
                const active=activeCountry===c.code;
                return (
                  <button key={c.code} onClick={()=>setActiveCountry(c.code)}
                    style={{padding:"10px 13px",border:"none",background:"none",color:active?"#c0392b":"#8aa8bc",
                      borderBottom:active?"2px solid #c9a84c":"2px solid transparent",cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#8aa8bc"}}>
                    {c.flag} {c.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?"#fdecea":"#f0f0f0",color:active?"#c0392b":"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mainTab==="markets"&&marketsView==="sectors"&&(
        <div style={{background:"#fff",borderBottom:"1px solid #ddd",position:"sticky",top:88,zIndex:199,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px",display:"flex",width:"max-content",minWidth:"100%"}}>
            {[{code:"ALL",label:"All Sectors",icon:"▤",color:"#c0392b"},...MSCI_SECTORS].map(sec=>{
              const cnt=sec.code==="ALL"?canonical.length:canonical.filter(a=>a.sector===sec.code).length;
              const active=activeSector===sec.code;
              const col=sec.color||"#c0392b";
              return (
                <button key={sec.code} onClick={()=>setActiveSector(sec.code)}
                  style={{padding:"11px 13px",border:"none",background:"none",color:active?col:"#333",
                    borderBottom:active?`2px solid ${col}`:"2px solid transparent",cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                  onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                  onMouseOut={e=>{if(!active)e.currentTarget.style.color="#333"}}>
                  <span>{sec.icon||"▤"}</span> {sec.label}
                  {cnt>0&&<span style={{fontSize:8,background:active?`${col}18`:"#f0f0f0",color:active?col:"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{maxWidth:1500,margin:"0 auto",padding:"22px 24px"}}>

        {mainTab==="watchlist"&&<WatchlistTab allArticles={allArticles} setAllArticles={setAllArticles}/>}
        {mainTab==="filings"&&<FilingsTab />}
        {mainTab==="newsbriefs"&&<NewsBriefsTab canonical={canonical} briefs={briefs} setBriefs={setBriefs} generateBrief={generateBriefUnlimited} briefLoading={briefLoading} setBriefLoading={setBriefLoading} briefError={briefError} setBriefError={setBriefError}/>}
        {mainTab==="opinions"&&<OpinionsTab canonical={canonical} briefs={briefs} setBriefs={setBriefs} setAllArticles={setAllArticles} briefLoading={briefLoading} setBriefLoading={setBriefLoading} briefError={briefError} setBriefError={setBriefError}/>}
        {/* BREAKING / TODAY */}
        {mainTab==="breaking"&&(()=>{
          const briefKey="breaking";
          return (
            <div>
              <div style={{background:"#fff",border:"1px solid #e8e2d6",borderRadius:10,padding:"16px 18px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:20}}>⚡</span>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>BREAKING · {breakingArts.length} stories · last {windowHours}h{briefs[briefKey]?.generatedAt ? ` · generated ${new Date(briefs[briefKey].generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                      <div style={{fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Breaking News Intelligence</div>
                    </div>
                    <div style={{display:"flex",gap:4,marginLeft:8}}>
                      {WINDOW_OPTIONS.map(o=>(
                        <button key={o.h} onClick={()=>setWindowHours(o.h)}
                          style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"2px 7px",borderRadius:3,cursor:"pointer",
                            border:windowHours===o.h?"1px solid #c0392b":"1px solid #ddd",
                            background:windowHours===o.h?"#c0392b":"#fff",color:windowHours===o.h?"#fff":"#888"}}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={async()=>{
                      setBriefError(p=>({...p,[briefKey]:null}));
                      setBriefLoading(p=>({...p,[briefKey]:true}));
                      try {
                        const b=await generateWorldBriefing(breakingArts,"Breaking News",WORLD_BRIEF_CAP);
                        if(b.text) setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                        else setBriefError(p=>({...p,[briefKey]:"No briefing returned. Retry."}));
                      } catch(e){ console.warn("breaking brief failed:",e); setBriefError(p=>({...p,[briefKey]:humanizeBriefError(e)})); }
                      finally { setBriefLoading(p=>({...p,[briefKey]:false})); }
                    }}
                    disabled={briefLoading[briefKey]||breakingArts.length===0}
                    style={{fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",cursor:briefLoading[briefKey]||breakingArts.length===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:breakingArts.length===0?0.4:1}}
                    onMouseOver={e=>{if(!briefLoading[briefKey])e.currentTarget.style.background="#fdecea";}}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[briefKey]?<Dots color="#c0392b"/>:"✦ brief"}
                  </button>
                </div>
                {briefError[briefKey]&&!briefLoading[briefKey]&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",marginTop:-2,marginBottom:8}}>⚠ {briefError[briefKey]}</div>}
                {briefs[briefKey]&&(
                  <div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}>
                    <BriefRenderer
                      text={typeof briefs[briefKey]==="string"?briefs[briefKey]:briefs[briefKey]?.text}
                      articles={(() => { const stored=typeof briefs[briefKey]==="string"?null:briefs[briefKey]?.articles; return (stored&&stored.length>0)?stored:breakingArts; })()}
                    />
                  </div>
                )}
              </div>

              {breakingArts.length===0?(
                <div style={{textAlign:"center",color:"#888",fontFamily:"'DM Mono',monospace",fontSize:11,padding:40}}>no articles in the last {windowHours}h — try refreshing</div>
              ):(()=>{
                const signalFiltered = signalFilter==="ALL" ? breakingArts
                  : signalFilter==="MGMT" ? breakingArts.filter(a=>SIGNAL_CATEGORIES[a.signalCategory]?.mgmt)
                  : breakingArts.filter(a=>a.signal===signalFilter);
                const enrichedAny = breakingArts.some(a=>a.signal);
                return (
                  <div>
                    {enrichedAny && (
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12,padding:"8px 0",borderBottom:"1px solid #e8e2d6",alignItems:"center"}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",letterSpacing:"0.08em",marginRight:2}}>SIGNAL</span>
                        {[{id:"ALL",label:"All"},{id:"SP2",label:"▲▲ Strong +"},{id:"SP1",label:"▲ Positive"},{id:"SN1",label:"▽ Negative"},{id:"SN2",label:"▽▽ Strong −"},{id:"MGMT",label:"⚑ Management"}].map(f=>(
                          <button key={f.id} onClick={()=>setSignalFilter(f.id)}
                            style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"3px 9px",borderRadius:3,cursor:"pointer",transition:"all 0.15s",
                              border:signalFilter===f.id?`1px solid ${f.id==="SP2"?"#1b7a3e":f.id==="SP1"?"#2e7d32":f.id==="SN1"?"#b84a00":f.id==="SN2"?"#c0392b":f.id==="MGMT"?"#c9a84c":"#888"}`:"1px solid #ddd",
                              background:signalFilter===f.id?(f.id==="SP2"?"#1b7a3e":f.id==="SP1"?"#e6f4ec":f.id==="SN1"?"#fff3ee":f.id==="SN2"?"#c0392b":f.id==="MGMT"?"#fdf6e3":"#555"):"#fff",
                              color:signalFilter===f.id?(f.id==="SP2"||f.id==="SN2"||f.id==="ALL"?"#fff":f.id==="SP1"?"#1b7a3e":f.id==="SN1"?"#b84a00":f.id==="MGMT"?"#7a5c00":"#fff"):"#888"}}>
                            {f.label}
                          </button>
                        ))}
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#aaa",marginLeft:4}}>{signalFiltered.length} articles</span>
                      </div>
                    )}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,padding:"6px 0",borderBottom:"1px solid #e8e2d6"}}>
                      {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                        const n=signalFiltered.filter(a=>a.country===c.code).length;
                        return n?<span key={c.code} style={{fontSize:10,color:"#3a6080",fontFamily:"'DM Mono',monospace",background:"#f0f4f8",padding:"2px 6px",borderRadius:3}}>{c.flag} {n}</span>:null;
                      })}
                    </div>
                    {signalFiltered.length===0?(
                      <div style={{textAlign:"center",color:"#aaa",fontFamily:"'DM Mono',monospace",fontSize:11,padding:32}}>no {signalFilter!=="ALL"?signalFilter+" ":""}signals — enrich articles first</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {signalFiltered.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* MARKETS — Markets · Sectors · Sources */}
        {mainTab==="markets"&&(
          <>
            {/* Markets segmented control */}
            <div style={{display:"flex",marginBottom:18,background:"#fff",border:"1px solid #e8e2d6",borderRadius:8,overflow:"hidden"}}>
              {[
                {id:"markets",  label:"Markets"},
                {id:"sectors",  label:"Sectors"},
                {id:"sources",  label:"Sources"},
              ].map(v=>(
                <button key={v.id} onClick={()=>setMarketsView(v.id)}
                  style={{fontFamily:"'DM Mono',monospace",fontSize:11,padding:"9px 18px",border:"none",flex:1,
                    borderBottom:marketsView===v.id?"2px solid #c0392b":"2px solid transparent",
                    background:marketsView===v.id?"#fdecea":"none",
                    color:marketsView===v.id?"#c0392b":"#555",
                    fontWeight:marketsView===v.id?600:400,cursor:"pointer",transition:"all 0.15s"}}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Unified Markets */}
            {marketsView==="markets"&&(
              <>
                <BriefBox label={`${scopeFlag} ${scopeLabel} Overview`}
                  icon={scopeFlag}
                  briefKey={scopeKey} briefs={briefs} setBriefs={setBriefs} articles={countryArts}
                  loading={briefLoading} setLoading={setBriefLoading} generateBrief={generateBriefUnlimited}/>
                {Object.keys(sectorCountsForCountry).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
                    {MSCI_SECTORS.filter(s=>sectorCountsForCountry[s.code]).map(sec=>(
                      <button key={sec.code} onClick={()=>{setMarketsView("sectors");setActiveSector(sec.code);}}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:5,border:`1px solid ${sec.color}44`,background:`${sec.color}0d`,color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}
                        onMouseOver={e=>e.currentTarget.style.background=`${sec.color}22`}
                        onMouseOut={e=>e.currentTarget.style.background=`${sec.color}0d`}>
                        {sec.icon} {sec.label} ({sectorCountsForCountry[sec.code]})
                      </button>
                    ))}
                  </div>
                )}
                {countryArts.length===0?(
                  <div style={{textAlign:"center",padding:"80px 0",fontFamily:"'DM Mono',monospace",color:"#1a2a38",fontSize:13}}>
                    {isLoading?<><Dots/> fetching feeds…</>:"no articles — hit refresh"}
                  </div>
                ):activeCountry==="ALL"?(
                  <div style={{maxWidth:860,margin:"0 auto"}}>{countryArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}</div>
                ):(
                  <div style={{columns:"2 520px",columnGap:24}}>
                    {sourceGroups.map(({s,arts})=>(
                      <div key={s.id} style={{breakInside:"avoid",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:"1px solid #e8e2d6",marginBottom:1}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.06em"}}>{s.flag} {s.name.toUpperCase()}</span>
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

            {/* Emerging Markets */}

            {/* Sectors */}
            {marketsView==="sectors"&&(
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
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sec.color,letterSpacing:"0.1em",fontWeight:600}}>{sec.code} · {arts.length} stories{briefs[briefKey]?.generatedAt ? ` · generated ${new Date(briefs[briefKey].generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                                <div style={{fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>{sec.label}</div>
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
                            {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{const n=arts.filter(a=>a.country===c.code).length;return n?<span key={c.code} style={{fontSize:9,color:"#3a6080",fontFamily:"'DM Mono',monospace"}}>{c.flag}{n}</span>:null;})}
                          </div>
                          {arts.slice(0,4).map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                          {arts.length>4&&<button onClick={()=>setActiveSector(sec.code)} style={{fontSize:10,color:"#2a5a7a",background:"none",border:"none",cursor:"pointer",paddingTop:8,fontFamily:"'DM Mono',monospace"}}>+{arts.length-4} more →</button>}
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <>
                    <BriefBox label={`${sectorForActive?.icon} ${sectorForActive?.label} — Global Sector View`} icon={sectorForActive?.icon}
                      briefKey={`sector_${activeSector}`} briefs={briefs} setBriefs={setBriefs} articles={sectorArts}
                      loading={briefLoading} setLoading={setBriefLoading} generateBrief={generateBriefUnlimited}/>
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

            {/* Sources */}
            {marketsView==="sources"&&<SourcesTab canonical={canonical} lastFetch={lastFetch} briefs={briefs} setBriefs={setBriefs} generateBrief={generateBriefUnlimited}/>}
          </>
        )}
      </div>

      <footer style={{borderTop:"1px solid #ddd",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>{ALL_MARKET_SOURCES.length} sources · {MARKETS.length} markets · {MSCI_SECTORS.length} GICS sectors</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>persisted locally · stale threshold 45 min</span>
      </footer>
    </div>
    </FontScaleCtx.Provider>
  );
}
