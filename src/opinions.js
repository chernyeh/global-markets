// ═══════════════════════════════════════════════════════════════════════════════
// OPINIONS ENGINE — detection, free-alternative resolver, and "who is saying what" digest
// ═══════════════════════════════════════════════════════════════════════════════
import { OPINION_MAP } from "./data/taxonomy.js";
import { SOURCES, GN } from "./data/sources.js";
import { callClaude } from "./api.js";

// Feeds that are inherently opinion / commentary / columns / analysis / features.
// Broadened to sweep in a diverse range of opinion pieces across every region.
export const OPINION_SOURCE_IDS = new Set([
  // Dedicated markets commentary / ideas / columns
  "ft_alphaville","wsj_heard","wsj_mkt","barrons","benzinga_ideas","semafor",
  "seekalpha","sa_wsb","ibd","stockchase","investors_chron","reuters_breakingviews",
  "analyst_roundtables","mgmt_interviews","globe_itm","scmp_markets",
  // In-depth / features / contrarian analysis desks
  "edge_sg_focus","edge_sg","nikkei_biz_spotlight","spiegel_de",
  // Quality long-form / critique
  "guardian","guardian_au",
]);

// Publisher domains that are typically hard-paywalled — used to reject web fallbacks
export const PAYWALL_DOMAINS = [
  "wsj.com","ft.com","bloomberg.com","barrons.com","economist.com","nytimes.com",
  "washingtonpost.com","theglobeandmail.com","nikkei.com","asia.nikkei.com","scmp.com",
  "afr.com","businesstimes.com.sg","theedgesingapore.com","handelsblatt.com","faz.net",
  "telegraph.co.uk","nzz.ch","kedglobal.com","haaretz.com","investorschronicle.co.uk",
];

// URL path fragments that signal an opinion / commentary piece
const OPINION_URL_RE = /\/(opinion|opinions|commentary|column|columnist|columnists|editorial|editorials|op-ed|op_ed|views|viewpoint|perspective|perspectives|analysis|comment|breakingviews|long-?read|big-?read|the-big-read|feature|features|blogs?|voices?)\b/i;

// Title / description phrasing that signals opinion. Broad but still anchored on
// argumentative/first-person/framing cues to keep straight news out.
const OPINION_TEXT_RE = new RegExp([
  // Leading label: "Opinion:", "Column —", "Analysis |" …
  "^(opinion|column|commentary|editorial|analysis|viewpoint|perspective|comment|explainer|essay)\\s*[:\\-–|]",
  // Trailing/inline label after a separator
  "(\\||—|–)\\s*(opinion|commentary|editorial|analysis|column|comment)\\b",
  "\\bop-?ed\\b",
  "\\bheard on the street\\b",
  "\\bbreakingviews\\b",
  // Classic argument framings
  "\\bthe (case|argument) (for|against)\\b",
  "\\b(the )?bull case\\b|\\b(the )?bear case\\b",
  "\\bin defen[cs]e of\\b",
  "\\bthe (trouble|problem|case|catch|paradox|myth) (with|of|for)\\b",
  "\\bthe real (reason|problem|risk|story|winner|loser)\\b",
  // Directive / persuasive openers
  "\\bwhy .{0,70}\\b(should|shouldn'?t|must|mustn'?t|can'?t|cannot|won'?t|will|needs? to|matters?|is (right|wrong)|are wrong)\\b",
  "\\b(should|shouldn'?t) (investors|you|we|markets|the fed|central banks)\\b",
  "\\bit'?s time (to|for)\\b",
  "\\b(here'?s|this is) why\\b",
  "\\bwhat .{0,60}\\b(gets? wrong|means for|tells us|should do)\\b",
  "\\b(forget|beware|stop|don'?t|enough about)\\b .{0,40}",
  "\\bmy (take|view|bet|call|money)\\b",
  "\\bis (overrated|underrated|a mistake|a mirage|a bubble|dead|back|wrong|right) about\\b",
  "\\b(lessons?|takeaways?) from\\b",
  "\\bhow to think about\\b",
].join("|"), "i");

