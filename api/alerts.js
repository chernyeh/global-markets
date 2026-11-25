/* global process */
// Scheduled alert check for the macro monitor — the "while the app is closed"
// half of the alerts. Runs every 3 hours on weekdays from GitHub Actions and once a day
// from Vercel Cron (Hobby plan limit); both send Authorization: Bearer CRON_SECRET.
//
// GET /api/alerts  (Authorization: Bearer <CRON_SECRET>)
// Each run: fetch every source directly, evaluate the playbook signals with the
// settings synced from the app (hand-set signals, paste-ins, release consensus),
// diff against the last run with the same alert engine the browser uses, add
// new FOMC statements/minutes and ECB decisions from the banks' own feeds, add a
// once-a-day reminder of deferred decisions that are due, store everything in
// Supabase (gm_ tables) and push to Telegram. Then the watchlist: prices for
// every Gloomberg watchlist name and holding, checked against your levels
// (alert price, thesis Munger/entry/exit/invalidation, holding target/stop)
// and for big daily moves — pushed as you set on the Watchlist tab.

import { fetchSourceDirect } from "./macro.js";
import { kvGet, kvSet, insertAlerts, listDecisions, supabaseConfigured } from "./_supabase.js";
import { sendMessage, formatAlert, formatDigest, telegramConfigured } from "./_telegram.js";
import { collectMacro, resolveMacro } from "../src/macroData.js";
import { evaluateSignals } from "../src/macroSignals.js";
import { updateAlerts, SEV_RANK } from "../src/macroAlerts.js";
import { parseRss } from "../src/macroSpeech.js";
import { loadCoverage } from "./_watchlist.js";
import { buildRows } from "../src/watchRows.js";
import { seriesStats, evaluateWatchAlerts, pushable } from "../src/watchCalc.js";

export const config = { maxDuration: 120 };

const OFFICIAL = [
  { bank: "Fed", url: "https://www.federalreserve.gov/feeds/press_monetary.xml", re: /FOMC statement|Minutes of the Federal Open Market Committee/i },
  { bank: "ECB", url: "https://www.ecb.europa.eu/rss/press.html", re: /monetary policy decisions|monetary policy statement|account of the monetary policy meeting/i },
  { bank: "BoJ", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", re: /^Statement on Monetary Policy|^Change in the Guideline for Money Market Operations|Summary of Opinions at the Monetary Policy Meeting|Minutes of the Monetary Policy Meeting/i },
];

const authorised = req => !!process.env.CRON_SECRET && (req.headers?.authorization || "") === `Bearer ${process.env.CRON_SECRET}`;
const today = () => new Date().toISOString().slice(0, 10);

async function officialAlerts(seen, signal, now, baseline) {
  const out = [];
  for (const f of OFFICIAL) {
    try {
      const r = await fetch(f.url, { signal, headers: { "User-Agent": "GlobalMarketsWire/1.0 (macro monitor)" } });
      for (const it of parseRss(await r.text())) {
        if (!f.re.test(it.title) || now - it.ts > 3 * 86400000) continue;
        const key = it.link || it.title;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!baseline) out.push({ kind: "official", ref: key, sev: "watch", title: `${f.bank}: ${it.title}`, detail: `Published ${it.date}. ${it.link}` });
      }
    } catch { /* a feed hiccup only delays the alert to the next run */ }
  }
  return out;
}

// Watchlist check: same rows and alert rules as the browser (src/watchRows.js,
// src/watchCalc.js); its own state in gm_kv so the browser and the server
// each fire once per crossing.
async function watchCheck(now, signal) {
  const list = await loadCoverage();
  const base = buildRows(list, {}, {}, {}, []);
  if (!base.length) return { names: 0, priced: 0, fresh: [], prefs: list.prefs };
  const syms = [...new Set([...base.map(r => r.ticker), ...base.map(r => r.benchSym).filter(Boolean)])];
  const quotes = {};
  for (let i = 0; i < syms.length; i += 100) {
    const r = await fetchSourceDirect("yahoo", syms.slice(i, i + 100), null, signal);
    for (const [k, s] of Object.entries(r.series || {})) { const st = seriesStats(s); if (st) quotes[k] = st; }
  }
  const rows = buildRows(list, quotes, {}, {}, [], now);
  const prev = (await kvGet("watch_alert_state"))?.value || null;
  const { state, fresh } = evaluateWatchAlerts(prev, rows, { now, prefs: list.prefs });
  await kvSet("watch_alert_state", state);
  return { names: rows.length, priced: rows.filter(r => r.q).length, fresh, prefs: list.prefs };
}

