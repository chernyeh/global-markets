import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { MSCI_SECTORS, SECTOR_MAP, SIGNAL_META, SIGNAL_CATEGORIES, WEAKNESS_CONTEXT_PATTERNS, BRIEF_CATEGORY_WEIGHT, SIGNAL_STRENGTH, BRIEF_COUNTRY_BOOST, BRIEF_COUNTRY_PENALTY, BRIEF_BOOSTED_COUNTRIES, BRIEF_PENALISED_COUNTRIES, WORLD_TOPIC_WEIGHTS } from "./data/taxonomy.js";
import { GN, NEWS_BRIEF_GROUPS, SOURCES, EM_SOURCES, ALL_MARKET_SOURCES, SOURCE_TIER_MAP } from "./data/sources.js";
import { COUNTRIES, EM_COUNTRIES, MARKET_REGIONS, MARKETS, MARKET_MAP } from "./data/markets.js";
import { BRIEF_FORMAT, BRIEF_RULES, WORLD_FORMAT, WORLD_RULES } from "./prompts.js";
import { mono, RED, labelSm, labelMed, pillBtn, card, HoverButton } from "./ui.jsx";

const FontScaleCtx = createContext(1);
const FONT_SCALES = [
  { id:"compact", label:"A", scale:0.85 },
  { id:"normal",  label:"A", scale:1.0  },
  { id:"large",   label:"A", scale:1.2  },
];

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
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SK = {
  articles:  "gm_arts_v4",
  summaries: "gm_briefs_v4",
  lastFetch: "gm_fetch_v4",
  watchlist: "gm_watch_v4",
  watchHits: "gm_watchhits_v4",
  fontScale: "gm_fontscale_v1",
};
const EM_SK = {
  clusterState: "gm_em_cluster_v1",
  lastFetch:    "gm_em_fetch_v1",
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
      ];
      if (JUNK_PATTERNS.some(p => p.test(title))) return null;
      return {
        id: btoa(encodeURIComponent(title.slice(0,60))).replace(/[^a-zA-Z0-9]/g,"").slice(0,20),
        title,
        description: g("description").replace(/<[^>]+>/g,"").replace(/<!\[CDATA\[|\]\]>/g,"").trim().slice(0,260),
        link: g("link")||g("guid"),
        pubDate: g("pubDate")||g("dc:date")||"",
        source: source.name, sourceId: source.id,
        country: source.country, flag: source.flag, lang: source.lang,
        fetchedAt: Date.now(),
        translatedTitle: null, insight: null, sector: null, signal: null, signalCategory: null, weaknessContext: false, duplicateOf: null, isMicro: classifyMicro(title),
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
const MICRO_KEYWORDS = /\b(earnings|revenue|profit|loss|EPS|guidance|dividend|buyback|repurchase|acquisition|merger|takeover|IPO|listing|delisting|CEO|CFO|CTO|appoint|resign|downgrade|upgrade|target price|analyst|price target|beat|miss|outlook|forecast|results|quarterly|annual report|rights issue|placement|disposal|stake|JV|joint venture|contract|deal|award|tender|lawsuit|settlement|fine|penalty|recall|bankruptcy|restructur|spinoff|spin-off|demerger|rights offer|AGM|EGM|shareholder|insider|buyout|LBO|PE fund|privatisation|privatization|delist|default|impairment|writedown|write-off|capex|guidance|raise|cut|lifted|lowered|reaffirm|initiat|reiterat)\b/i;
function classifyMicro(title) {
  return MICRO_KEYWORDS.test(title);
}
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
// CLAUDE API HELPER
// ═══════════════════════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Exponential backoff with jitter; honours a Retry-After header when present.
function backoff(attempt, res) {
  const base = 600 * Math.pow(2, attempt);
  const jitter = Math.random() * 300;
  const ra = res && Number(res.headers?.get?.("retry-after"));
  return (ra ? ra * 1000 : 0) + base + jitter;
}

// Bounded-concurrency map that preserves input order in the result array.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// callClaude always returns a string on success. By default it swallows errors
// and returns "" (legacy callers JSON.parse the result and have their own
// fallbacks). Pass { throwOnError:true } to surface failures to the UI.
async function callClaude(prompt, maxTokens=2000, opts={}) {
  const { timeoutMs=45000, retries=2, throwOnError=false } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }]
        })
      });
      clearTimeout(timer);

      // Retryable upstream errors: rate limit, overload, 5xx (incl. Vercel 504).
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        lastErr = new Error(`api_${res.status}`);
        if (attempt < retries) { await sleep(backoff(attempt, res)); continue; }
        if (throwOnError) throw lastErr;
        return "";
      }

      const data = await res.json();
      if (data?.type === "error" || data?.error) {
        lastErr = new Error(data?.error?.message || "api_error");
        if (attempt < retries) { await sleep(backoff(attempt)); continue; }
        if (throwOnError) throw lastErr;
        return "";
      }

      const text = data.content?.[0]?.text;
      if (typeof text !== "string") {
        if (throwOnError) throw new Error("empty_response");
        return "";
      }
      return text;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // Timeouts (AbortError) have already consumed the budget — don't retry.
      if (attempt < retries && e.name !== "AbortError") { await sleep(backoff(attempt)); continue; }
      if (throwOnError) throw lastErr;
      return "";
    }
  }
  if (throwOnError) throw lastErr;
  return "";
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
Each item: {"translated":"<English title>","insight":"<one sentence investor takeaway>","sector":"<sector code>","signal":"<signal code>","signalCategory":"<category code>","weaknessContext":<true|false>}
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


