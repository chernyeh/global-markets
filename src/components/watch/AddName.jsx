import { useState } from "react";
import { C, MONO, SERIF, card, kickerStyle, smallMono, chipBtn, inputStyle, useFs } from "../macro/macroStyles.js";
import { PURPOSES, GB_SECTORS, GB_COUNTRIES, GB_ASSET_TYPES, marketOf } from "../../data/watchMarkets.js";
import { watchApi } from "../../watchMonitor.js";
import { Dots } from "../helpers.jsx";

const YAHOO_TYPE = { EQUITY: "Stock", ETF: "ETF", MUTUALFUND: "Fund/Unit Trust", CRYPTOCURRENCY: "Crypto" };

// Adds to Gloomberg's watchlist (the same fields as Gloomberg's own form),
// plus this app's "why tracked" and group.
export default function AddName({ w, onClose }) {
  const fs = useFs();
  const [f, setF] = useState({ ticker: "", name: "", country: "", sector: "", asset_type: "Stock", reason_added: "", alert_price: "", purpose: [], group: "" });
  const [look, setLook] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const groups = [...new Set(w.rows.map(x => x.group).filter(Boolean))].sort();
  const lbl = { fontFamily: MONO, fontSize: fs(9), color: C.sub, display: "block", marginBottom: 2 };
  const inp = { ...inputStyle, width: "100%", fontSize: fs(10.5), padding: "4px 6px" };

  const lookup = async () => {
    const t = f.ticker.trim().toUpperCase();
    if (!t) return;
    setLook({ busy: true });
    try {
      const j = await watchApi("lookup", { query: { symbol: t } });
      setLook(j);
      setF(p => ({ ...p, ticker: t, name: p.name || j.name || "", country: p.country || marketOf(t).country || "",
        asset_type: YAHOO_TYPE[j.type] || p.asset_type }));
    } catch (e) { setLook({ error: e.message }); }
  };

  const submit = async () => {
    setErr(null);
    if (!f.ticker.trim() || !f.name.trim()) { setErr("Ticker and name are required"); return; }
    const meta = { ...(f.purpose.length ? { purpose: f.purpose } : {}), ...(f.group.trim() ? { group: f.group.trim() } : {}) };
    const res = await w.addName({ ticker: f.ticker, name: f.name, country: f.country, sector: f.sector, asset_type: f.asset_type, reason_added: f.reason_added,
      alert_price: f.alert_price === "" ? null : f.alert_price }, meta);
    if (res.ok) onClose(); else setErr(res.error);
  };

  return (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 14, borderLeft: `3px solid ${C.red}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={kickerStyle(fs)}>ADD A NAME</span>
        <span style={smallMono(fs)}>goes onto your Gloomberg watchlist — it shows there too</span>
        <button onClick={onClose} style={{ ...chipBtn(false, C.ink), marginLeft: "auto" }}>close</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(150px,100%),1fr))", gap: 8 }}>
        <label><span style={lbl}>Ticker (Yahoo format)</span>
          <input value={f.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} onBlur={lookup} onKeyDown={e => e.key === "Enter" && lookup()}
            placeholder="e.g. 6857.T, D05.SI, NVDA" style={inp} autoFocus /></label>
        <label style={{ gridColumn: "span 2" }}><span style={lbl}>Name</span><input value={f.name} onChange={e => set("name", e.target.value)} style={inp} /></label>
        <label><span style={lbl}>Country</span><select value={f.country} onChange={e => set("country", e.target.value)} style={inp}>{GB_COUNTRIES.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
        <label><span style={lbl}>Sector</span><select value={f.sector} onChange={e => set("sector", e.target.value)} style={inp}>{GB_SECTORS.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
        <label><span style={lbl}>Asset type</span><select value={f.asset_type} onChange={e => set("asset_type", e.target.value)} style={inp}>{GB_ASSET_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      </div>
      <div style={{ ...smallMono(fs, look?.error ? C.red : C.mute), margin: "4px 0 6px", minHeight: 12 }}>
        {look?.busy ? <Dots /> : look?.error ? `⚠ ${look.error}` : look?.name ? `Yahoo: ${look.name} · ${look.exchange || ""} · ${look.currency || ""} ${look.price ?? ""}` : "Suffixes: .T Tokyo · .SI Singapore · .HK Hong Kong · .L London · .PA Paris · .DE Xetra · .AX ASX · .TO Toronto · none = US"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(220px,100%),1fr))", gap: 8 }}>
        <div><span style={lbl}>Why tracked</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {PURPOSES.map(p => {
              const on = f.purpose.includes(p.id);
              return <button key={p.id} title={p.tip} onClick={() => set("purpose", on ? f.purpose.filter(x => x !== p.id) : [...f.purpose, p.id])} style={chipBtn(on, C.ink)}>{p.label}</button>;
            })}
          </div>
        </div>
        <label><span style={lbl}>Group (a basket, optional)</span><input value={f.group} onChange={e => set("group", e.target.value)} list="gm-watch-groups-add" placeholder="e.g. AI capex, Japan banks" style={inp} />
          <datalist id="gm-watch-groups-add">{groups.map(g => <option key={g} value={g} />)}</datalist></label>
        <label><span style={lbl}>Alert price (buy at/below, optional)</span><input value={f.alert_price} onChange={e => set("alert_price", e.target.value)} inputMode="decimal" style={inp} /></label>
      </div>
      <label style={{ display: "block", marginTop: 8 }}><span style={lbl}>Why on watchlist (shows in Gloomberg)</span>
        <textarea value={f.reason_added} onChange={e => set("reason_added", e.target.value)} rows={2} style={{ ...inp, fontFamily: SERIF, resize: "vertical" }}
          placeholder="e.g. Bellwether for HBM demand; tracking as a gauge, not a position" /></label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button onClick={submit} disabled={w.busy} style={{ ...chipBtn(true, C.red), padding: "4px 14px", fontSize: 10 }}>{w.busy ? "adding…" : "add to watchlist"}</button>
        {err && <span style={smallMono(fs, C.red)}>⚠ {err}</span>}
      </div>
    </div>
  );
}
