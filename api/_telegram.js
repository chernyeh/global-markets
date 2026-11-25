/* global process */
// Telegram Bot API helper. The bot token lives only in Vercel
// (TELEGRAM_BOT_TOKEN); the chat to message is linked once from the app
// (your first message to the bot reveals the chat id) and kept in gm_kv.

const api = method => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function call(method, body) {
  if (!telegramConfigured()) throw new Error("TELEGRAM_BOT_TOKEN is not set in Vercel");
  const r = await fetch(api(method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`Telegram ${method}: ${j?.description || r.status}`);
  return j.result;
}

export const sendMessage = (chatId, html) =>
  call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true });

// The most recent private chat that messaged the bot (you, after pressing Start).
export async function findChat() {
  const updates = await call("getUpdates", { limit: 50, timeout: 0 });
  const chats = (updates || []).map(u => u.message?.chat || u.my_chat_member?.chat).filter(c => c && c.type === "private");
  const c = chats[chats.length - 1];
  return c ? { chatId: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "you" } : null;
}

const SEV_LABEL = { act: "🔴 ACT", watch: "🟠 WATCH", info: "🔵 INFO" };
export function formatAlert(a, appUrl, linkLabel = "Open the macro monitor") {
  return [
    `<b>${SEV_LABEL[a.sev] || a.sev}</b> · ${a.kind === "watch" ? "◎ " : ""}${esc(a.title)}`,
    a.detail ? esc(a.detail) : null,
    a.action ? `→ ${esc(a.action)}` : null,
    a.guard ? `⚑ <i>No action unless:</i> ${esc(a.guard)}` : null,
    appUrl ? `<a href="${esc(appUrl)}">${esc(linkLabel)}</a>` : null,
  ].filter(Boolean).join("\n");
}

export function formatDigest(alerts, appUrl, { title = "Macro monitor", linkLabel = "Open the macro monitor" } = {}) {
  const lines = alerts.slice(0, 12).map(a => `• <b>${(SEV_LABEL[a.sev] || a.sev).split(" ")[1]}</b> ${esc(a.title)}`);
  return [`<b>${esc(title)}: ${alerts.length} new alerts</b>`, ...lines, alerts.length > 12 ? `…and ${alerts.length - 12} more` : null,
    appUrl ? `<a href="${esc(appUrl)}">${esc(linkLabel)}</a>` : null].filter(Boolean).join("\n");
}
