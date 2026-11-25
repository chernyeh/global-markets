// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — related-headline ranking
// ═══════════════════════════════════════════════════════════════════════════════
// The Macro tab's RELATED HEADLINES were the ten newest stories with a macro
// keyword anywhere in the title or summary. This ranks them instead:
//   1. Gate — the TITLE carries a macro topic (rates & central banks, macro
//      data, oil, credit, FX) or a playbook term. A mention only in the summary
//      counts when the AI read has already filed the story as macro (sector MAC).
//   2. Score — topic weight (as dialled on Breaking) + playbook term + a hard
//      figure in the title + the AI's macro read + source quality, less opinion,
//      listicles and personal finance, less 0.4 a point per hour of age.
//   3. Pick — highest first, at most two per source, a near-duplicate story once.
// Each pick carries a short "why" for the card: the playbook term it touches,
// or else its main topic.

import { TOPIC_MAP } from "./data/taxonomy.js";
import { dialFor, DIAL_MAP, isTopicMuted } from "./topicDials.js";
import { worldSourceBonus } from "./data/sources.js";

const MACRO_TOPICS = ["rates", "macro", "oil", "credit", "fx"];

// Playbook terms (rev 54, 20 Nov), grouped by the signal they bear on. A list
// of patterns per term, so acronyms can be matched case-sensitively (OAT, BTP).
const PLAYBOOK = [
  { k: "10y / long end", re: [/\b(10|ten|30|thirty).year (yields?|treasur\w*|notes?|bonds?)\b|\blong.(end|dated bonds?)\b|\bbond (sell.?off|rout|vigilantes)\b/i] },
  { k: "real yields", re: [/\breal yields?\b|\bbreakevens?\b|\binflation.(protected|linked)\b/i] },
  { k: "term premium", re: [/\bterm premium\b|\brefunding\b|\bcoupon (sizes?|auctions?)\b|\btreasury (auction|issuance|supply)\b|\bbond supply\b/i] },
  { k: "core inflation", re: [/\bcore (cpi|pce|inflation|services)\b|\bsupercore\b|\bservices inflation\b|\bsticky inflation\b/i] },
  { k: "Fed path", re: [/\bfomc\b|\bfed (minutes|chair|governor|officials?|holds|cuts|hikes|pause|pauses|signals?)\b|\brate.(cut|hike) (bets|odds|expectations|hopes)\b|\bfed'?s \w+ (says|sees|warns|signals)\b/i] },
  { k: "2s10s curve", re: [/\b(2|two).year (yields?|treasur\w*|notes?)\b|\byield curve\b|\bsteepen|\bflatten(s|ing|ed)?\b|\bcurve inversion\b/i] },
  { k: "Brent", re: [/\bbrent\b|\bopec\b|\boil (soars?|surges?|spikes?|jumps?|tops?|above|below) \$?\d/i] },
  { k: "OAT–Bund", re: [/\bOATs?\b|\bBTPs?\b/, /\bfrench (bonds?|debt|spreads?|yields?|budget|deficit)\b|\bfrance'?s (debt|deficit|budget|bonds?)\b|\bbund spreads?\b/i] },
  { k: "tariffs / US–China", re: [/\btariffs?\b|\b(us|u\.s\.|trade)[–-]?china (truce|deal|talks)\b|\btrade truce\b/i] },
  { k: "USD/SGD", re: [/\bsingapore dollar\b|\bS\$NEER\b|\bSGD\b/, /\bMAS\b.{0,20}\b(policy|slope|band|eas\w+|tighten\w*)\b/] },
  { k: "credit stress", re: [/\bcredit spreads?\b|\bhigh.yield\b|\bjunk (bonds?|debt)\b|\bprivate credit\b|\bleveraged loans?\b|\bai debt\b|\bcoreweave\b|\bspreads? (widen|widened|blow out)\b|\bdefaults? (rise|climb|jump|surge)\b/i] },
  { k: "hyperscaler capex", re: [/\bhyperscalers?\b|\bcapex\b/i] },
];
const playbookHits = text => PLAYBOOK.filter(p => p.re.some(r => r.test(text))).map(p => p.k);

// A figure the market trades on: a % or bp move, a multi-period high or low.
const FIGURE_RE = /\d(\.\d+)?\s?(%|percent\b|bps?\b|basis points?\b)|\b\d+.(year|month|week) (high|low)\b|\brecord (high|low)\b|\b(highest|lowest) (since|in)\b/i;
// Opinion and commentary: useful, but behind the news that explains a move.
const OPINION_TITLE_RE = /^(opinion|analysis|column|commentary|editorial|view)\b|\((commentary|opinion|column)\)/i;
const OPINION_SOURCE_RE = /opinion|commentary|column|_op$/i;
// Stock lists, how-tos and household money: macro words, not macro news.
const NOISE_RE = /\b(\d+|these|top) (stocks?|shares|ways|things|reasons|tips|picks)\b|\bhow to\b|\bshould you\b|\byour (money|wallet|mortgage|retirement|savings|portfolio)\b|\bbest .{0,30} to buy\b|\bstocks to (buy|watch)\b/i;

const PER_SOURCE = 2;
const AGE_POINTS_PER_HOUR = 0.4;
const DESC_ONLY_WEIGHT = 0.3;
const SECONDARY_WEIGHT = 0.2;

const STOP = new Set("about after again against amid ahead also among as at because been before being between both could from have into more most over said says since than that their there these they this those through under until were what when where which while will with would year years week".split(" "));
const words = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w)));
// Same story under two headlines: most of the shorter title's words recur.
function sameStory(a, b) {
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  if (s.size < 3) return false;
  let n = 0;
  for (const w of s) if (l.has(w)) n++;
  return n / s.size >= 0.6;
}

const titleOf = a => a.translatedTitle || a.title || "";
const timeOf = a => (a.pubDate ? new Date(a.pubDate).getTime() : a.fetchedAt || 0);

// Score one article, or null if it does not pass the gate.
export function scoreMacroHeadline(a, now = Date.now(), dials) {
  const title = titleOf(a);
  const desc = a.description || "";
  const topicPts = text => MACRO_TOPICS
    .map(id => TOPIC_MAP[id])
    .filter(t => t.re.test(text))
    .map(t => ({ t, v: t.score * DIAL_MAP[dialFor(t.id, dials)].feedMult }))
    .sort((x, y) => y.v - x.v);
  const inTitle = topicPts(title);
  const pb = playbookHits(title);
  const isMac = a.sector === "MAC" || a.signalCategory === "MACRO";
  const descOnly = inTitle.length ? [] : topicPts(desc);
  if (!inTitle.length && !pb.length && !(isMac && descOnly.length)) return null;

  let s = 0;
  if (inTitle.length) s += inTitle[0].v + SECONDARY_WEIGHT * inTitle.slice(1).reduce((x, y) => x + y.v, 0);
  else if (descOnly.length) s += DESC_ONLY_WEIGHT * descOnly[0].v;
  if (pb.length) s += 18 + 4 * Math.min(2, pb.length - 1);
  if (FIGURE_RE.test(title)) s += 6;
  if (a.sector === "MAC") s += 8;
  if (a.signalCategory === "MACRO") s += 4;
  s += worldSourceBonus(a);
  if (a.isOpinion === true || OPINION_TITLE_RE.test(title) || OPINION_SOURCE_RE.test(a.sourceId || "")) s -= 12;
  if (NOISE_RE.test(title)) s -= 20;
  const ageH = Math.max(0, (now - timeOf(a)) / 3600e3);
  s -= AGE_POINTS_PER_HOUR * ageH;

  // Label by what the headline leads with (earliest match), not by weight:
  // "consumer confidence soars … gas prices in retreat" is macro data, not oil.
  const lead = (inTitle.length ? inTitle.map(x => ({ t: x.t, at: title.search(x.t.re) })) : descOnly.map(x => ({ t: x.t, at: desc.search(x.t.re) })))
    .sort((x, y) => x.at - y.at)[0]?.t;
  const why = pb.length ? `playbook: ${pb[0]}` : lead ? lead.label : "macro";
  return { score: s, why };
}

// The Macro tab's list: last `hours` hours, gated, ranked, capped per source,
// near-duplicates collapsed. → [{ a, score, why }]
export function rankMacroHeadlines(articles, { now = Date.now(), hours = 24, limit = 10, dials } = {}) {
  const cutoff = now - hours * 3600e3;
  const ranked = [];
  for (const a of articles || []) {
    if (timeOf(a) <= cutoff) continue;
    if (isTopicMuted(a, dials)) continue;
    const r = scoreMacroHeadline(a, now, dials);
    if (r) ranked.push({ a, ...r, w: words(titleOf(a)) });
  }
  ranked.sort((x, y) => y.score - x.score || timeOf(y.a) - timeOf(x.a));
  const out = [], perSource = {};
  for (const r of ranked) {
    if (out.length >= limit) break;
    const src = r.a.sourceId || r.a.source;
    if ((perSource[src] || 0) >= PER_SOURCE) continue;
    if (out.some(p => sameStory(p.w, r.w))) continue;
    perSource[src] = (perSource[src] || 0) + 1;
    out.push(r);
  }
  return out.map(({ a, score, why }) => ({ a, score, why }));
}
