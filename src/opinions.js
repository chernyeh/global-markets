// ═══════════════════════════════════════════════════════════════════════════════
// OPINIONS ENGINE — detection, free-alternative resolver, and "who is saying what" digest
// ═══════════════════════════════════════════════════════════════════════════════
import { OPINION_MAP } from "./data/taxonomy.js";
import { SOURCES, GN } from "./data/sources.js";
import { callClaude } from "./api.js";

// Feeds that are inherently opinion / commentary / columns
export const OPINION_SOURCE_IDS = new Set([
  "ft_alphaville","wsj_heard","barrons","benzinga_ideas","semafor","edge_sg_focus",
  "seekalpha","ibd","stockchase","investors_chron","reuters_breakingviews",
  "analyst_roundtables","mgmt_interviews",
]);

// Publisher domains that are typically hard-paywalled — used to reject web fallbacks
export const PAYWALL_DOMAINS = [
  "wsj.com","ft.com","bloomberg.com","barrons.com","economist.com","nytimes.com",
  "washingtonpost.com","theglobeandmail.com","nikkei.com","asia.nikkei.com","scmp.com",
  "afr.com","businesstimes.com.sg","theedgesingapore.com","handelsblatt.com","faz.net",
  "telegraph.co.uk","nzz.ch","kedglobal.com","haaretz.com","investorschronicle.co.uk",
];

// URL path fragments that signal an opinion / commentary piece
const OPINION_URL_RE = /\/(opinion|opinions|commentary|column|columnist|columnists|editorial|editorials|op-ed|op_ed|views|viewpoint|perspective|perspectives|analysis|comment|breakingviews|blogs?)\b/i;

// Title / description phrasing that signals opinion. Kept conservative to limit false positives.
const OPINION_TEXT_RE = /^(opinion|column|commentary|editorial|analysis|viewpoint|perspective|comment)\s*[:\-–|]|(\||—|–)\s*(opinion|commentary|editorial|analysis)\b|\bop-?ed\b|\bthe case (for|against)\b|\bwhy .{0,60}\b(should|must|shouldn'?t|can'?t|will|won'?t|needs? to)\b|\bheard on the street\b|\bbreakingviews\b|\bis (wrong|right) about\b|\bhere'?s why\b|\bmy (take|view|bet|call)\b/i;

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

// Parse a raw RSS/Google-News XML string into {title, link, source} items
function parseFeedXml(text) {
  try {
    const xml = new DOMParser().parseFromString(text, "text/xml");
    return Array.from(xml.querySelectorAll("item")).map(item => {
      const g = t => item.querySelector(t)?.textContent?.trim() || "";
      const title = g("title").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = g("link") || g("guid");
      const source = item.querySelector("source")?.textContent?.trim() || domainOf(link);
      return { title, link, source };
    }).filter(x => x.title && x.link);
  } catch { return []; }
}

// Find a free-to-read version of a paywalled opinion piece.
// 1) prefer a same-topic article already in the non-paywalled scraped pool
// 2) otherwise fall back to a Google-News web search, rejecting paywalled domains
export async function findFreeAlternative(art, pool) {
  const paywalledIds = new Set(SOURCES.filter(s => s.paywall).map(s => s.id));
  const freePool = (pool || []).filter(a =>
    a.id !== art.id && a.link && !paywalledIds.has(a.sourceId) && !paywalledIds.has(a.originalSourceId)
  );

  // ── (1) Pool-first: ask Claude for the closest same-topic free article ──
  if (freePool.length) {
    const candidates = freePool.slice(0, 60);
    const prompt = `A reader wants a free-to-read article covering the SAME story as this paywalled opinion piece:
"${art.translatedTitle || art.title}" [${art.source}]

Below are free articles. Return ONLY the number of the ONE that covers the same underlying story/topic, or -1 if none is a genuine match. Return just the number, nothing else.

${candidates.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    try {
      const raw = await callClaude(prompt, 20);
      const idx = parseInt((raw.match(/-?\d+/)||["-1"])[0], 10);
      if (idx >= 0 && candidates[idx]) {
        const m = candidates[idx];
        return { title: m.translatedTitle || m.title, link: m.link, source: m.source, via: "pool" };
      }
    } catch { /* fall through to web */ }
  }

  // ── (2) Web fallback: Google News search, reject paywalled domains ──
  try {
    const q = opinionKeywords(art);
    if (!q) return null;
    const res = await fetch("/api/rss?url=" + encodeURIComponent(GN(q)));
    if (!res.ok) return null;
    const items = parseFeedXml(await res.text());
    const hit = items.find(it => {
      const d = domainOf(it.link);
      return d && !PAYWALL_DOMAINS.some(p => d === p || d.endsWith("." + p));
    });
    if (hit) return { title: hit.title, link: hit.link, source: hit.source, via: "web" };
  } catch { /* no free version found */ }
  return null;
}

// ─── "Who is saying what" digest ──────────────────────────────────────────────
export async function generateOpinionDigest(articles, label) {
  if (!articles.length) return { text: "", articles: [] };
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
