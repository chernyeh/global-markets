import { useState } from "react";
import { C, MONO, SERIF, card, kickerStyle, smallMono, useFs, chipBtn } from "./macroStyles.js";
import { fmtStamp } from "../../macroFormat.js";

const SEV = {
  act:   { label: "ACT",   color: "#fff", bg: C.red },
  watch: { label: "WATCH", color: C.amber, bg: C.amberBg },
  info:  { label: "INFO",  color: C.blue, bg: C.blueBg },
};

export default function AlertInbox({ alerts, unread, markRead, notify, toggleNotify }) {
  const fs = useFs();
  const [all, setAll] = useState(false);
  const list = all ? alerts : alerts.filter(a => !a.read).slice(0, 6);
  const canNotify = typeof Notification !== "undefined";
  return (
    <div style={{ ...card, padding: "10px 14px", marginBottom: 14, borderLeft: unread ? `3px solid ${C.red}` : `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={kickerStyle(fs)}>ALERTS · {unread} unread</span>
        <span style={smallMono(fs)}>in-app; checked every 10 min while the site is open · push to Telegram arrives in Phase 4</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {canNotify && <button onClick={toggleNotify} style={chipBtn(notify, C.ink)} title="Show ACT and WATCH alerts as browser notifications while this tab is open">
            {notify ? "browser alerts on" : "browser alerts off"}</button>}
          {unread > 0 && <button onClick={() => markRead("all")} style={chipBtn(false, C.ink)}>mark all read</button>}
          {alerts.length > 0 && <button onClick={() => setAll(a => !a)} style={chipBtn(all, C.ink)}>{all ? "unread only" : `history (${alerts.length})`}</button>}
        </span>
      </div>
      {list.length === 0 ? (
        <div style={{ ...smallMono(fs), marginTop: 4 }}>
          {alerts.length ? "No unread alerts." : "No alerts yet — the first refresh sets a baseline; alerts fire when a signal changes status, a market makes an outsized daily move, or a source fails."}
        </div>
      ) : list.map(a => {
        const s = SEV[a.sev] || SEV.info;
        return (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.line2}`, opacity: a.read ? 0.6 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 700, color: s.color, background: s.bg, borderRadius: 3, padding: "2px 0", textAlign: "center", height: "fit-content" }}>{s.label}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: fs(12.5), color: C.ink, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub }}>{a.detail}</div>
              {a.action && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.ink, marginTop: 1 }}><b style={{ color: C.green }}>→</b> {a.action}</div>}
              {a.guard && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.sub }}><b style={{ color: C.goldDark }}>⚑ No action unless:</b> {a.guard}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={smallMono(fs)}>{fmtStamp(a.at)}</div>
              {!a.read && <button onClick={() => markRead([a.id])} style={{ ...chipBtn(false), marginTop: 2 }}>read</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
