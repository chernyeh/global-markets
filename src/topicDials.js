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

// ─── Decay ─────────────────────────────────────────────────────────────────────
// Up and Focus fade back to Neutral after 72h unless pinned, so a theme the
// market has moved on from doesn't keep shaping the feed. Down and Hide are
// noise filters and persist (hidden stories stay counted in the strip).
export const DECAY_MS = 72 * 60 * 60 * 1000;
export const DECAYING = new Set(["up", "focus"]);

// Saved form: { [topicId]: { level, setAt, pinned } }. The first release stored
// bare level strings — those start their 72h clock on first load.
export function normalizeDialRecords(raw, now = Date.now()) {
  const out = {};
  for (const [id, v] of Object.entries(raw || {})) {
    const r = typeof v === "string" ? { level: v } : v;
    if (!TOPIC_MAP[id] || !r || !DIAL_MAP[r.level] || r.level === "neutral") continue;
    out[id] = { level: r.level, setAt: Number(r.setAt) || now, pinned: !!r.pinned };
  }
  return out;
}

// Milliseconds until a record fades, or null if it never does.
export function timeLeft(rec, now = Date.now()) {
  if (!rec || rec.pinned || !DECAYING.has(rec.level)) return null;
  return Math.max(0, rec.setAt + DECAY_MS - now);
}

export function expireDials(records, now = Date.now()) {
  const kept = {}, expired = [];
  for (const [id, r] of Object.entries(records || {})) {
    if (timeLeft(r, now) === 0) expired.push({ id, level: r.level });
    else kept[id] = r;
  }
  return { records: kept, expired };
}

export const levelsOf = records =>
  Object.fromEntries(Object.entries(records || {}).map(([id, r]) => [id, r.level]));

let dials = {}; // { [topicId]: levelId } — Neutral topics are omitted

export function setTopicDials(next) {
  dials = Object.fromEntries(
    Object.entries(next || {}).filter(([id, lvl]) => TOPIC_MAP[id] && DIAL_MAP[lvl] && lvl !== "neutral")
  );
  return dials;
}
// Scoring helpers take an optional level map so the Neutral view can rank the
// same articles with every dial at default ({}) without touching the live dials.
export const dialFor = (id, d = dials) => d[id] || "neutral";
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
export function isTopicMuted(a, d = dials) {
  const m = topicMatches(a);
  if (!m.some(t => dialFor(t.id, d) === "mute")) return false;
  return !m.some(t => { const l = dialFor(t.id, d); return l === "up" || l === "focus"; });
}
export const isTopicFocused = (a, d = dials) => topicMatches(a).some(t => dialFor(t.id, d) === "focus");

export function worldTopicScore(a, d = dials) {
  const vals = topicMatches(a)
    .map(t => t.score * DIAL_MAP[dialFor(t.id, d)].feedMult)
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
