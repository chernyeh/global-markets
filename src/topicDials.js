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
import { TOPICS, TOPIC_MAP, TOPIC_PRESETS, MARKET_GAUGES } from "./data/taxonomy.js";

// ─── Custom topics ────────────────────────────────────────────────────────────
// Reader-added keyword topics ("Nippon Steel, US Steel"). They score like a
// mid-weight built-in topic at Neutral and take dials, decay and presets'
// "leave alone" rule like any other. Saved as [{ id, terms }]; the regex is
// rebuilt on load.
export const CUSTOM_SCORE = 40;
export const MAX_CUSTOM_TOPICS = 8;
const escapeRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRe = t => `${/^\w/.test(t) ? "\\b" : ""}${escapeRe(t)}${/\w$/.test(t) ? "\\b" : ""}`;

export function parseTerms(input) {
  return [...new Set(String(input || "").split(/[,;\n]/).map(t => t.trim().replace(/\s+/g, " ")).filter(t => t.length >= 2))].slice(0, 8);
}
function hydrateCustom(c) {
  const terms = parseTerms((c?.terms || []).join(","));
  if (!terms.length || !/^c_[a-z0-9_]+$/.test(c?.id || "")) return null;
  return { id: c.id, label: terms.join(" / "), group: "custom", custom: true, terms,
    score: CUSTOM_SCORE, briefBoost: 1, re: new RegExp(terms.map(termRe).join("|"), "i") };
}
// New custom topic from free text, or null. The id comes from the first term.
export function makeCustomTopic(input, existing = []) {
  const terms = parseTerms(input);
  if (!terms.length) return null;
  const base = "c_" + terms[0].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "c_topic";
  let id = base === "c_" ? "c_topic" : base, n = 2;
  while (existing.some(c => c.id === id)) id = `${base}_${n++}`;
  return { id, terms };
}