// Rough keyword → category guess for opinions not yet enriched by the LLM
export function guessOpinionCategory(text) {
  const t = (text||"").toLowerCase();
  if (/\b(war|sanction|tariff|geopolit|conflict|nato|beijing|taiwan|ukraine|russia|iran|middle east|diplomat|border)\b/.test(t)) return "GEO";
  if (/\b(regulat|antitrust|central bank|fed\b|ecb|boj|policy|election|legislation|congress|parliament|tax reform|deregulat)\b/.test(t)) return "POLICY";
  if (/\b(gdp|inflation|recession|rate (hike|cut)|unemployment|growth|economy|economic|fiscal|monetary|deficit)\b/.test(t)) return "MACRO";
  if (/\b(portfolio|allocation|diversif|value invest|dividend strateg|asset class|risk-on|risk-off|positioning|hedge)\b/.test(t)) return "INVEST";
  if (/\b(sector|industry|banks?|semiconductor|energy|pharma|automotive|retail|property|reits?|airlines?|miners?)\b/.test(t)) return "SECTOR";
  if (/\b(stocks?|equities|bonds?|yields?|rally|selloff|sell-off|volatility|bull|bear|market|trading|correction)\b/.test(t)) return "MKT";
  return "OTHER";
}

// Heuristic opinion detector — returns {isOpinion, category|null}
export function opinionHeuristic(art) {
  const text = `${art.translatedTitle || art.title || ""} ${art.description || ""}`;
  const bySource = OPINION_SOURCE_IDS.has(art.sourceId) || OPINION_SOURCE_IDS.has(art.originalSourceId);
  const byUrl = art.link ? OPINION_URL_RE.test(art.link) : false;
  const byText = OPINION_TEXT_RE.test(text);
  const isOpinion = bySource || byUrl || byText;
  return { isOpinion, category: isOpinion ? guessOpinionCategory(text) : null };
}

// Effective opinion status: LLM classification wins, heuristic fills gaps
export function resolveOpinion(art) {
  const h = opinionHeuristic(art);
  const isOpinion = art.isOpinion === true || h.isOpinion;
  const category = (art.opinionCategory && OPINION_MAP[art.opinionCategory]) ? art.opinionCategory : (h.category || "OTHER");
  return { isOpinion, category };
}

// ─── Reader access & source weighting ─────────────────────────────────────────
// Publications the reader has a paid subscription to — never treat as a blocked
// paywall, and prefer them when sourcing a readable version of a paywalled story.
export const ACCESSIBLE_SOURCE_IDS = new Set([
  "wsj","wsj2","wsj_heard","wsj_mkt","wsj_global_equities","wsj_global_commodities", // WSJ
  "nyt",                                                                             // NY Times
  "barrons",                                                                         // Barron's
  "ft","ft_alphaville",                                                              // Financial Times
  "edge_sg","edge_sg_stocks_watch","edge_sg_focus",                                  // The Edge
]);
export const ACCESSIBLE_DOMAINS = [
  "wsj.com","nytimes.com","barrons.com","ft.com","ftav.substack.com","theedgesingapore.com","theedgemarkets.com",
];
export function isUserAccessible(art) {
  return ACCESSIBLE_SOURCE_IDS.has(art?.sourceId) || ACCESSIBLE_SOURCE_IDS.has(art?.originalSourceId);
}

// Major publications & global newswires — summaries should lean on these. Used
// both to bias article ordering and as an explicit instruction to the model.
export const MAJOR_SOURCE_IDS = new Set([
  // Global newswires
  "reuters","reuters_de","reuters_ca","reuters_jp","reuters_asia","reuters_sg","reuters_hk",
  "reuters_kr","reuters_tw","reuters_in","reuters_au","reuters_cn","reuters_breakingviews",
  "bloomberg","bloomberg2","bloom_de","bloom_ca","bloom_sg","bloom_hk","bloom_kr","bloom_tw",
  "bloom_in","bloom_au","bloom_cn",
  // Global majors (US/UK)
  "wsj","wsj2","wsj_heard","wsj_mkt","wsj_global_equities","wsj_global_commodities",
  "nyt","barrons","ft","ft_alphaville","semafor","guardian",
  // Canada
  "globe_mail","globe_itm",
  // Asia Pacific
  "nikkei_asia","nikkei_biz_spotlight","scmp","scmp_markets","scmp_china","bt_sg",
  "afr","afr_street_talk","smh","the_aus","edge_sg","edge_sg_focus","edge_sg_stocks_watch",
  // Europe
  "handelsblatt","handelsblatt_en","spiegel_de",
]);

