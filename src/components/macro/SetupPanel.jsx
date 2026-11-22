import { useState } from "react";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn, inputStyle } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

// What each Vercel environment variable unlocks (names only; values never reach the browser).
const ENV = [
  ["FRED_API_KEY", "FRED", "Treasury real yields, breakevens, credit spreads, spot oil/gas fallbacks"],
  ["BLS_API_KEY", "BLS", "CPI and PPI components, core breadth (signal 4)"],
  ["GIE_API_KEY", "GIE", "EU gas storage vs the 5-year average"],
  ["ANTHROPIC_KEY", "Claude", "speech classification, evidence reads, Macro read"],
  ["SUPABASE_SECRET_KEY", "Supabase", "server alert state, synced settings, decision log"],
  ["TELEGRAM_BOT_TOKEN", "Telegram", "push alerts while the app is closed"],
  ["CRON_SECRET", "Scheduler", "lets only the scheduler run /api/alerts"],
  ["GM_APP_KEY", "App key", "the passphrase this browser sends to read and write your data"],
];
const SEV_OPTS = [["act", "ACT only"], ["watch", "ACT + WATCH"], ["info", "everything"]];

// Phase 4 setup: environment checklist, the app key, Telegram linking and
// preferences, and the last scheduled server check.
export default function SetupPanel({ m }) {
  const fs = useFs();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const st = m.sync.status;
  const env = st?.env || {};
  const tg = st?.telegram || null;
  const run = st?.server || null;
  const missing = ENV.filter(([k]) => !env[k]).length;
  const pushOn = !!(env.TELEGRAM_BOT_TOKEN && tg?.linked && !tg?.paused);

  const act = async (label, fn) => {
    setBusy(label); setMsg(null);
    const r = await fn();
    setBusy(null);
    setMsg(r?.ok ? { ok: true, text: r.text || "done" } : { ok: false, text: r?.error || "failed" });
  };
  const keyState = !m.appKey ? ["not entered", C.mute] : !st ? ["checking…", C.mute] : m.sync.authorised ? ["accepted ✓", C.green]
    : env.GM_APP_KEY ? ["wrong key — not accepted", C.red] : ["GM_APP_KEY is not set in Vercel yet", C.goldDark];

  return (
    <div id="gm-macro-setup" style={{ ...card, padding: "8px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>SETUP · PUSH ALERTS & SYNC</span>
        <span style={smallMono(fs, pushOn ? C.green : C.mute)}>{pushOn ? `Telegram push on${tg?.name ? ` (${tg.name})` : ""}` : "push alerts off"}</span>
        <span style={smallMono(fs)}>
          {run ? `server check ${fmtStamp(run.at)} · ${run.alerts} alert${run.alerts === 1 ? "" : "s"}, ${run.pushed} pushed` : m.sync.authorised ? "no server check has run yet" : ""}
          {missing ? ` · ${missing} of ${ENV.length} keys missing` : st ? " · all keys set" : ""}
        </span>
        <button onClick={() => setOpen(o => !o)} style={{ ...chipBtn(open, C.ink), marginLeft: "auto" }}>{open ? "close" : "open setup"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={smallMono(fs, C.sub)}>VERCEL ENVIRONMENT VARIABLES</div>
            {ENV.map(([k, short, what]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "12px 74px minmax(0,1fr)", gap: 6, alignItems: "baseline", padding: "2px 0", borderBottom: `1px solid ${C.line2}` }}>
                <span style={{ fontFamily: MONO, fontSize: fs(9), color: !st ? C.ghost : env[k] ? C.green : C.goldDark }}>{env[k] ? "●" : "○"}</span>
                <span style={{ fontFamily: MONO, fontSize: fs(9), color: C.ink }} title={k}>{short}</span>
                <span style={{ fontFamily: SERIF, fontSize: fs(11), color: C.sub }}>{what}</span>
              </div>
            ))}
            <div style={{ ...smallMono(fs), marginTop: 4 }}>● set · ○ not set. Set in Vercel → Project → Settings → Environment Variables, then redeploy.</div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={smallMono(fs, C.sub)}>APP KEY (THIS BROWSER)</div>
            <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
              <input type="password" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === "Enter" && key && (m.setAppKey(key), setKey(""))}
                placeholder={m.appKey ? "•••••• saved — type to replace" : "the GM_APP_KEY passphrase"} style={{ ...inputStyle, flex: "1 1 160px" }} aria-label="App key" autoComplete="off" />
              <button onClick={() => { if (key) { m.setAppKey(key); setKey(""); } }} style={chipBtn(false, C.ink)}>save</button>
              {m.appKey && <button onClick={() => m.setAppKey("")} style={chipBtn(false, C.ink)}>forget</button>}
            </div>
            <div style={{ ...smallMono(fs, keyState[1]), marginTop: 2 }}>{keyState[0]}</div>
            <div style={{ fontFamily: SERIF, fontSize: fs(11), color: C.sub, marginTop: 2, lineHeight: 1.4 }}>
              Kept in this browser only. With it, your pasted values, manual signal statuses, scenario weights and events sync to Supabase — so the
              scheduled server check sees them — and the decision log follows you across devices.
            </div>
            <div style={{ ...smallMono(fs), marginTop: 3 }}>
              {m.sync.lastSync ? `last sync ${fmtStamp(m.sync.lastSync)}` : "not synced"}
              {m.sync.error && <span style={{ color: C.red }}> · {m.sync.error}</span>}
              <button onClick={m.syncAll} style={{ ...chipBtn(false), marginLeft: 6 }}>sync now</button>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={smallMono(fs, C.sub)}>TELEGRAM</div>
            <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.ink, marginTop: 2 }}>
              {!env.TELEGRAM_BOT_TOKEN ? "Bot token not set in Vercel." : tg?.linked ? `Linked to ${tg.name || "your chat"}.` : "Bot ready — not linked to a chat yet."}
            </div>
            {!tg?.linked && <div style={{ fontFamily: SERIF, fontSize: fs(11), color: C.sub, lineHeight: 1.4 }}>Open your bot in Telegram, press <b>Start</b>, then press <b>link</b> here.</div>}
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
              <button disabled={!m.sync.authorised || !!busy} onClick={() => act("link", async () => { const r = await m.telegram("link"); return r.ok ? { ok: true, text: `linked to ${r.name}` } : r; })}
                style={{ ...chipBtn(false, C.ink), opacity: m.sync.authorised ? 1 : 0.5 }}>{busy === "link" ? "linking…" : tg?.linked ? "re-link" : "link"}</button>
              <button disabled={!tg?.linked || !!busy} onClick={() => act("test", async () => { const r = await m.telegram("test"); return r.ok ? { ok: true, text: "test sent — check Telegram" } : r; })}
                style={{ ...chipBtn(false, C.ink), opacity: tg?.linked ? 1 : 0.5 }}>{busy === "test" ? "sending…" : "send test"}</button>
              {tg?.linked && <>
                <select value={tg.minSev || "watch"} onChange={e => act("prefs", () => m.telegram("prefs", { minSev: e.target.value, paused: !!tg.paused }))}
                  style={{ ...inputStyle, fontSize: 9 }} aria-label="Push which alerts">
                  {SEV_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => act("prefs", () => m.telegram("prefs", { minSev: tg.minSev || "watch", paused: !tg.paused }))} style={chipBtn(!!tg.paused, C.ink)}>
                  {tg.paused ? "paused — resume" : "pause"}</button>
              </>}
            </div>
            {msg && <div style={{ ...smallMono(fs, msg.ok ? C.green : C.red), marginTop: 3 }}>{msg.text}</div>}
            <div style={{ fontFamily: SERIF, fontSize: fs(11), color: C.sub, marginTop: 4, lineHeight: 1.4 }}>
              The server check runs hourly on weekdays and every 6 hours at weekends (GitHub Actions), plus once a day from Vercel as a backstop.
              It pushes new alerts at or above the level chosen, FOMC statements and minutes, ECB decisions, and deferred decisions that fall due.
            </div>
            {run && <div style={{ ...smallMono(fs), marginTop: 3 }} title={Object.entries(run.sources || {}).map(([k, v]) => `${k} ${v}`).join("\n")}>
              last run {fmtStamp(run.at)} · {Math.round((run.ms || 0) / 1000)}s{run.baseline ? " · baseline set" : ""}
              {run.pushError && <span style={{ color: C.red }}> · {run.pushError}</span>} · hover for sources
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
