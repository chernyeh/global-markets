// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC DIALS — reader-set weighting of the TOPICS registry
// ═══════════════════════════════════════════════════════════════════════════════
// The reader turns each topic Mute / Down / Neutral / Up / Focus on the Breaking
// tab. The same setting drives the Breaking-feed rank (worldTopicScore), the
// per-source cap, and the company-brief boost (briefTopicBoost), so the feed and
// the briefs never disagree about what matters today.
//
// Like the synth-model picker, the active dials live at module level so the
// module-level scoring functions in App.jsx can read them without threading a
// parameter through every call; App keeps a React copy to trigger re-renders and
// always calls setTopicDials before setting that state.
import { TOPICS, TOPIC_MAP } from "./data/taxonomy.js";

export const DIAL_LEVELS = [
  { id:"mute",    label:"Hide",    feedMult:0   },
  { id:"down",    label:"Down",    feedMult:0.5 },
  { id:"neutral", label:"Neutral", feedMult:1   },
  { id:"up",      label:"Up",      feedMult:1.5 },
  { id:"focus",   label:"Focus",   feedMult:2   },
];
export const DIAL_MAP = Object.fromEntries(DIAL_LEVELS.map(l => [l.id, l]));

// Feed caps. Focus is the one setting that changes what gets IN to the feed
// rather than just its order: a focused story may use more of its source's slots.
export const MAX_PER_SOURCE = 4;
export const MAX_PER_SOURCE_FOCUS = 6;

// Secondary matches add a fraction of their weight, so a story on two live
// topics (a tariff on chips) edges out one on a single topic.
const SECONDARY_WEIGHT = 0.2;

// Brief multipliers at Up / Focus; Down removes the topic's default boost.
const BRIEF_UP = 1.5;
const BRIEF_FOCUS = 1.8;

let dials = {}; // { [topicId]: levelId } — Neutral topics are omitted

export function setTopicDials(next) {
  dials = Object.fromEntries(
    Object.entries(next || {}).filter(([id, lvl]) => TOPIC_MAP[id] && DIAL_MAP[lvl] && lvl !== "neutral")
  );
  return dials;
}
export const dialFor = id => dials[id] || "neutral";
// Stable signature of the active dials — stored on a brief so the UI can tell
// when the dials have moved since it was written.
export const dialsKey = d => Object.entries(d || dials).sort().map(([k, v]) => `${k}:${v}`).join(",");

// Regex matching is the expensive part and depends only on the article's text,
// so cache per article object (a re-translated article is a new object).
const matchCache = new WeakMap();
export function topicMatches(a) {
  let m = matchCache.get(a);
  if (!m) {
    const text = `${a.translatedTitle || a.title} ${a.description || ""}`;
    m = TOPICS.filter(t => t.re.test(text));
    matchCache.set(a, m);
  }
  return m;
}

// Hidden when it touches a muted topic and no topic the reader has turned up —
// a muted "Musk" still lets a Tesla-tariff story through if Trade is on Focus.
export function isTopicMuted(a) {
  const m = topicMatches(a);
  if (!m.some(t => dialFor(t.id) === "mute")) return false;
  return !m.some(t => { const l = dialFor(t.id); return l === "up" || l === "focus"; });
}
export const isTopicFocused = a => topicMatches(a).some(t => dialFor(t.id) === "focus");

export function worldTopicScore(a) {
  const vals = topicMatches(a)
    .map(t => t.score * DIAL_MAP[dialFor(t.id)].feedMult)
    .sort((x, y) => y - x);
  if (!vals.length) return 0;
  return vals[0] + SECONDARY_WEIGHT * vals.slice(1).reduce((s, v) => s + v, 0);
}

export function briefTopicBoost(a) {
  let best = 1;
  for (const t of topicMatches(a)) {
    const l = dialFor(t.id);
    const w = l === "focus" ? BRIEF_FOCUS
      : l === "up" ? Math.max(BRIEF_UP, t.briefBoost)
      : l === "neutral" ? t.briefBoost
      : 1; // down / mute: no boost (muted stories are filtered before ranking)
    if (w > best) best = w;
  }
  return best;
}
