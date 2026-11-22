// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — central-bank communications tracker (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline, run from the monitor hook every 30 minutes while the page is open:
//   1. collectSpeechItems  — read the official Fed/ECB feeds and the news queries
//   2. officialText        — for the banks' own speeches/interviews, fetch the page
//                            and keep the policy-relevant passages
//   3. classifyItems       — Haiku scores each item: relevant?, speaker, stance
//                            −2..+2, a verbatim quote, topics, end-of-hikes read,
//                            and (for Q&A transcripts) questions not answered
//   4. derived views       — stance shifts per speaker, a weighted hawk–dove index
// Quotes are checked against the source text; a quote that isn't verbatim is
// dropped and the item is flagged. Nothing here ever sets a signal: evidence
// suggestions are shown for you to accept or ignore.

import { FED_ROSTER, ECB_ROSTER, SPEECH_FEEDS, TRUSTED_OUTLETS, EVIDENCE_QUERIES } from "./data/macroSpeakers.js";
import { SIGNAL_MAP } from "./data/macroSignals.js";

const DAY = 86400000;
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

// ─── Parsing ───────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", euro: "€" };
export function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => ENT[k.toLowerCase()] ?? m);
}

export function hashId(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

// RSS 2.0 items → { title, link, date, description, outlet }. Regex-based so it
// runs the same in the browser and in tests.
export function parseRss(xml) {
  const out = [];
  for (const chunk of String(xml || "").split(/<item[\s>]/).slice(1)) {
    const g = t => decodeEntities((chunk.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "").trim();
    let title = g("title").replace(/<[^>]+>/g, "");
    const outlet = g("source");
    // Google News appends " - Outlet" to every headline.
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    const t = Date.parse(g("pubDate") || g("dc:date"));
    if (!title || !Number.isFinite(t)) continue;
    out.push({ title, link: g("link") || g("guid"), date: isoDay(t), ts: t,
      description: g("description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400), outlet });
  }
  return out;
}

const POLICY_RE = /\b(rate|rates|inflation|policy|hike|hikes|tighten|tightening|eas(e|ing)|cut|cuts|restrictive|neutral|balance sheet|price stability|labou?r market|wage|expectations|Zins|Inflation|taux|inflation|tassi|tipos)\b/i;

// Main text of a Fed or ECB page, keeping the passages about policy first.
export function extractArticleText(html, maxChars = 3000, { keepOrder = false } = {}) {
  let s = String(html || "");
  const anchors = [/id="article"/, /<main[\s>]/, /class="section"/];
  for (const a of anchors) { const i = s.search(a); if (i > 0) { s = s.slice(i); break; } }
  const text = decodeEntities(s.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<\/(p|div|h\d|li)>/g, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");
  const paras = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 40);
  const head = paras.slice(0, 2).join(" ").slice(0, 400);
  // Interviews keep their question-and-answer order so unanswered questions can be seen.
  const policy = keepOrder ? paras.slice(2) : paras.filter(p => POLICY_RE.test(p));
  let body = "";
  for (const p of (policy.length ? policy : paras)) { if (body.length + p.length > maxChars) break; body += `${p}\n`; }
  return `${head}\n${body}`.slice(0, maxChars + 400).trim();
}

const norm = s => String(s || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const trusted = outlet => !!outlet && TRUSTED_OUTLETS.some(o => outlet.toLowerCase().includes(o.toLowerCase()));

export async function collectSpeechItems(fetchText, { now = Date.now(), maxAgeDays = 14 } = {}) {
  const res = await Promise.allSettled(SPEECH_FEEDS.map(async f => ({ f, items: parseRss(await fetchText(f.url)) })));
  const seen = new Set(), out = [], errors = [];
  res.forEach((r, i) => {
    if (r.status !== "fulfilled") { errors.push(`${SPEECH_FEEDS[i].id}: ${r.reason?.message || "failed"}`); return; }
    const { f, items } = r.value;
    for (const it of items) {
      if (now - it.ts > maxAgeDays * DAY) continue;
      const key = norm(it.title).replace(/[^a-z0-9 ]/g, "").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      const official = f.kind === "official";
      out.push({ ...it, id: hashId(it.link || it.title), bank: f.bank, kind: f.kind, feed: f.id, lang: f.lang || "en",
        outlet: official ? (f.bank === "fed" ? "Federal Reserve" : "ECB") : it.outlet,
        trusted: official || trusted(it.outlet) });
    }
  });
  out.sort((a, b) => b.ts - a.ts);
  return { items: out, errors };
}

export async function officialText(item, fetchText) {
  if (item.kind !== "official" || !item.link || /\.pdf($|\?)/i.test(item.link)) return null;
  const interview = /\/inter\/|interview/i.test(`${item.link} ${item.title}`);
  try { return extractArticleText(await fetchText(item.link), interview ? 5000 : 3000, { keepOrder: interview }); } catch { return null; }
}

// ─── Classification ────────────────────────────────────────────────────────
export const CLASSIFY_SYSTEM = `You classify central-bank communication for an investment monitor. The Fed and the ECB are both in a rate-hiking cycle. For each item return one JSON object with these fields:
- "id": exactly as given.
- "relevant": true only if the item reports a named Fed FOMC participant, the FOMC, an ECB Executive Board member, a euro-area national central bank governor, or the ECB Governing Council giving a view on monetary policy (rates, inflation, the balance sheet, the policy outlook). False for supervision, payments, climate, events or ceremonies unless the text also gives a policy view.
- "speaker": surname as written (e.g. "Waller"); "FOMC" for FOMC statements or minutes; "Governing Council" for ECB decisions; "" if unclear.
- "role": the role stated in the text, else "".
- "venue": one of speech, interview, testimony, statement, minutes, decision, press_conference, report, news.
- "stance": integer from -2 to 2 for the policy-rate path the speaker implies: 2 = argues for larger or faster hikes; 1 = leans to further tightening; 0 = balanced, data-dependent with no lean, or no policy view; -1 = leans to pausing or easing sooner; -2 = argues for cuts or an end to hikes now.
- "quote": up to 30 words copied EXACTLY, character for character, from the TITLE or TEXT, that best shows the stance; "" if none.
- "topics": up to 3 of inflation, labour, growth, energy, balance_sheet, financial_stability, fiscal, fx, rates_path, communication.
- "endOfHikes": for FOMC statements/minutes, the Fed Chair, ECB decisions or the ECB President only: "yes" if it signals hikes are over, "no" if it signals more, otherwise "unclear". For everyone else "unclear".
- "nonAnswers": only when the TEXT is a question-and-answer transcript: questions the speaker did not answer directly, each {"q": the question in at most 15 words, "reason": one plausible legitimate reason, e.g. blackout period, avoiding pre-commitment, outside their remit, market sensitivity}. Not answering is not in itself a red flag. Otherwise [].
Rules: use only the text provided; never invent numbers or quotes; when unsure use stance 0 and relevant false.
Return ONLY a JSON array, no prose.`;

export function buildClassifyPrompt(batch) {
  return batch.map((it, i) => [
    `#${i + 1}`, `ID: ${it.id}`, `BANK: ${it.bank === "fed" ? "Federal Reserve" : "ECB"}`,
    `SOURCE: ${it.outlet || "unknown"} (${it.date})`, `TITLE: ${it.title}`,
    it.text ? `TEXT: ${it.text}` : it.description ? `TEXT: ${it.description}` : null,
  ].filter(Boolean).join("\n")).join("\n\n");
}

const TOPICS = new Set(["inflation", "labour", "growth", "energy", "balance_sheet", "financial_stability", "fiscal", "fx", "rates_path", "communication"]);
export function parseClassifyResponse(text, batch) {
  const m = String(text || "").match(/\[[\s\S]*\]/);
  if (!m) throw new Error("classifier returned no JSON array");
  const arr = JSON.parse(m[0]);
  const byId = new Map(batch.map(b => [b.id, b]));
  const out = {};
  for (const c of Array.isArray(arr) ? arr : []) {
    const it = byId.get(String(c?.id));
    if (!it) continue;
    const stance = Math.max(-2, Math.min(2, Math.round(Number(c.stance) || 0)));
    let quote = String(c.quote || "").trim().replace(/^["“]|["”]$/g, "");
    const source = norm(`${it.title} ${it.text || it.description || ""}`);
    const verbatim = !quote || source.includes(norm(quote));
    if (!verbatim) quote = "";
    out[it.id] = {
      relevant: c.relevant === true, speaker: String(c.speaker || "").trim().slice(0, 40), role: String(c.role || "").slice(0, 60),
      venue: String(c.venue || "news"), stance, quote: quote.slice(0, 240), quoteDropped: !verbatim,
      topics: (Array.isArray(c.topics) ? c.topics : []).filter(t => TOPICS.has(t)).slice(0, 3),
      endOfHikes: ["yes", "no"].includes(c.endOfHikes) ? c.endOfHikes : "unclear",
      nonAnswers: (Array.isArray(c.nonAnswers) ? c.nonAnswers : []).slice(0, 4).map(n => ({ q: String(n?.q || "").slice(0, 120), reason: String(n?.reason || "").slice(0, 160) })).filter(n => n.q),
    };
  }
  return out;
}

// classify(system, prompt) → text. Batches of 10, two at a time.
export async function classifyItems(items, classify, { batchSize = 10 } = {}) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));
  const out = {}, errors = [];
  for (let i = 0; i < batches.length; i += 2) {
    const res = await Promise.allSettled(batches.slice(i, i + 2).map(async b => parseClassifyResponse(await classify(CLASSIFY_SYSTEM, buildClassifyPrompt(b)), b)));
    res.forEach(r => { if (r.status === "fulfilled") Object.assign(out, r.value); else errors.push(r.reason?.message || "classification failed"); });
  }
  return { results: out, errors };
}

// ─── Roster, shifts, index ────────────────────────────────────────────────
const plain = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function rosterFor(speaker, bank) {
  const list = bank === "fed" ? FED_ROSTER : ECB_ROSTER;
  const p = plain(speaker);
  if (!p) return null;
  return list.find(r => [r.name, ...(r.aliases || [])].some(n => p.includes(plain(n)))) || null;
}

const ROLE_WEIGHT = { FOMC: 3, "Governing Council": 3 };
export function itemWeight(it) {
  if (!it.relevant) return 0;
  const r = rosterFor(it.speaker, it.bank);
  const w = ROLE_WEIGHT[it.speaker] ?? r?.weight ?? 0.5;
  return w * (it.trusted ? 1 : 0); // untrusted outlets are shown but not counted
}

// One statement per speaker per day: several outlets reporting the same remarks
// must not count several times in the index, nor read as a "shift" against
// themselves. The representative is the bank's own text if there is one, else a
// trusted outlet with a verified quote; the stance is the median of the reports.
const speakerKey = it => `${it.bank}:${plain(rosterFor(it.speaker, it.bank)?.name || it.speaker)}`;
export function consolidate(items) {
  const groups = new Map(), loose = [];
  for (const it of items) {
    if (!it.relevant || !it.speaker) { loose.push(it); continue; }
    const k = `${speakerKey(it)}:${it.date}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(it);
  }
  const rank = it => (it.kind === "official" ? 4 : 0) + (it.trusted ? 2 : 0) + (it.quote ? 1 : 0);
  const out = [];
  for (const g of groups.values()) {
    const rep = [...g].sort((a, b) => rank(b) - rank(a) || b.ts - a.ts)[0];
    const st = g.map(x => x.stance).sort((a, b) => a - b);
    const median = Math.round(st[Math.floor((st.length - 1) / 2)] * 0.5 + st[Math.ceil((st.length - 1) / 2)] * 0.5);
    out.push({ ...rep, stance: median, ids: g.map(x => x.id), reports: g.length,
      outlets: [...new Set(g.map(x => x.outlet).filter(Boolean))], trusted: g.some(x => x.trusted),
      nonAnswers: g.flatMap(x => x.nonAnswers || []).slice(0, 4) });
  }
  return [...out, ...loose];
}

// Adds prev (the same speaker's previous stance, on an earlier day) and shift.
export function withShifts(rawItems) {
  const items = consolidate(rawItems);
  const sorted = [...items].sort((a, b) => a.ts - b.ts);
  const last = {};
  const out = {};
  for (const it of sorted) {
    if (!it.relevant || !it.speaker) { out[it.id] = it; continue; }
    const key = speakerKey(it);
    const prev = last[key];
    const shift = prev && it.ts - prev.ts < 120 * DAY ? it.stance - prev.stance : null;
    out[it.id] = { ...it, prev: prev ? { stance: prev.stance, date: prev.date } : null, shift };
    last[key] = it;
  }
  return items.map(it => out[it.id]);
}

// Weighted average stance over a trailing window, sampled daily.
export function hawkDove(items, bank, { now = Date.now(), window = 21, days = 60 } = {}) {
  const rel = (items.some(it => it.ids) ? items : consolidate(items)).filter(it => it.bank === bank && itemWeight(it) > 0);
  const at = t => {
    const inWin = rel.filter(it => it.ts <= t && t - it.ts < window * DAY);
    const w = inWin.reduce((a, it) => a + itemWeight(it), 0);
    return w ? { v: inWin.reduce((a, it) => a + itemWeight(it) * it.stance, 0) / w, n: inWin.length } : null;
  };
  const series = [];
  for (let k = days; k >= 0; k--) {
    const t = now - k * DAY;
    const x = at(t);
    if (x) series.push([isoDay(t), Math.round(x.v * 100) / 100]);
  }
  const cur = at(now);
  return { value: cur?.v ?? null, n: cur?.n ?? 0, series };
}

// Which new items to classify this run: official and trusted-outlet items only
// (untrusted aggregators are skipped), newest first, capped per run.
export function pickForClassification(items, store, { max = 40, maxAgeDays = 10, now = Date.now() } = {}) {
  return items.filter(it => (it.kind === "official" || it.trusted) && !store?.[it.id] && now - it.ts < maxAgeDays * DAY)
    .sort((a, b) => b.ts - a.ts).slice(0, max);
}

// Store merge: keep 120 days for shift history, at most 400 items.
export function mergeSpeechStore(prev, fresh, results, now = Date.now()) {
  const items = { ...(prev?.items || {}) };
  for (const it of fresh) {
    const c = results[it.id];
    if (c) items[it.id] = { ...it, text: undefined, ...c, classifiedAt: now };
  }
  const kept = Object.values(items).filter(it => now - it.ts < 120 * DAY).sort((a, b) => b.ts - a.ts).slice(0, 400);
  return Object.fromEntries(kept.map(it => [it.id, it]));
}

// Alerts for newly classified items: a material stance shift by a weighted
// speaker (WATCH) and new FOMC statements / ECB decisions (INFO).
export function speechAlerts(newIds, store) {
  const all = withShifts(Object.values(store));
  const alerts = [];
  for (const it of all) {
    if (!(it.ids || [it.id]).some(id => newIds.has(id)) || !it.relevant) continue;
    const r = rosterFor(it.speaker, it.bank);
    const who = `${r?.full || it.speaker}${r ? ` (${r.role})` : ""}`;
    if (it.shift !== null && Math.abs(it.shift) >= 1 && itemWeight(it) >= 1.5) {
      alerts.push({ kind: "speech", ref: it.id, sev: "watch",
        title: `${who} turns ${it.shift > 0 ? "more hawkish" : "more dovish"} (${it.prev.stance > 0 ? "+" : ""}${it.prev.stance} → ${it.stance > 0 ? "+" : ""}${it.stance})`,
        detail: `${it.quote ? `“${it.quote}” — ` : ""}${it.outlet}, ${it.date}. Previous: ${it.prev.date}.` });
    } else if (["statement", "decision", "minutes"].includes(it.venue) && it.kind === "official") {
      alerts.push({ kind: "speech", ref: it.id, sev: "info", title: `${it.bank === "fed" ? "Fed" : "ECB"}: ${it.title}`,
        detail: `Read as ${it.stance > 0 ? "hawkish" : it.stance < 0 ? "dovish" : "neutral"} (${it.stance})${it.endOfHikes !== "unclear" ? `; end of hikes: ${it.endOfHikes}` : ""}.` });
    }
  }
  return alerts;
}

// ─── Evidence suggestions for the manual signals ──────────────────────────
export const EVIDENCE_SYSTEM = `You help a portfolio manager judge whether a pre-defined market signal is in place, using only the headlines given. Return ONLY JSON: {"suggest":"met"|"partial"|"not"|"unclear","reason":"one sentence that cites headline numbers like [2]","evidence":[headline numbers]}. If the headlines do not settle it, use "unclear". Never invent facts.`;

export function buildEvidencePrompt(sigId, headlines) {
  const s = SIGNAL_MAP[sigId];
  return `Signal: "${s.label}". Met when: ${s.threshold}.\nHeadlines (prefer established outlets; "unverified outlet" items need corroboration):\n${headlines.map((h, i) => `[${i + 1}] ${h.title} — ${h.outlet || "?"}${trusted(h.outlet) ? "" : " (unverified outlet)"}, ${h.date}`).join("\n")}`;
}

export function parseEvidence(text, headlines) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  const suggest = ["met", "partial", "not", "unclear"].includes(j.suggest) ? j.suggest : "unclear";
  const ev = (Array.isArray(j.evidence) ? j.evidence : []).map(n => headlines[Number(n) - 1]).filter(Boolean).slice(0, 3)
    .map(h => ({ title: h.title, outlet: h.outlet, date: h.date, link: h.link }));
  return { suggest, reason: String(j.reason || "").slice(0, 300), evidence: ev };
}

export async function evidenceSuggestions(fetchText, classify, { now = Date.now() } = {}) {
  const out = {};
  for (const [sigId, urls] of Object.entries(EVIDENCE_QUERIES)) {
    const lists = await Promise.allSettled(urls.map(async u => parseRss(await fetchText(u))));
    // Established outlets first (up to 9), then at most 3 others for coverage.
    const all = lists.flatMap(r => (r.status === "fulfilled" ? r.value : [])).filter(h => now - h.ts < 30 * DAY).sort((a, b) => b.ts - a.ts);
    const heads = [...all.filter(h => trusted(h.outlet)).slice(0, 9), ...all.filter(h => !trusted(h.outlet)).slice(0, 3)];
    if (!heads.length) { out[sigId] = { suggest: "unclear", reason: "No recent headlines found.", evidence: [], at: now }; continue; }
    try {
      const r = parseEvidence(await classify(EVIDENCE_SYSTEM, buildEvidencePrompt(sigId, heads)), heads);
      if (r) out[sigId] = { ...r, at: now };
    } catch (e) { out[sigId] = { suggest: "unclear", reason: `Could not assess: ${e.message}`, evidence: [], at: now }; }
  }
  return out;
}

// Signal 1 needs no extra call: the latest FOMC statement or Chair item with a
// clear end-of-hikes read is the evidence.
export function fedDoneSuggestion(items) {
  const it = items.filter(x => x.bank === "fed" && x.relevant && x.endOfHikes !== "unclear" &&
    (x.speaker === "FOMC" || plain(x.speaker).includes("warsh"))).sort((a, b) => b.ts - a.ts)[0];
  if (!it) return null;
  return { suggest: it.endOfHikes === "yes" ? "met" : "not", reason: `${it.speaker === "FOMC" ? "FOMC" : "Chair Warsh"}, ${it.date}: ${it.quote ? `“${it.quote}”` : it.title}`,
    evidence: [{ title: it.title, outlet: it.outlet, date: it.date, link: it.link }], at: it.classifiedAt };
}
