import { useState } from "react";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtStamp, fmtDate } from "../../macroFormat.js";
import DecisionLog, { DecisionForm } from "./DecisionLog.jsx";

const SEV = {
  act:   { label: "ACT",   color: "#fff", bg: C.red },
  watch: { label: "WATCH", color: C.amber, bg: C.amberBg },
  info:  { label: "INFO",  color: C.blue, bg: C.blueBg },
};
const DECIDED = { acted: ["✓ acted", C.green], deferred: ["⏸ deferred", C.goldDark], no_action: ["— no action", C.sub] };

export default function AlertInbox({ m, today }) {
  const { alerts, unread, markRead, notify, toggleNotify, decisions, logDecision, resolveDecision, results } = m;
  const fs = useFs();
  const [all, setAll] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const list = all ? alerts : alerts.filter(a => !a.read).slice(0, 6);
  const canNotify = typeof Notification !== "undefined";
  const due = m.dueDecisions(decisions, today);
  const byAlert = Object.fromEntries(decisions.filter(d => d.alert_id).map(d => [d.alert_id, d]));
  const pushOn = !!(m.sync.status?.telegram?.linked && !m.sync.status?.telegram?.paused && m.sync.status?.env?.TELEGRAM_BOT_TOKEN);

  const decide = async (a, f) => {
    const r = a.kind === "signal" ? results?.[a.ref] : null;
    await logDecision({ ...f, alert_id: a.id, signal_id: a.kind === "signal" ? a.ref : null,
      status_at: r?.status || a.sev, value_at: (r?.value ? String(r.value) : a.detail || "").slice(0, 300) });
    setDeciding(null);
    if (!a.read) markRead([a.id]);
  };

  return (
    <div style={{ ...card, padding: "10px 14px", marginBottom: 14, borderLeft: unread || due.length ? `3px solid ${C.red}` : `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>ALERTS · {unread} unread</span>
        <span style={smallMono(fs)}>
          in-app every 10 min while open · {pushOn ? "Telegram push on (server check, app closed)" : "Telegram push not set up — see Setup below"}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {canNotify && <button onClick={toggleNotify} style={chipBtn(notify, C.ink)} title="Show ACT and WATCH alerts as browser notifications while this tab is open">
            {notify ? "browser alerts on" : "browser alerts off"}</button>}
          {unread > 0 && <button onClick={() => markRead("all")} style={chipBtn(false, C.ink)}>mark all read</button>}
          {alerts.length > 0 && <button onClick={() => setAll(a => !a)} style={chipBtn(all, C.ink)}>{all ? "unread only" : `history (${alerts.length})`}</button>}
          <button onClick={() => setShowLog(s => !s)} style={chipBtn(showLog, C.ink)}>decisions ({decisions.length})</button>
        </span>
      </div>
      {due.length > 0 && (
        <div style={{ background: C.redBg, borderRadius: 4, padding: "4px 8px", margin: "5px 0 2px", fontFamily: SERIF, fontSize: fs(12), color: C.ink }}>
          <b style={{ color: C.red }}>⏰ {due.length} deferred decision{due.length > 1 ? "s" : ""} due:</b>{" "}
          {due.slice(0, 3).map(d => `${d.note || "no note"} (review ${fmtDate(d.due_date)})`).join(" · ")}
          <button onClick={() => setShowLog(true)} style={{ ...chipBtn(false, C.red), marginLeft: 6 }}>review</button>
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ ...smallMono(fs), marginTop: 4 }}>
          {alerts.length ? "No unread alerts." : "No alerts yet — the first refresh sets a baseline; alerts fire when a signal changes status, a market makes an outsized daily move, or a source fails."}
        </div>
      ) : list.map(a => {
        const s = SEV[a.sev] || SEV.info;
        const d = byAlert[a.id];
        const decidable = a.sev !== "info" && a.kind !== "decision";
        return (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.line2}`, opacity: a.read && !d ? 0.6 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 700, color: s.color, background: s.bg, borderRadius: 3, padding: "2px 0", textAlign: "center", height: "fit-content" }}>{s.label}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub }}>{a.detail}</div>
              {a.action && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.ink, marginTop: 1 }}><b style={{ color: C.green }}>→</b> {a.action}</div>}
              {a.guard && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.sub }}><b style={{ color: C.goldDark }}>⚑ No action unless:</b> {a.guard}</div>}
              {d && <div style={{ ...smallMono(fs, DECIDED[d.decision]?.[1]), marginTop: 2 }}>
                {DECIDED[d.decision]?.[0]}{d.due_date ? ` · review ${fmtDate(d.due_date)}` : ""}{d.note ? ` · ${d.note}` : ""}</div>}
              {decidable && !d && deciding === a.id && <DecisionForm today={today} fs={fs} onCancel={() => setDeciding(null)} onSave={f => decide(a, f)} />}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={smallMono(fs)}>{fmtStamp(a.at)}</div>
              {a.pushed && <div style={smallMono(fs, C.green)} title="Sent to Telegram by the server check">📱 pushed</div>}
              {a.server && !a.pushed && a.pushError && <div style={smallMono(fs, C.goldDark)} title={a.pushError}>not pushed</div>}
              <div style={{ display: "flex", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
                {decidable && !d && deciding !== a.id && <button onClick={() => setDeciding(a.id)} style={chipBtn(false, C.ink)} title="Log what you did: acted, deferred (with a review date) or no action">decide</button>}
                {!a.read && <button onClick={() => markRead([a.id])} style={chipBtn(false)}>read</button>}
              </div>
            </div>
          </div>
        );
      })}
      {showLog && <DecisionLog decisions={decisions} logDecision={logDecision} resolveDecision={resolveDecision} results={results} today={today} />}
    </div>
  );
}