async function generateBriefUnlimited(articles, label, coveragePriority=null, maxArticles=null, weightCountries=false) {
  if (!articles.length) return {text:"", articles:[]};

  // Rank by conviction, drop noise, then cap (master brief) — best signals first.
  let ranked = rankBriefArticles(articles, weightCountries);
  if (!ranked.length) ranked = articles;
  if (maxArticles && ranked.length > maxArticles) ranked = ranked.slice(0, maxArticles);
  articles = ranked;
  const sourceArticles = articles;

  const DEFAULT_PRIORITY = "COVERAGE PRIORITY: When two items are equally actionable, prefer US and China, then Europe (UK, Germany, France, Italy, Switzerland, pan-European), then HK, Korea, Taiwan, Australia, Israel, Middle East, Iran, then Singapore and Canada. Mention Indian stories briefly unless they carry clear global or sector impact.";
  const effectivePriority = coveragePriority || DEFAULT_PRIORITY;

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
    const text = await callClaude(prompt, 8000, {throwOnError:true, timeoutMs:90000});
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
  const text = await callClaude(synthPrompt, 8000, {throwOnError:true, timeoutMs:90000});
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

Items (cite using [REF:N] at end of each bullet, N = item number):
${arts.map((a,i)=>fmtWorldArticle(a,i)).join("\n")}`;
    const text = await callClaude(prompt, 8000, {throwOnError:true, timeoutMs:90000});
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
- The summaries carry [Country] tags and item numbers in parentheses, e.g. "(item 3)" — use those numbers for [REF:N] citations.

Summaries to synthesise:
${goodSummaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, 8000, {throwOnError:true, timeoutMs:90000});
  return {text, articles: sourceArticles, generatedAt: Date.now()};
}
// ═══════════════════════════════════════════════════════════════════════════════
function directMatch(art, keyword) {
  const kw = keyword.toLowerCase();
  const text = `${art.translatedTitle||art.title} ${art.description||""} ${art.insight||""}`.toLowerCase();
  return text.includes(kw);
}

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
  const fontScale = useContext(FontScaleCtx);
  const sec = art.sector ? SECTOR_MAP[art.sector] : null;
  const sigMeta   = art.signal ? SIGNAL_META[art.signal] : null;
  const catMeta   = art.signalCategory ? SIGNAL_CATEGORIES[art.signalCategory] : null;
  const isMgmt    = catMeta?.mgmt === true;
  const isStrong  = art.signal === "SP2" || art.signal === "SN2";
  const isWeakCtx = art.weaknessContext === true;
  const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.25;
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

function findLinksForBullet(bulletText, articles) {
  if (!articles?.length || !bulletText) return [];
  const refMatch = bulletText.match(/\[REF:([\d,\s]+)\]/);
  if (refMatch) {
    const indices = refMatch[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    return indices.map(i=>articles[i]).filter(Boolean);
  }
  const words = bulletText.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>4);
  return articles
    .map(a=>{
      const haystack=((a.translatedTitle||a.title)+" "+(a.source||"")).toLowerCase();
      const hits=words.filter(w=>haystack.includes(w)).length;
      return {art:a,score:hits};
    })
    .filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.art);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK QUOTE HELPERS — Yahoo Finance links + 1-day price performance
// ═══════════════════════════════════════════════════════════════════════════════
const QUOTE_CACHE = {};
const QUOTE_TTL = 5 * 60 * 1000;

const SKIP_TICKERS = new Set([
  "REF","US","EU","UK","HK","JP","CN","KR","TW","IN","AU","DE","SG","CA","IL","IR","ME",
  "USD","EUR","GBP","JPY","CNY","SGD","HKD","AUD","CAD","KRW","TWD","INR","SAR","AED",
  "GDP","CEO","CFO","CTO","IPO","ETF","ESG","AI","API","EPS","QOQ","YOY","MOM","PE",
  "FED","ECB","IMF","BOJ","RBI","MAS","PBOC","BOK","RBA","BOC","SNB","BOE",
  "NYSE","NASDAQ","HKEX","SGX","TSE","KSE","ASX","BSE","NSE","LSE",
  "OPEC","NATO","UN","WTO","BIS","SWIFT","G7","G20","ASEAN","GCC",
]);

function extractTickers(text) {
  const re = /\(([A-Z0-9][A-Z0-9.-]{1,8})\)/g;
  const found = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[1];
    if (!SKIP_TICKERS.has(t)) found.add(t);
  }
  return [...found];
}

async function fetchQuotes(tickers) {
  if (!tickers.length) return {};
  const now = Date.now();
  const needFetch = tickers.filter(t => !QUOTE_CACHE[t] || now - QUOTE_CACHE[t].ts > QUOTE_TTL);
  const fromCache = Object.fromEntries(
    tickers
      .filter(t => QUOTE_CACHE[t] && now - QUOTE_CACHE[t].ts <= QUOTE_TTL)
      .map(t => [t, QUOTE_CACHE[t].data])
  );
  if (!needFetch.length) return fromCache;
  try {
    const r = await fetch(`/api/quote?symbols=${encodeURIComponent(needFetch.join(","))}`);
    if (!r.ok) return fromCache;
    const data = await r.json();
    const results = data?.quoteResponse?.result ?? [];
    const fresh = {};
    for (const q of results) {
      const pct = q.regularMarketChangePercent;
      fresh[q.symbol] = { pct: typeof pct === "number" ? pct : null };
      QUOTE_CACHE[q.symbol] = { data: fresh[q.symbol], ts: now };
    }
    // Mark tickers Yahoo didn't recognise so we don't retry until TTL
    for (const t of needFetch) {
      if (!(t in fresh)) {
        fresh[t] = null;
        QUOTE_CACHE[t] = { data: null, ts: now };
      }
    }
    return { ...fromCache, ...fresh };
  } catch {
    return fromCache;
  }
}

// Wraps "Company Name (TICKER)" occurrences with a Yahoo Finance link + price badge
function renderTickers(text, quotes, baseKey = "") {
  if (!text || quotes === null) return text;
  // Company name: title-case words (each word starts with capital); ticker: 2–9 uppercase/numeric chars
  const re = /([A-Z][A-Za-z0-9.,&'-]{0,}(?:\s+[A-Z][A-Za-z0-9.,&'-]*){0,4})\s+\(([A-Z0-9][A-Z0-9.-]{1,8})\)/g;
  const nodes = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    const [full, company, ticker] = m;
    if (SKIP_TICKERS.has(ticker)) continue;
    const quote = quotes[ticker];
    if (quote === undefined) continue; // not in Yahoo Finance response
    const pct = quote?.pct;
    const yahooUrl = `https://finance.yahoo.com/quote/${ticker}/`;
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span key={`${baseKey}-${m.index}`} style={{whiteSpace:"nowrap"}}>
        <a href={yahooUrl} target="_blank" rel="noopener noreferrer"
          style={{color:"inherit",textDecoration:"underline",textDecorationColor:"#b0b0b0",textUnderlineOffset:"2px"}}>
          {company}
        </a>
        {" "}
        <span style={{
          color: pct == null ? "#999" : pct >= 0 ? "#2e7d32" : "#c0392b",
          fontWeight: 700,
          fontSize: "0.85em",
        }}>
          ({pct == null ? ticker : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`})
        </span>
      </span>
    );
    last = m.index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

// Handles **bold** markers AND ticker links in inline text
function renderInline(text, quotes, baseKey = "") {
  if (!text || quotes === null) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  if (parts.length === 1) return renderTickers(text, quotes, baseKey);
  return parts.flatMap((part, pi) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={`${baseKey}-b${pi}`} style={{color:"#1a1a1a"}}>{renderTickers(part.slice(2,-2), quotes, `${baseKey}-b${pi}`)}</strong>];
    }
    return renderTickers(part, quotes, `${baseKey}-p${pi}`);
  });
}

function BriefRenderer({text, articles=[]}) {
  const fontScale = useContext(FontScaleCtx);
  const [quotes, setQuotes] = useState(null);
  useEffect(() => {
    if (!text) return;
    const tickers = extractTickers(text);
    if (!tickers.length) { setQuotes({}); return; }
    fetchQuotes(tickers).then(setQuotes);
  }, [text]);

  if (!text) return null;
  const rawLines = text.split("\n");
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t === "---" || t === "***" || t === "___") continue;
    if (/^\*\*[^*]+\*\*:?$/.test(t) && !t.startsWith("- ") && !t.startsWith("* ")) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j].trim()) j++;
      const next = rawLines[j]?.trim() || "";
      if (next && !next.startsWith("#") && !next.startsWith("- ") && !next.startsWith("* ") && !next.startsWith("**")) {
        lines.push(t + "\n" + next);
        i = j;
        continue;
      }
    }
    lines.push(rawLines[i]);
  }
  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:14,marginTop:4}}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{height:6}}/>;
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(13*fontScale),
              fontWeight:700,color:"#8B4513",margin:"22px 0 10px",
              textTransform:"uppercase",letterSpacing:"0.1em",
              borderBottom:"2px solid #e0d8cc",paddingBottom:6}}>
              {trimmed.replace(/^## /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <div key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(16*fontScale),
              fontWeight:700,color:"#1a1a1a",margin:"4px 0 14px",lineHeight:1.3}}>
              {trimmed.replace(/^# /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const txt = trimmed.replace(/^[-*] /,"");
          const cleanTxt = txt.replace(/\[REF:[\d,\s]+\]/g, "").trim();
          const boldMatch = cleanTxt.match(/^\*\*(.+?)\*\*:?\s*(.*)/s);
          const links = findLinksForBullet(txt, articles);
          return (
            <div key={i} style={{display:"flex",gap:8,margin:"8px 0",paddingLeft:8,alignItems:"flex-start"}}>
              <span style={{color:"#c0392b",fontWeight:700,marginTop:2,flexShrink:0,fontSize:Math.round(16*fontScale)}}>•</span>
              <span style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(14*fontScale),color:"#1a1a1a",lineHeight:1.7}}>
                {boldMatch
                  ? <><strong style={{color:"#1a1a1a"}}>{renderTickers(boldMatch[1], quotes, `${i}-b`)}</strong>{boldMatch[2] ? <>{": "}{renderInline(boldMatch[2], quotes, `${i}-r`)}</> : ""}</>
                  : renderInline(cleanTxt, quotes, `${i}-t`)}
                {links.map((a,li) => {
                  const src = SOURCES.find(s=>s.id===a.sourceId);
                  const isPaywall = src?.paywall;
                  const rawName = src?.name || a.source || "LINK";
                  const shortName = rawName.split(" ").slice(0,2).join(" ").slice(0,14);
                  const bg = isPaywall ? "#6b6b6b" : "#2a6a4a";
                  const bgHover = isPaywall ? "#444" : "#1a4a32";
                  return (
                    <a key={li} href={a.link} target="_blank" rel="noopener noreferrer"
                      title={`${rawName}${isPaywall?" (paywalled)":""}`}
                      style={{display:"inline-flex",alignItems:"center",gap:3,marginLeft:6,
                        padding:"2px 7px",background:bg,color:"#fff",borderRadius:3,
                        fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:600,
                        textDecoration:"none",letterSpacing:"0.03em",verticalAlign:"middle",
                        transition:"background 0.15s"}}
                      onMouseOver={e=>e.currentTarget.style.background=bgHover}
                      onMouseOut={e=>e.currentTarget.style.background=bg}>
                      {isPaywall && <span style={{fontSize:8,opacity:0.85}}>🔒</span>}
                      {shortName}
                    </a>
                  );
                })}
              </span>
            </div>
          );
        }
        const mergedMatch = trimmed.match(/^\*\*([^*]+)\*\*:?\n([\s\S]+)$/);
        // Strip [REF:N] citation markers from plain paragraphs (exec summary, risk sections)
        const cleanPara = trimmed.replace(/\[REF:[\d,\s]+\]/g, "").trim();
        return (
          <p key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(14*fontScale),
            color:"#1a1a1a",lineHeight:1.7,margin:"10px 0",
            background:"#f0ece4",padding:"14px 18px",borderRadius:4}}>
            {mergedMatch
              ? <><strong>{renderTickers(mergedMatch[1].replace(/\[REF:[\d,\s]+\]/g,"").trim(), quotes, `${i}-mb`)}</strong>{": "}{renderInline(mergedMatch[2].replace(/\[REF:[\d,\s]+\]/g,"").trim(), quotes, `${i}-mr`)}</>
              : renderInline(cleanPara, quotes, `${i}-p`)
            }
          </p>
        );
      })}
    </div>
  );
}


function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading}) {
  const briefData=briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);
  const briefArts = briefData?.articles ?? articles;
  const generatedAt = briefData?.generatedAt ?? null;
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    try {
      const b=await generateBriefUnlimited(articles,label,null,150);
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


// ═══════════════════════════════════════════════════════════════════════════════
// OVERFLOW MENU — ··· button with dropdown for secondary header actions
// ═══════════════════════════════════════════════════════════════════════════════
function OverflowMenu({allArticles, enrichedCount, dupeCount, showDupes, setShowDupes,
                       isLoading, enriching, runEnrichment, setAllArticles,
                       setBriefs, setLastFetch, setStatusMsg, SK,
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


// ═══════════════════════════════════════════════════════════════════════════════
// REGULATORY FILINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
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

function FilingsTab() {
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


// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST TAB
// ═══════════════════════════════════════════════════════════════════════════════
function WatchlistTab({allArticles, setAllArticles}) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES TAB
// ═══════════════════════════════════════════════════════════════════════════════
const SOURCE_RANK = {
  US: ["reuters","bloomberg","bloomberg2","wsj","wsj2","wsj_heard","wsj_mkt","wsj_global_equities","wsj_global_commodities","ft","wapo","wapo_politics","nyt","barrons","marketwatch","axios_biz","semafor","politico","benzinga_upgrades","benzinga_downgrades","benzinga_pt","benzinga_initiation","sa_wsb","sa_currents","ft_alphaville","investing_ratings","openinsider","benzinga_ideas","seekalpha","prnewswire"],
  GB: ["reuters_uk","bloom_uk","cityam","investors_chron","telegraph_biz","thisismoney"],
  DE: ["reuters_de","bloom_de","handelsblatt","handelsblatt_en","faz","faz_finance","spiegel_de","sz_de","dw_de"],
  FR: ["reuters_fr","bloom_fr","lesechos","lesechos_en"],
  IT: ["reuters_it","bloom_it","sole24ore"],
  CH: ["reuters_ch","bloom_ch","nzz","nzz_en"],
  EU: ["reuters_eu","bloom_eu","politico_eu","euractiv"],
  CA: ["reuters_ca","bloom_ca","globe_mail","globe_itm","stockchase","fin_post","bnn"],
  SG: ["reuters_sg","bloom_sg","bt_sg","bt_stocks_watch","edge_sg_stocks_watch","edge_sg_focus","sginvestors","edge_sg","cna_sg","sgx_annc","sg_biz_review"],
  HK: ["reuters_hk","bloom_hk","asia_broker_calls","reuters_asia","hkex_news","scmp","scmp_markets","scmp_china","mingtiandi","aastocks_hk","etnet_hk","hket","mingpao"],
  KR: ["reuters_kr","bloom_kr","kr_analyst_calls","kr_herald","yonhap","yonhap2","ktimes","ked","hankyung","maeil","chosunbiz"],
  TW: ["reuters_tw","bloom_tw","focus_tw","taipei_t","digitimes","udn_money","ctee"],
  IN: ["reuters_in","bloom_in","econ_times","mint","mint2","mint3","biz_std","hindubiz","fin_exp","cnbctv18","moneyctrl","forbes_in"],
  AU: ["reuters_au","bloom_au","afr","afr_street_talk","market_herald","smh","abc_au","stockhead_top10","fnarena","stockhead_au","guardian_au","the_aus"],
  CN: ["reuters_cn","bloom_cn","xinhua","cgtn","chinadaily","caixin","caixin_briefs","kr36","globaltimes","yicai","peoples_d"],
  IL: ["globes_il","reuters_il","bloom_il","jpost_il","toi_il","haaretz_il","ctech_il","calcalist"],
  ME: ["aljazeera","aljazeera_biz","reuters_me","bloom_me","arabnews","arabnews_biz","national_ae","gulfnews","arabianbiz","agbi","tradearabia","alarabiya","zawya","gulfbiz","gulftimes","khaleej","saudigazette","menafn_sa","menafn_uae","menafn_qa","menafn_kw","menafn_bh","menafn_om","alarabiya_ar"],
  IR: ["iranintl","reuters_ir","bloom_ir","tehrantimes","fin_trib","irna_en","tasnim","ifpnews","mehrnews","entekhab","tabnak"],
  JP: ["reuters_jp","nikkei_asia","nikkei_biz_spotlight","jp_analyst_calls"],
  // Emerging Markets
  BR: ["reuters_br","infomoney","valor_br","reuters_latam","mercopress","bnnlatam"],
  MX: ["reuters_mx","elfinanciero_mx","reuters_latam"],
  AR: ["reuters_ar","ambito","mercopress","reuters_latam"],
  CL: ["reuters_cl","df_cl","reuters_latam"],
  CO: ["reuters_co","la_republica_co","reuters_latam"],
  PE: ["reuters_pe","gestion_pe","reuters_latam"],
  PL: ["reuters_pl","parkiet_pl","emerging_europe","reuters_cee"],
  TR: ["reuters_tr","daily_sabah_biz","hurriyet_biz","reuters_cee"],
  HU: ["reuters_hu","reuters_cee","emerging_europe"],
  CZ: ["reuters_cz","reuters_cee","emerging_europe"],
  RO: ["reuters_ro","reuters_cee","emerging_europe"],
  GR: ["reuters_gr","ekathimerini","reuters_cee"],
  ZA: ["reuters_za","fin24_za","businessday_za","reuters_africa","african_business"],
  NG: ["reuters_ng","businessday_ng","punch_biz_ng","reuters_africa"],
  KE: ["reuters_ke","businessdailyafrica","reuters_africa"],
  EG: ["reuters_eg","egypt_independent","reuters_africa"],
  MA: ["reuters_ma","reuters_africa"],
  ID: ["reuters_id","bisnis_id","reuters_emasia","nikkei_sea"],
  TH: ["reuters_th","bangkokpost_biz","reuters_emasia"],
  MY: ["reuters_my","edge_my","reuters_emasia"],
  PH: ["reuters_ph","inquirer_ph","reuters_emasia"],
  VN: ["reuters_vn","vnexpress_biz","reuters_emasia"],
};

function SourcesTab({canonical, lastFetch, briefs, setBriefs}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[1].code);
  const [selectedSource,  setSelectedSource]  = useState("ALL");
  const [selectedTier,    setSelectedTier]    = useState(0);
  const [briefLoading,    setBriefLoading]    = useState({});
  const TIER_COLORS = {1:"#2e7d32", 2:"#1565c0", 3:"#6a1b9a"};

  const ALL_SOURCES = [...SOURCES, ...EM_SOURCES];
  const countryObj   = COUNTRIES.find(c => c.code === selectedCountry) || EM_COUNTRIES.find(c => c.code === selectedCountry);
  const rankOrder    = SOURCE_RANK[selectedCountry] || [];
  const allCountrySources = ALL_SOURCES.filter(s => s.country === selectedCountry);
  const rankedSources = [
    ...rankOrder.map(id => allCountrySources.find(s => s.id === id)).filter(Boolean),
    ...allCountrySources.filter(s => !rankOrder.includes(s.id)),
  ];
  const tierFilteredSources = selectedTier === 0 ? rankedSources : rankedSources.filter(s => (s.tier||3) === selectedTier);
  const visibleSources = selectedSource === "ALL" ? tierFilteredSources : tierFilteredSources.filter(s => s.id === selectedSource);
  const countryArts = canonical.filter(a => a.country === selectedCountry);
  const briefKey = `sources_country_${selectedCountry}`;
  const briefData = briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData === "string" ? briefData : null);
  const briefArts = briefData?.articles ?? countryArts;

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"12px 18px",flexWrap:"wrap"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>COUNTRY</span>
        <div style={{position:"relative"}}>
          <select value={selectedCountry} onChange={e=>{setSelectedCountry(e.target.value);setSelectedSource("ALL");}}
            style={{appearance:"none",background:"#fff",border:"1px solid #c0392b",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:180}}>
            <optgroup label="Developed Markets">
              {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>(<option key={c.code} value={c.code}>{c.flag} {c.label}</option>))}
            </optgroup>
            <optgroup label="Emerging Markets">
              {EM_COUNTRIES.map(c=>(<option key={c.code} value={c.code}>{c.flag} {c.label}</option>))}
            </optgroup>
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#c0392b",fontSize:10}}>▼</span>
        </div>
        <div style={{display:"flex",gap:4,marginLeft:4,flexWrap:"wrap"}}>
          {[0,1,2,3].map(t=>(
            <button key={t} onClick={()=>{setSelectedTier(t);setSelectedSource("ALL");}}
              style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:3,cursor:"pointer",
                border: selectedTier===t ? `1px solid ${t===0?"#888":TIER_COLORS[t]}` : "1px solid #ddd",
                background: selectedTier===t ? (t===0?"#888":TIER_COLORS[t]) : "#fff",
                color: selectedTier===t ? "#fff" : "#888"}}>
              {t===0?"All tiers":`T${t}`}
            </button>
          ))}
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap",marginLeft:8}}>SOURCE</span>
        <div style={{position:"relative"}}>
          <select value={selectedSource} onChange={e=>setSelectedSource(e.target.value)}
            style={{appearance:"none",background:"#fff",border:"1px solid #bbb",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:200}}>
            <option value="ALL">All sources ({rankedSources.length})</option>
            {rankedSources.map((s,i)=>(<option key={s.id} value={s.id}>#{i+1} {s.name} ({canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id).length})</option>))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",marginLeft:4}}>
          <span style={{color:"#c0392b",fontWeight:600}}>{countryArts.length}</span> articles
        </span>
        <button onClick={async()=>{
            setBriefLoading(p=>({...p,[briefKey]:true}));
            const b = await generateBriefUnlimited(countryArts, `${countryObj?.flag} ${countryObj?.label} Markets`);
            setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
            setBriefLoading(p=>({...p,[briefKey]:false}));
          }}
          disabled={briefLoading[briefKey]||!countryArts.length}
          style={{marginLeft:"auto",padding:"7px 16px",background:brief?"none":"#fdecea",border:"1px solid #c0392b",color:"#c0392b",borderRadius:6,cursor:(!countryArts.length)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,opacity:!countryArts.length?0.4:1,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background=brief?"none":"#fdecea"}>
          {briefLoading[briefKey] ? <><Dots/> generating…</> : brief ? "↺ refresh brief" : "✦ generate country brief"}
        </button>
      </div>
      {brief && (
        <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em",marginBottom:2}}>AI INVESTMENT BRIEF · {countryArts.length} articles analysed{briefData?.generatedAt ? ` · generated ${new Date(briefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
          <BriefRenderer text={brief} articles={briefArts}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {visibleSources.map((src, idx)=>{
          const arts = canonical.filter(a=>a.sourceId===src.id||a.originalSourceId===src.id);
          const rank = rankOrder.indexOf(src.id);
          const rankLabel = rank >= 0 ? `#${rank+1}` : null;
          return (
            <div key={src.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"14px 16px",borderTop:`3px solid ${rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#ddd"}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #f0ece4"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  {rankLabel&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#999",fontWeight:700,background:rank<3?"#fafafa":"none",padding:"1px 5px",borderRadius:3,border:"1px solid #eee"}}>{rankLabel}</span>}
                  <div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#c0392b",fontWeight:600,letterSpacing:"0.04em"}}>{src.flag} {src.name}</span>
                    {src.desc&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",marginTop:2,lineHeight:1.4,maxWidth:460}}>{src.desc}</div>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  {lastFetch[src.id]&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#aaa"}}>{timeAgo(lastFetch[src.id])}</span>}
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f5f5f5",padding:"2px 7px",borderRadius:10}}>{arts.length}</span>
                </div>
              </div>
              {arts.length===0?<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#bbb",padding:"12px 0",textAlign:"center"}}>no recent articles</div>:(
                <>
                  {src.paywall&&arts.some(a=>a.originalSourceId===src.id)&&(
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f9f6f0",border:"1px solid #e8e0d0",borderRadius:4,padding:"5px 10px",marginBottom:8}}>
                      ✦ includes free versions of {src.name} stories from other outlets
                    </div>
                  )}
                  {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS BRIEFS TAB
// ═══════════════════════════════════════════════════════════════════════════════
// Maps a generation failure to a short, human-readable message for the UI.
function humanizeBriefError(e) {
  const m = e?.message || "";
  if (m === "AbortError" || e?.name === "AbortError") return "Timed out — try again.";
  if (m.includes("429")) return "Rate limited — retry shortly.";
  if (m.includes("529")) return "Service busy — retry shortly.";
  if (m === "empty_response") return "No briefing returned. Retry.";
  return "Couldn't generate briefing. Retry.";
}

// Cap the master brief so the all-articles synthesis stays fast and within the
// upstream time budget. Articles are already ordered by recency/priority.
const MASTER_CAP = 150;

function NewsBriefsTab({canonical, briefs, setBriefs}) {
  const [briefLoading, setBriefLoading] = useState({});
  const [briefError, setBriefError] = useState({});
  const mono = { fontFamily:"'DM Mono',monospace" };

  // Compute articles for each market group
  const groupArts = (group) =>
    canonical.filter(a => group.sources.includes(a.sourceId) || group.sources.includes(a.originalSourceId));

  // Master brief spans ALL markets (developed + emerging). generateBriefUnlimited
  // ranks by signal and keeps the top company-relevant stories, so feeding the full
  // deduplicated pool surfaces the strongest company news across every market.
  const allBriefArts = canonical;
  const masterBriefKey = "newsbriefs_master";

  const generateGroupBrief = async (group) => {
    const key = `newsbriefs_${group.market}`;
    const arts = groupArts(group);
    if (!arts.length) return;
    setBriefError(p=>({...p,[key]:null}));
    setBriefLoading(p=>({...p,[key]:true}));
    try {
      const b = await generateBriefUnlimited(arts, `${group.flag} ${group.market} Company News`);
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
      const b = await generateBriefUnlimited(allBriefArts, "Global Company News Briefs", masterPriority, MASTER_CAP, true);
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
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📰</span>
            <div>
              <div style={{...mono,fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>GLOBAL NEWS BRIEFS · {allBriefArts.length>MASTER_CAP ? `top ${MASTER_CAP} by signal of ${allBriefArts.length}` : `${allBriefArts.length}`} articles{masterBriefData?.generatedAt ? ` · generated ${new Date(masterBriefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
              <div style={{fontFamily:"'Spectral',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Company News Intelligence</div>
            </div>
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
        return {...a, translatedTitle:shouldStore||a.translatedTitle, insight:r.insight||a.insight, sector:r.sector||a.sector, signal:resolvedSignal, signalCategory:cat, weaknessContext:isWeakness};
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

  const MAIN_TABS=[
    {id:"breaking",  label:`⚡ Today${breakingArts.length>0?` (${breakingArts.length})`:""}`},
    {id:"newsbriefs",label:`📰 Intel${briefsTabCount>0?` (${briefsTabCount})`:""}`},
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
              SK={SK}
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
        {mainTab==="newsbriefs"&&<NewsBriefsTab canonical={canonical} briefs={briefs} setBriefs={setBriefs}/>}
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
                      setBriefLoading(p=>({...p,[briefKey]:true}));
                      try {
                        const b=await generateWorldBriefing(breakingArts,"Breaking News");
                        if(b.text) setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                      } catch(e){ console.warn("breaking brief failed:",e); }
                      finally { setBriefLoading(p=>({...p,[briefKey]:false})); }
                    }}
                    disabled={briefLoading[briefKey]||breakingArts.length===0}
                    style={{fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",cursor:briefLoading[briefKey]||breakingArts.length===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:breakingArts.length===0?0.4:1}}
                    onMouseOver={e=>{if(!briefLoading[briefKey])e.currentTarget.style.background="#fdecea";}}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[briefKey]?<Dots color="#c0392b"/>:"✦ brief"}
                  </button>
                </div>
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
                  loading={briefLoading} setLoading={setBriefLoading}/>
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
                      loading={briefLoading} setLoading={setBriefLoading}/>
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
            {marketsView==="sources"&&<SourcesTab canonical={canonical} lastFetch={lastFetch} briefs={briefs} setBriefs={setBriefs}/>}
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
