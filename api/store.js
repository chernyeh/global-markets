/* global process */
// Macro monitor storage and setup endpoint (Supabase gm_ tables, Telegram).
// Every call except ?kind=status needs the header x-gm-key = GM_APP_KEY — a
// passphrase you choose, set in Vercel and typed once into the app's Setup
// panel. Without it the site stays public but your data and Telegram don't.
//
//   GET  ?kind=status                 which keys are configured (booleans only) + last server run
//   GET  ?kind=settings               synced settings          POST same → save
//   GET  ?kind=alerts                 last 7 days of alerts (server pushes and browser)
//   GET  ?kind=decisions              decision log             POST → add   PATCH &id= → update
//   POST ?kind=telegram&action=link   link the chat that last messaged your bot
//   POST ?kind=telegram&action=test   send a test message
//   POST ?kind=telegram&action=prefs  { minSev, paused }

import { kvGet, kvSet, recentAlerts, listDecisions, insertDecision, updateDecision, supabaseConfigured } from "./_supabase.js";
import { telegramConfigured, findChat, sendMessage } from "./_telegram.js";

export const config = { maxDuration: 30 };

const ENV_KEYS = ["FRED_API_KEY", "BLS_API_KEY", "GIE_API_KEY", "ANTHROPIC_KEY", "SUPABASE_SECRET_KEY", "TELEGRAM_BOT_TOKEN", "CRON_SECRET", "GM_APP_KEY"];
const authorised = req => !!process.env.GM_APP_KEY && req.headers?.["x-gm-key"] === process.env.GM_APP_KEY;
const str = (v, n) => (v === null || v === undefined ? null : String(v).slice(0, n));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const kind = String(req.query?.kind || "");
  try {
    if (kind === "status") {
      const env = Object.fromEntries(ENV_KEYS.map(k => [k, k === "SUPABASE_SECRET_KEY"
        ? !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) : !!process.env[k]]));
      const ok = authorised(req);
      let server = null, telegram = null;
      if (ok && supabaseConfigured()) {
        const [st, tg] = await Promise.all([kvGet("server_alert_state"), kvGet("telegram")]);
        server = st?.value?.lastRun || null;
        telegram = tg?.value ? { linked: !!tg.value.chatId, name: tg.value.name || null, minSev: tg.value.minSev || "watch", paused: !!tg.value.paused } : { linked: false };
      }
      res.status(200).json({ env, authorised: ok, server, telegram });
      return;
    }
    if (!authorised(req)) { res.status(401).json({ error: "app key missing or wrong — set GM_APP_KEY in Vercel and enter it in Setup" }); return; }
    if (!supabaseConfigured()) { res.status(500).json({ error: "SUPABASE_SECRET_KEY is not set in Vercel" }); return; }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (kind === "settings") {
      if (req.method === "POST") {
        const v = body.value || {};
        const value = { manual: v.manual || {}, pasted: v.pasted || {}, scen: v.scen || null, userEvents: Array.isArray(v.userEvents) ? v.userEvents.slice(0, 200) : [],
          savedAt: Number(v.savedAt) || Date.now() };
        if (JSON.stringify(value).length > 200000) { res.status(413).json({ error: "settings too large" }); return; }
        await kvSet("settings", value);
        res.status(200).json({ ok: true, savedAt: value.savedAt });
      } else {
        const r = await kvGet("settings");
        res.status(200).json({ value: r?.value || null });
      }
      return;
    }

    if (kind === "alerts") { res.status(200).json({ alerts: await recentAlerts(7) }); return; }

    if (kind === "decisions") {
      if (req.method === "POST") {
        if (!["acted", "deferred", "no_action"].includes(body.decision)) { res.status(400).json({ error: "decision must be acted, deferred or no_action" }); return; }
        const due = /^\d{4}-\d{2}-\d{2}$/.test(body.due_date || "") ? body.due_date : null;
        const row = await insertDecision({ signal_id: str(body.signal_id, 8), alert_id: str(body.alert_id, 80), status_at: str(body.status_at, 20),
          value_at: str(body.value_at, 300), decision: body.decision, note: str(body.note, 1000), due_date: body.decision === "deferred" ? due : null });
        res.status(200).json({ decision: row });
      } else if (req.method === "PATCH") {
        const patch = {};
        if (typeof body.resolved === "boolean") { patch.resolved = body.resolved; patch.resolved_at = body.resolved ? new Date().toISOString() : null; }
        if (body.note !== undefined) patch.note = str(body.note, 1000);
        res.status(200).json({ decision: await updateDecision(String(req.query.id || ""), patch) });
      } else {
        res.status(200).json({ decisions: await listDecisions(180) });
      }
      return;
    }

    if (kind === "telegram" && req.method === "POST") {
      const action = String(req.query?.action || "");
      const cur = (await kvGet("telegram"))?.value || {};
      if (action === "prefs") {
        const next = { ...cur, minSev: ["act", "watch", "info"].includes(body.minSev) ? body.minSev : cur.minSev || "watch", paused: !!body.paused };
        await kvSet("telegram", next);
        res.status(200).json({ ok: true, telegram: { linked: !!next.chatId, name: next.name || null, minSev: next.minSev, paused: next.paused } });
        return;
      }
      if (!telegramConfigured()) { res.status(400).json({ error: "TELEGRAM_BOT_TOKEN is not set in Vercel" }); return; }
      if (action === "link") {
        const chat = await findChat();
        if (!chat) { res.status(404).json({ error: "No message found — open your bot in Telegram, press Start (or send any message), then try again." }); return; }
        await kvSet("telegram", { ...cur, chatId: chat.chatId, name: chat.name, linkedAt: Date.now(), minSev: cur.minSev || "watch" });
        await sendMessage(chat.chatId, "✅ <b>Macro monitor linked.</b> ACT and WATCH alerts will arrive here when the scheduled check finds them.");
        res.status(200).json({ ok: true, name: chat.name });
        return;
      }
      if (action === "test") {
        if (!cur.chatId) { res.status(400).json({ error: "Link Telegram first" }); return; }
        await sendMessage(cur.chatId, "🔔 <b>Test from the macro monitor.</b> Push alerts are working.");
        res.status(200).json({ ok: true });
        return;
      }
    }
    res.status(400).json({ error: `unknown request kind "${kind}"` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