let customTopics = [];
export function setCustomTopics(list) {
  customTopics = (list || []).map(hydrateCustom).filter(Boolean).slice(0, MAX_CUSTOM_TOPICS);
  matchCache = new WeakMap(); // topic set changed — every article must re-match
  return customTopics.map(({ id, terms }) => ({ id, terms }));
}
export const allTopics = () => [...TOPICS, ...customTopics];
export const topicById = id => TOPIC_MAP[id] || customTopics.find(t => t.id === id);

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
    if (!topicById(id) || !r || !DIAL_MAP[r.level] || r.level === "neutral") continue;
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
    Object.entries(next || {}).filter(([id, lvl]) => topicById(id) && DIAL_MAP[lvl] && lvl !== "neutral")
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
let matchCache = new WeakMap();
export function topicMatches(a) {
  let m = matchCache.get(a);
  if (!m) {
    const text = `${a.translatedTitle || a.title} ${a.description || ""}`;
    m = allTopics().filter(t => t.re.test(text));
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

// ═══════════════════════════════════════════════════════════════════════════════
// PRESETS (phase 2)
// ═══════════════════════════════════════════════════════════════════════════════
// Set the preset's dials, return every other Up / Focus / Down to Neutral, and
// leave Hide settings and pinned dials alone (see isStanding). setAt is left blank so the save
// step stamps a fresh 72h clock on every dial the preset touches.
// A hidden or pinned dial is a standing choice: a preset never changes it, even
// when the preset names that topic (Rates-driven won't un-hide a hidden Musk).
const isStanding = r => !!r && (r.level === "mute" || r.pinned);

export function applyPreset(records, preset) {
  const next = {};
  for (const [id, r] of Object.entries(records || {})) {
    if (isStanding(r)) next[id] = r;
  }
  for (const [id, level] of Object.entries(preset.dials)) {
    if (!isStanding(records?.[id])) next[id] = { level, pinned: false };
  }
  return next;
}
// The preset the current dials amount to, if any — so the strip can name it.
// Standing (hidden / pinned) dials are ignored on both sides of the comparison.
export function matchPreset(records) {
  const recs = records || {};
  return TOPIC_PRESETS.find(p =>
    Object.entries(p.dials).every(([id, l]) => isStanding(recs[id]) || recs[id]?.level === l) &&
    Object.entries(recs).every(([id, r]) => id in p.dials || isStanding(r))
  ) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTIONS (phase 3) — what the news flow and the tape say deserves a look
// ═══════════════════════════════════════════════════════════════════════════════
// Never applied automatically: the strip offers them, the reader decides.

// Coverage surge: a topic's share of headlines in the Breaking window against
// its share in the older stored headlines. The app keeps only each source's
// latest feed snapshot, so fast wires sit mostly in the window and slow
// sources mostly in the baseline; comparing only sources present in BOTH keeps
// a change in source mix from posing as a change in topic.
export const SURGE_RATIO = 2;      // window share ≥ 2× baseline share
export const SURGE_MIN_COUNT = 3;  // …on at least 3 headlines in the window
const SURGE_MIN_WINDOW = 20, SURGE_MIN_BASE = 40;

export function coverageSurges(windowArts, baseArts, topics = allTopics()) {
  const inW = new Set(windowArts.map(a => a.sourceId));
  const inB = new Set(baseArts.map(a => a.sourceId));
  const W = windowArts.filter(a => inB.has(a.sourceId));
  const B = baseArts.filter(a => inW.has(a.sourceId));
  if (W.length < SURGE_MIN_WINDOW || B.length < SURGE_MIN_BASE) return { surges: {}, ready: false };
  const cw = {}, cb = {};
  W.forEach(a => topicMatches(a).forEach(t => { cw[t.id] = (cw[t.id] || 0) + 1; }));
  B.forEach(a => topicMatches(a).forEach(t => { cb[t.id] = (cb[t.id] || 0) + 1; }));
  const surges = {};
  for (const t of topics) {
    const c = cw[t.id] || 0;
    if (c < SURGE_MIN_COUNT) continue;
    // +1 smoothing so a topic absent from the baseline doesn't divide by zero
    const ratio = (c / W.length) / (((cb[t.id] || 0) + 1) / (B.length + 1));
    if (ratio >= SURGE_RATIO) surges[t.id] = { ratio, count: c };
  }
  return { surges, ready: true };
}

// One gauge's latest daily move, from { price, prevClose } served by /api/gauges.
export function evalGauge(g, q) {
  if (!q || typeof q.price !== "number" || typeof q.prevClose !== "number" || !q.prevClose) return null;
  let move, text;
  if (g.unit === "bp") {
    // ^TNX is quoted as a yield in percent (4.35); guard against the legacy ×10 quote.
    const scale = q.price > 20 ? 10 : 100;
    move = (q.price - q.prevClose) * scale;
    text = `${move >= 0 ? "+" : "−"}${Math.abs(move).toFixed(0)}bp`;
  } else {
    move = (q.price / q.prevClose - 1) * 100;
    text = `${move >= 0 ? "+" : "−"}${Math.abs(move).toFixed(1)}%`;
  }
  const triggered = g.upOnly ? move >= g.threshold : Math.abs(move) >= g.threshold;
  return { move, text, triggered, time: q.time || null };
}
export const evalGauges = quotes =>
  MARKET_GAUGES.map(g => ({ ...g, result: evalGauge(g, quotes?.[g.sym]) }));

// Merge both signals per topic. Only topics the reader hasn't already turned up
// are offered (a hidden topic that is surging is offered too — exactly the
// story a tilted feed would miss).
export function buildSuggestions({ surges, gauges, records }) {
  const out = {};
  const add = (id, reason) => { if (topicById(id)) (out[id] ||= []).push(reason); };
  for (const [id, s] of Object.entries(surges || {})) add(id, { kind: "surge", text: `coverage ×${s.ratio.toFixed(1)}` });
  for (const g of gauges || []) {
    if (g.result?.triggered) g.topics.forEach(id => add(id, { kind: "gauge", text: `${g.label} ${g.result.text}` }));
  }
  return Object.entries(out)
    .filter(([id]) => { const l = records?.[id]?.level; return l !== "up" && l !== "focus"; })
    .map(([id, reasons]) => ({ id, label: topicById(id).label, reasons }))
    .sort((a, b) => b.reasons.length - a.reasons.length);
}