// Prompt instruction: weight any summary toward these publications and newswires.
export const SOURCE_WEIGHTING_NOTE = "SOURCE WEIGHTING: Give the most weight, space, and prominence to reporting and commentary from major publications and global newswires — Reuters, Bloomberg, Associated Press, AFP, the Wall Street Journal, The New York Times, Barron's, the Financial Times, Nikkei Asia, the South China Morning Post, Singapore's Business Times and The Edge, Canada's Globe and Mail, the Australian Financial Review, The Australian, the Sydney Morning Herald, and leading European papers (Handelsblatt, Der Spiegel, Semafor). Lead with what these outlets say; treat blogs, aggregators, and single-stock tip sheets as secondary or corroborating unless they carry unique, market-moving detail.";

// Stable sort that floats major-publication/newswire pieces to the front.
export function sortMajorFirst(articles) {
  return articles
    .map((a, i) => ({ a, i, major: MAJOR_SOURCE_IDS.has(a.sourceId) || MAJOR_SOURCE_IDS.has(a.originalSourceId) }))
    .sort((x, y) => (y.major - x.major) || (x.i - y.i))
    .map(o => o.a);
}

// ─── Free-alternative resolver ────────────────────────────────────────────────
const STOPWORDS = new Set("the a an and or of to in on for with as at by from is are be this that it its into over amid after before why how what who will would could should".split(" "));

function opinionKeywords(art) {
  const title = art.translatedTitle || art.title || "";
  return title
    .replace(/^(opinion|column|commentary|editorial|analysis)\s*[:\-–|]\s*/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 8)
    .join(" ");
}

function domainOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

// Parse a raw RSS/Google-News XML string into {title, link, source, pubDomain}.
// Google News wraps every link in a news.google.com redirect, so the real
// publisher domain comes from the <source url="…"> attribute, not the link.
function parseFeedXml(text) {
  try {
    const xml = new DOMParser().parseFromString(text, "text/xml");
    return Array.from(xml.querySelectorAll("item")).map(item => {
      const g = t => item.querySelector(t)?.textContent?.trim() || "";
      const title = g("title").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = g("link") || g("guid");
      const srcEl = item.querySelector("source");
      const source = srcEl?.textContent?.trim() || domainOf(link);
      const pubDomain = domainOf(srcEl?.getAttribute("url") || "") || domainOf(link);
      return { title, link, source, pubDomain };
    }).filter(x => x.title && x.link);
  } catch { return []; }
}

const domainAccessible = d => !!d && ACCESSIBLE_DOMAINS.some(p => d === p || d.endsWith("." + p));
const domainBlocked = d => !!d && PAYWALL_DOMAINS.some(p => d === p || d.endsWith("." + p)) && !domainAccessible(d);