export default async function handler(req, res) {
  if (!authorised(req)) { res.status(401).json({ error: "unauthorised" }); return; }
  if (!supabaseConfigured()) { res.status(500).json({ error: "SUPABASE_SECRET_KEY is not set in Vercel" }); return; }
  const now = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 105000);
  try {
    const [stateRec, settingsRec, tgRec] = await Promise.all([kvGet("server_alert_state"), kvGet("settings"), kvGet("telegram")]);
    const settings = settingsRec?.value || {};
    const prev = stateRec?.value || null;

    const raw = await collectMacro(r => fetchSourceDirect(r.src, r.ids, r.start, ctl.signal));
    const series = resolveMacro(raw);
    const results = evaluateSignals(series, { manual: settings.manual || {}, pasted: settings.pasted || {} });
    const { newAlerts, ...state } = updateAlerts(prev, { results, series, health: raw.health, now });

    const seen = new Set(prev?.seenOfficial || []);
    const extra = await officialAlerts(seen, ctl.signal, now, !prev);
    state.seenOfficial = [...seen].slice(-100);

    // Deferred decisions that are due: one reminder a day (the day is carried
    // forward explicitly — updateAlerts only returns its own fields).
    state.dueNotified = prev?.dueNotified || null;
    if (state.dueNotified !== today()) {
      try {
        const due = (await listDecisions(365)).filter(d => d.decision === "deferred" && !d.resolved && d.due_date && d.due_date <= today());
        if (due.length) {
          extra.push({ kind: "decision", ref: "due", sev: "watch",
            title: `${due.length} deferred decision${due.length > 1 ? "s are" : " is"} due`,
            detail: due.slice(0, 4).map(d => `${d.signal_id ? `Signal ${d.signal_id.replace(/^s/, "")}` : "Alert"}: ${d.note || d.value_at || ""} (due ${d.due_date})`).join(" · "),
            guard: "If no new fact would change it, decide now — waiting longer is fortification, not diligence." });
        }
        state.dueNotified = today();
      } catch { /* retried next run */ }
    }

    const all = [...newAlerts, ...extra.map((a, i) => ({ ...a, id: `${now}-x${i}`, at: now }))];

    // Push: individual messages for up to four alerts, else one digest.
    const tg = tgRec?.value || {};
    const minRank = SEV_RANK[tg.minSev || "watch"] ?? 1;
    const toPush = all.filter(a => (SEV_RANK[a.sev] ?? 0) >= minRank);
    const appUrl = process.env.APP_URL || (req.headers?.host ? `https://${req.headers.host}` : null);
    const pushed = new Set();
    let pushError = null;
    if (toPush.length && telegramConfigured() && tg.chatId && !tg.paused) {
      try {
        if (toPush.length <= 4) {
          for (const a of toPush) { await sendMessage(tg.chatId, formatAlert(a, appUrl)); pushed.add(a.id); }
        } else {
          await sendMessage(tg.chatId, formatDigest(toPush, appUrl));
          toPush.forEach(a => pushed.add(a.id));
        }
      } catch (e) { pushError = e.message; }
    } else if (toPush.length) {
      pushError = !telegramConfigured() ? "TELEGRAM_BOT_TOKEN not set" : !tg.chatId ? "Telegram chat not linked" : "push paused";
    }

    await insertAlerts(all.map(a => ({
      id: `srv-${a.id}`, at: new Date(a.at).toISOString(), origin: "server", kind: a.kind, ref: a.ref || null, sev: a.sev,
      title: a.title, detail: a.detail || null, action: a.action || null, guard: a.guard || null,
      pushed: pushed.has(a.id), push_error: pushed.has(a.id) || !toPush.includes(a) ? null : pushError,
    })));

    // ── Watchlist (skipped if the macro half left too little time) ──
    let watch = null;
    if (Date.now() - now < 75000) {
      try {
        const w = await watchCheck(now, ctl.signal);
        const toSend = w.fresh.filter(a => pushable(a, w.prefs));
        const sent = new Set();
        let wErr = null;
        if (toSend.length && telegramConfigured() && tg.chatId && !tg.paused) {
          const link = { title: "Watchlist", linkLabel: "Open the watchlist" };
          try {
            if (toSend.length <= 4) for (const a of toSend) { await sendMessage(tg.chatId, formatAlert(a, appUrl, link.linkLabel)); sent.add(a.id); }
            else { await sendMessage(tg.chatId, formatDigest(toSend, appUrl, link)); toSend.forEach(a => sent.add(a.id)); }
          } catch (e) { wErr = e.message; }
        } else if (toSend.length) {
          wErr = !telegramConfigured() ? "TELEGRAM_BOT_TOKEN not set" : !tg.chatId ? "Telegram chat not linked" : "push paused";
        }
        await insertAlerts(w.fresh.map(a => ({
          id: `srv-${a.id}`, at: new Date(a.at).toISOString(), origin: "server", kind: "watch", ref: a.ref, sev: a.sev,
          title: a.title, detail: a.detail || null, action: null, guard: null,
          pushed: sent.has(a.id), push_error: sent.has(a.id) || !toSend.includes(a) ? null : wErr,
        })));
        watch = { names: w.names, priced: w.priced, alerts: w.fresh.length, pushed: sent.size, pushError: wErr };
      } catch (e) { watch = { error: e.message }; }
    } else watch = { skipped: "out of time" };

    const summary = {
      at: now, ms: Date.now() - now, baseline: !prev, alerts: all.length, pushed: pushed.size, pushError, watch,
      sources: Object.fromEntries(Object.entries(raw.health).map(([k, h]) => [k, `${h.ok}/${h.requested}${h.error ? ` ${h.error}` : ""}`])),
    };
    await kvSet("server_alert_state", { ...state, alerts: (state.alerts || []).slice(0, 40), lastRun: summary });
    res.status(200).json({ ok: true, ...summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    clearTimeout(timer);
  }
}