// Find a readable version of a paywalled story the reader can actually open:
// either free coverage, or the same story in a publication they subscribe to
// (WSJ / NYT / Barron's / FT / The Edge).
// 1) prefer a same-topic article already in the scraped pool that is free OR
//    from a subscribed publication
// 2) otherwise fall back to a Google-News web search, preferring subscribed-
//    publication domains, then any non-paywalled domain
export async function findFreeAlternative(art, pool) {
  const paywalledIds = new Set(SOURCES.filter(s => s.paywall).map(s => s.id));
  // Readable = not paywalled, OR from a publication the reader subscribes to.
  const readable = a =>
    (!paywalledIds.has(a.sourceId) && !paywalledIds.has(a.originalSourceId)) || isUserAccessible(a);
  const candidatePool = (pool || []).filter(a => a.id !== art.id && a.link && readable(a));

  // ── (1) Pool-first: ask Claude for the closest same-topic readable article ──
  if (candidatePool.length) {
    const candidates = candidatePool.slice(0, 60);
    const prompt = `A reader wants a version of the SAME story they can read, as an alternative to this paywalled opinion piece:
"${art.translatedTitle || art.title}" [${art.source}]

Below are articles the reader can access. Return ONLY the number of the ONE that covers the same underlying story/topic, or -1 if none is a genuine match. Return just the number, nothing else.

${candidates.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    try {
      const raw = await callClaude(prompt, 20);
      const idx = parseInt((raw.match(/-?\d+/)||["-1"])[0], 10);
      if (idx >= 0 && candidates[idx]) {
        const m = candidates[idx];
        return { title: m.translatedTitle || m.title, link: m.link, source: m.source, via: isUserAccessible(m) ? "sub" : "pool" };
      }
    } catch { /* fall through to web */ }
  }

  // ── (2) Web fallback: Google News search ──
  try {
    const q = opinionKeywords(art);
    if (!q) return null;
    const res = await fetch("/api/rss?url=" + encodeURIComponent(GN(q)));
    if (!res.ok) return null;
    const items = parseFeedXml(await res.text());
    // Prefer a subscribed publication (reader can open it), then free coverage.
    // Gate on the real publisher domain, not the news.google.com redirect link.
    const sub = items.find(it => domainAccessible(it.pubDomain));
    if (sub) return { title: sub.title, link: sub.link, source: sub.source, via: "sub" };
    const free = items.find(it => it.pubDomain && !domainBlocked(it.pubDomain));
    if (free) return { title: free.title, link: free.link, source: free.source, via: "web" };
  } catch { /* no readable version found */ }
  return null;
}

// ─── "Who is saying what" digest ──────────────────────────────────────────────
export async function generateOpinionDigest(articles, label) {
  if (!articles.length) return { text: "", articles: [] };
  // Float major publications & newswires to the front so they anchor the digest
  // (and the top chunk when the set is large).
  articles = sortMajorFirst(articles);
  const sourceArticles = articles;
  const line = a => `${a.translatedTitle || a.title} — ${a.source}${a.description ? ` :: ${a.description}` : ""}`;

  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < articles.length; i += CHUNK) chunks.push(articles.slice(i, i + CHUNK));

  const rules = `Rules:
- Group the write-up under these headings, including only those with material content: ## Macro & Economy, ## Geopolitics, ## Markets & Trading, ## Investing & Strategy, ## Company-Specific, ## Sector & Industry, ## Policy & Regulation, ## Other.
- For EACH opinion piece, state WHO is arguing it (the named columnist/author if it appears in the headline or description, otherwise the publication) and WHAT their thesis or stance is, in 1-2 sentences.
- Where several writers address the same subject, explicitly note where they AGREE and where they DIVERGE.
- End every bullet with [REF:N] (or [REF:N,M]) citing the article number(s).
- ${SOURCE_WEIGHTING_NOTE}
- ATTRIBUTION CONSTRAINT: only the headline and a short description are available — attribute at the columnist/publication level. Do NOT invent quotes, figures, or details not present in the text. Never fabricate an author name.`;

  if (chunks.length === 1) {
    const prompt = `You are a senior markets editor compiling an opinion round-up for ${label}: a clear map of WHO is saying WHAT across today's opinion and commentary pieces.

## [Short title capturing the dominant debate among the columnists]

[2-3 sentence overview: what are opinion writers most exercised about right now, and where is the sharpest disagreement?]

${rules}

Opinion pieces (cite using [REF:N], N = article number):
${articles.map((a,i)=>`${i}. ${line(a)}`).join("\n")}`;
    const text = await callClaude(prompt, 6000);
    return { text, articles: sourceArticles, generatedAt: Date.now() };
  }

  const summaries = await Promise.all(chunks.map((chunk, ci) => {
    const offset = ci * CHUNK;
    const prompt = `For each opinion piece below, note WHO is arguing it (named columnist/author if present, else the publication) and WHAT their thesis is, in one sentence. Put the article number in parentheses at the end, e.g. "(article 3)". Do not invent authors or quotes.
${chunk.map((a,i)=>`${offset+i}. ${line(a)}`).join("\n")}`;
    return callClaude(prompt, 900);
  }));

  const articleIndex = articles.map((a,i)=>`${i}. ${line(a)}`).join("\n");
  const synthPrompt = `You are a senior markets editor. Synthesise these notes into an opinion round-up for ${label}: WHO is saying WHAT, grouped by theme, with points of agreement and divergence.

## [Short title capturing the dominant debate]

[2-3 sentence overview of what opinion writers are focused on and where they most disagree.]

${rules}

Article index (use N in [REF:N]):
${articleIndex}

Notes to synthesise:
${summaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, 6000);
  return { text, articles: sourceArticles, generatedAt: Date.now() };
}
