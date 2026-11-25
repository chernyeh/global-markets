import { useState } from "react";
import Tip from "../macro/Tip.jsx";
import BriefRenderer from "../BriefRenderer.jsx";
import { Dots, timeAgo } from "../helpers.jsx";
import { C, MONO, SERIF, kickerStyle, smallMono, chipBtn, inputStyle, useFs } from "../macro/macroStyles.js";
import { PURPOSES, GB_SECTORS, GB_COUNTRIES } from "../../data/watchMarkets.js";
import { isMet, levelDist, daysSince } from "../../watchCalc.js";
import { callClaude, MODEL_SYNTHESIZE } from "../../api.js";
import { fmtPx, fmtPct, fmtPp, fmtX, fmtBig, fmtDay, fmtDayY, LANG_TAG } from "./watchFormat.js";

const KV = ({ k, v, fs, tip, tone }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0", borderBottom: `1px solid ${C.line2}` }}>
    <span style={{ fontFamily: MONO, fontSize: fs(9.5), color: C.sub }}>{tip ? <Tip tip={tip}>{k}</Tip> : k}</span>
    <span style={{ fontFamily: MONO, fontSize: fs(10), color: tone || C.ink, textAlign: "right" }}>{v}</span>
  </div>
);

// A per-name read of the news, written on demand by the brief model chosen in the header.
async function nameBrief(r) {
  const q = r.q, f = r.f, t = r.thesis;
  const why = r.purposes.length ? r.purposes.join(", ") : "not stated";
  const lines = r.newsItems.slice(0, 30).map((n, i) => `[${i}] ${new Date(n.ts).toISOString().slice(0, 10)} ${n.outlet ? `(${n.outlet}) ` : ""}${n.title}${n.lang !== "en" ? " [local-language]" : ""}`).join("\n");
  const prompt = `You are a buy-side analyst. Write a short read (under 220 words) on ${r.name} (${r.ticker}) for a portfolio manager.
Why it is tracked: ${why}${r.group ? `; group: ${r.group}` : ""}. If it is tracked as a gauge, factor or index name, say what the news and price action say about that industry, factor or index — not whether to buy the stock.

Price: ${q ? `${q.currency} ${fmtPx(q.last)} on ${q.lastDate}; 1D ${fmtPct(q.chg1d)}, 1W ${fmtPct(q.chg1w)}, 1M ${fmtPct(q.chg1m)}, YTD ${fmtPct(q.ytd)}; ${fmtPct(q.offHi)} from its 52-week high` : "no price"}${r.benchQ ? `; against ${r.benchLabel || r.benchSym}: ${fmtPp(r.rel1m)} over 1M` : ""}.
Valuation (Yahoo): ${f ? `trailing P/E ${fmtX(f.pe)}, forward P/E ${fmtX(f.fpe)}, P/B ${fmtX(f.pb)}` : "none"}.
${t ? `Thesis (${t.date_completed || "undated"}): conviction ${t.conviction_score || "?"}/10; Munger ${t.munger_price ?? "—"}, exit ${t.exit_price ?? "—"} ${t.price_currency || ""}. Summary: ${(t.thesis_summary || "").slice(0, 400)}` : "No thesis."}

Headlines, last 7 days (numbered):
${lines || "(none)"}

Format: one line headline in bold, then 3–5 bullets: what changed; whether the price move fits the news (good news with no price reaction is a warning sign); what it implies for the reason it is tracked; what to watch next with dates where the headlines give them. Cite headline numbers as [REF:n]. Stick to what the headlines and figures say; where something is an inference, say so.`;
  return callClaude(prompt, 900, { model: MODEL_SYNTHESIZE, throwOnError: true, timeoutMs: 55000 });
}

function Edit({ r, w, onDone }) {
  const fs = useFs();
  const wl = r.watch;
  const m = r.meta || {};
  const [f, setF] = useState({
    name: wl?.name || "", reason_added: wl?.reason_added || "", notes: wl?.notes || "", alert_price: wl?.alert_price ?? "", buy_trigger: wl?.buy_trigger || "",
    sector: wl?.sector || "", country: wl?.country || "",
    purpose: m.purpose || [], group: m.group || "", bench: m.bench || "", local: m.local || "", localShort: m.localShort || "",
    aliases: (m.aliases || []).join(", "), q: m.q || "", mute: !!m.mute,
  });
  const [err, setErr] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const groups = [...new Set(w.rows.map(x => x.group).filter(Boolean))].sort();
  const lbl = { fontFamily: MONO, fontSize: fs(9), color: C.sub, display: "block", marginBottom: 2 };
  const inp = { ...inputStyle, width: "100%", fontSize: fs(10.5), padding: "4px 6px" };

  const save = async () => {
    setErr(null);
    const item = wl ? { name: f.name, reason_added: f.reason_added, notes: f.notes, alert_price: f.alert_price === "" ? null : f.alert_price, buy_trigger: f.buy_trigger, sector: f.sector, country: f.country } : null;
    const localChanged = f.local !== (m.local || "") || f.localShort !== (m.localShort || "");
    const aliasChanged = f.aliases !== (m.aliases || []).join(", ");
    const meta = { purpose: f.purpose, group: f.group, bench: f.bench, local: f.local, localShort: f.localShort, aliases: f.aliases, q: f.q, mute: f.mute,
      ...(localChanged ? { localSrc: "user" } : {}), ...(aliasChanged ? { aliasSrc: "user" } : {}) };
    const res = await w.updateName(r, item, meta);
    if (res.ok) onDone(); else setErr(res.error);
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${r.name} from the Gloomberg watchlist? This removes it in Gloomberg too (you get 10 seconds to undo).`)) return;
    const res = await w.removeName(r);
    if (!res.ok) setErr(res.error);
  };

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 8, paddingTop: 8 }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 14 }}>
        <div>
          <div style={{ ...kickerStyle(fs), marginBottom: 4 }}>IN GLOOMBERG {wl ? "" : "· held — edit in Gloomberg"}</div>
          {wl ? (
            <div style={{ display: "grid", gap: 6 }}>
              <label><span style={lbl}>Name</span><input value={f.name} onChange={e => set("name", e.target.value)} style={inp} /></label>
              <label><span style={lbl}>Why on watchlist</span><textarea value={f.reason_added} onChange={e => set("reason_added", e.target.value)} rows={2} style={{ ...inp, fontFamily: SERIF, resize: "vertical" }} /></label>
              <label><span style={lbl}>Notes</span><textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, fontFamily: SERIF, resize: "vertical" }} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <label><span style={lbl}>Alert price (buy at/below)</span><input value={f.alert_price} onChange={e => set("alert_price", e.target.value)} inputMode="decimal" style={inp} /></label>
                <label><span style={lbl}>Waiting for</span><input value={f.buy_trigger} onChange={e => set("buy_trigger", e.target.value)} style={inp} /></label>
                <label><span style={lbl}>Sector</span><select value={f.sector} onChange={e => set("sector", e.target.value)} style={inp}>{GB_SECTORS.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
                <label><span style={lbl}>Country</span><select value={f.country} onChange={e => set("country", e.target.value)} style={inp}>{GB_COUNTRIES.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
              </div>
            </div>
          ) : <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub }}>This name is a holding, not a watchlist entry. Its levels, notes and quantities are managed in Gloomberg; the settings on the right apply here only.</div>}
        </div>
        <div>
          <div style={{ ...kickerStyle(fs), marginBottom: 4 }}>IN THIS APP</div>
          <div style={{ display: "grid", gap: 6 }}>
            <div><span style={lbl}>Why tracked</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {PURPOSES.map(p => {
                  const on = f.purpose.includes(p.id);
                  return <button key={p.id} title={p.tip} onClick={() => set("purpose", on ? f.purpose.filter(x => x !== p.id) : [...f.purpose, p.id])} style={chipBtn(on, C.ink)}>{p.label}</button>;
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <label><span style={lbl}>Group (a basket)</span><input value={f.group} onChange={e => set("group", e.target.value)} list="gm-watch-groups" placeholder="e.g. Memory cycle" style={inp} />
                <datalist id="gm-watch-groups">{groups.map(g => <option key={g} value={g} />)}</datalist></label>
              <label><span style={lbl}>Benchmark (Yahoo symbol)</span><input value={f.bench} onChange={e => set("bench", e.target.value.toUpperCase())} placeholder={r.market.bench || "none"} style={inp} /></label>
              <label><span style={lbl}>Local name{m.localSrc === "ai" && m.local ? " (AI-suggested — check)" : ""}</span><input value={f.local} onChange={e => set("local", e.target.value)} placeholder={r.market.lang ? `name in ${r.market.lang}` : "optional"} style={inp} /></label>
              <label><span style={lbl}>Short local name</span><input value={f.localShort} onChange={e => set("localShort", e.target.value)} style={inp} /></label>
            </div>
            <label><span style={lbl}>Short names headlines use (comma-separated){m.aliasSrc === "ai" && m.aliases?.length ? " (AI-suggested — check)" : ""}</span><input value={f.aliases} onChange={e => set("aliases", e.target.value)} placeholder="e.g. Hynix, SKH" style={inp} /></label>
            <label><span style={lbl}>Custom news query (replaces the English search; Google News syntax)</span><input value={f.q} onChange={e => set("q", e.target.value)} placeholder={`"${r.name}" when:7d`} style={inp} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: fs(9.5), color: C.sub }}>
              <input type="checkbox" checked={f.mute} onChange={e => set("mute", e.target.checked)} /> mute alerts for this name
            </label>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={save} disabled={w.busy} style={{ ...chipBtn(true, C.ink), padding: "4px 12px", fontSize: 10 }}>{w.busy ? "saving…" : "save"}</button>
        <button onClick={onDone} style={{ ...chipBtn(false, C.ink), padding: "4px 12px", fontSize: 10 }}>cancel</button>
        {wl && <button onClick={remove} disabled={w.busy} style={{ ...chipBtn(false, C.red), color: C.red, marginLeft: "auto", padding: "4px 10px", fontSize: 10 }}>remove from watchlist</button>}
        {err && <span style={smallMono(fs, C.red)}>⚠ {err}</span>}
      </div>
    </div>
  );
}

export default function NameDetail({ r, w }) {
  const fs = useFs();
  const [editing, setEditing] = useState(false);
  const [brief, setBrief] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState(null);
  const q = r.q, f = r.f, t = r.thesis;
  const ccy = q?.currency || "";
  const localTag = LANG_TAG[r.market.hl] || "LOCAL";
  const ns = r.newsState;
  const runBrief = async () => {
    setBriefBusy(true); setBriefErr(null);
    try { setBrief(await nameBrief(r)); } catch (e) { setBriefErr(e.message); } finally { setBriefBusy(false); }
  };

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ position: "sticky", left: 0, width: "min(100%, calc(100vw - 64px))", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8,
        padding: "10px 12px", margin: "4px 0 10px", cursor: "default", animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: SERIF, fontSize: fs(14), fontWeight: 700, color: C.ink }}>{r.name}</span>
        <span style={smallMono(fs)}>{r.ticker} · {r.country}{r.sector ? ` · ${r.sector}` : ""}{r.assetType ? ` · ${r.assetType}` : ""}</span>
        {r.purposes.length > 0 && <span style={smallMono(fs, C.ink)}>tracked as {r.purposes.join(" + ")}{r.group ? ` · ${r.group}` : ""}</span>}
        <button onClick={() => setEditing(e => !e)} style={{ ...chipBtn(editing, C.ink), marginLeft: "auto" }}>{editing ? "close edit" : "✎ edit"}</button>
      </div>
      {r.watch?.reason_added && <div style={{ fontFamily: SERIF, fontSize: fs(12), color: C.sub, marginBottom: 6 }}><b style={{ color: C.ink }}>Why on watchlist: </b>{r.watch.reason_added}{r.watch.buy_trigger ? <> · <b style={{ color: C.ink }}>waiting for: </b>{r.watch.buy_trigger}</> : null}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(250px,100%),1fr))", gap: 14 }}>
        <div>
          <div style={{ ...kickerStyle(fs), marginBottom: 3 }}>PRICE & VALUATION</div>
          <KV fs={fs} k="Last" v={q ? `${ccy} ${fmtPx(q.last)} · ${fmtDay(q.lastDate)}${r.stale ? " · stale" : ""}` : "—"} tone={r.stale ? C.amber : undefined} />
          <KV fs={fs} k="3M · 1Y" v={q ? `${fmtPct(q.chg3m)} · ${fmtPct(q.chg1y)}` : "—"} />
          <KV fs={fs} k={`vs ${r.benchLabel || "index"} 1M · 3M · YTD`} tip={r.benchSym ? `Benchmark ${r.benchSym}${r.meta.bench ? " (set by you)" : " (home market)"}` : "No benchmark for this market"}
            v={`${fmtPp(r.rel1m)} · ${fmtPp(r.rel3m)} · ${fmtPp(r.relYtd)}`} />
          <KV fs={fs} k="52-week range" v={q ? `${fmtPx(q.lo52)} – ${fmtPx(q.hi52)} (${fmtPct(q.offHi)} off high)` : "—"} />
          <KV fs={fs} k="P/E trailing · forward" v={`${fmtX(f?.pe)} · ${fmtX(f?.fpe)}`} />
          <KV fs={fs} k="P/B · dividend yield" v={`${fmtX(f?.pb)} · ${f?.dy !== null && f?.dy !== undefined ? `${f.dy.toFixed(1)}%` : "—"}`} />
          <KV fs={fs} k="Market cap" v={f?.mcap ? `${f.ccy || ccy} ${fmtBig(f.mcap)}` : "—"} />
          <KV fs={fs} k="Avg daily volume (3M)" tip="Shares a day, and their value at the last price"
            v={f?.adv ? `${fmtBig(f.adv)} sh · ${ccy} ${fmtBig(f.adv * (q?.last || 0))}` : "—"} />
          {r.liquidity && <KV fs={fs} k="TSE liquidity (Gloomberg)" tip="From Gloomberg's TSE digest feed: tier and days to trade ¥100m at 20-day average volume"
            v={`${r.liquidity.tier || "—"}${r.liquidity.days_to_exit_100m !== undefined ? ` · ${r.liquidity.days_to_exit_100m}d for ¥100m` : ""}`}
            tone={/thin/.test(r.liquidity.tier || "") ? C.amber : undefined} />}
          {q?.z1d !== null && q?.z1d !== undefined && <KV fs={fs} k="Today's move in σ" tip="Latest daily move ÷ the spread of the previous 60 daily moves" v={`${q.z1d.toFixed(1)}σ`} tone={Math.abs(q.z1d) >= 2.5 ? C.amber : undefined} />}
          <div style={{ ...smallMono(fs), marginTop: 3, fontSize: fs(8) }}>Prices: Yahoo (SECONDARY-reliable). Valuation: Yahoo v7 via Gloomberg's proxy (SECONDARY-reliable).</div>
        </div>

        <div>
          <div style={{ ...kickerStyle(fs), marginBottom: 3 }}>YOUR LEVELS & DATES</div>
          {r.levels.length ? r.levels.map(l => {
            const d = q?.last ? levelDist(l, q.last) : null;
            const met = q?.last ? isMet(l, q.last) : false;
            return <KV key={l.key} fs={fs} k={`${l.label} (${l.side})`}
              tip={`From ${l.src}${l.unitsOff ? " — more than 20× away from the price: probably pence vs pounds or a split; not compared or alerted" : l.ccyOk ? "" : ` — level is in ${l.ccy}, quote in ${ccy}: not compared`}`}
              v={`${l.ccy || ccy} ${fmtPx(l.value)} · ${l.unitsOff ? "units?" : l.ccyOk ? (met ? "through" : fmtPct(d)) : "ccy?"}`}
              tone={!l.ccyOk ? C.amber : met ? (l.side === "buy" ? C.green : l.side === "risk" ? C.red : C.amber) : undefined} />;
          }) : <div style={{ ...smallMono(fs), padding: "2px 0" }}>No levels set — that's fine for a gauge. Add an alert price on the left (✎ edit) if you want one.</div>}
          {t?.prob_weighted_value && <KV fs={fs} k="Probability-weighted value" v={`${t.price_currency || ""} ${fmtPx(t.prob_weighted_value)}${q?.last && (t.price_currency || "") === ccy ? ` · ${fmtPct((t.prob_weighted_value / q.last - 1) * 100)} upside` : ""}`} />}
          <KV fs={fs} k="Next results" tip="From your thesis where set (PRIMARY if you took it from the company), else Yahoo's earnings calendar"
            v={r.nextResults ? `${fmtDayY(r.nextResults.date)} · ${r.nextResults.src}${r.nextResults.est ? " est." : ""}` : "—"} />
          {r.exDiv && <KV fs={fs} k="Next ex-dividend" v={`${fmtDayY(r.exDiv.ex_date)} · ${r.exDiv.currency || ""} ${r.exDiv.amount ?? ""}`} />}
          {t && <KV fs={fs} k="Thesis" v={`${fmtDayY(t.date_completed)} · conviction ${t.conviction_score ?? "—"}/10${t.quality_tier ? ` · ${t.quality_tier}` : ""}`} />}
          {t?.action_and_deadline && <KV fs={fs} k="Action" v={t.action_and_deadline.length > 60 ? `${t.action_and_deadline.slice(0, 60)}…` : t.action_and_deadline} tip={t.action_and_deadline} />}
          {t?.next_review_date && <KV fs={fs} k="Review date" v={fmtDayY(t.next_review_date)} />}
          {r.deferral && <KV fs={fs} k="Open deferral (Gloomberg)" v={`${r.deferral.count} · oldest ${daysSince(r.deferral.oldest)}d`} tip="From Gloomberg's Hesitation Ledger — shown for reference; nothing here asks you to log a decision" />}
          {t?.thesis_summary && <div style={{ fontFamily: SERIF, fontSize: fs(11.5), color: C.sub, marginTop: 5, lineHeight: 1.45 }}>{t.thesis_summary.length > 320 ? `${t.thesis_summary.slice(0, 320)}…` : t.thesis_summary}</div>}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <span style={kickerStyle(fs)}>NEWS · 7 DAYS · {r.news.n7}</span>
            {!r.skipNews && <button onClick={runBrief} disabled={briefBusy || !r.newsItems.length} style={{ ...chipBtn(false, C.ink), marginLeft: "auto", opacity: r.newsItems.length ? 1 : 0.5 }}>
              {briefBusy ? <Dots /> : brief ? "↺ brief" : "✦ brief"}</button>}
          </div>
          {r.skipNews && <div style={smallMono(fs)}>News isn't searched for ETFs and funds. Set a custom news query (✎ edit) to follow one.</div>}
          {!r.skipNews && r.market.script && !r.meta.local && <div style={{ ...smallMono(fs, C.amber), marginBottom: 3 }}>No {r.market.lang} name yet, so local press isn't searched — add one (✎ edit).</div>}
          {r.meta.local && <div style={{ ...smallMono(fs), marginBottom: 3 }}>Local press searched as 「{r.meta.local}」{r.meta.localSrc === "ai" ? " — AI-suggested, check it" : ""}</div>}
          {brief && <div style={{ margin: "4px 0 8px", paddingBottom: 6, borderBottom: `1px solid ${C.line2}` }}><BriefRenderer text={brief} articles={r.newsItems.slice(0, 30).map(n => ({ title: n.title, link: n.link, source: n.outlet }))} /></div>}
          {briefErr && <div style={smallMono(fs, C.red)}>⚠ {briefErr}</div>}
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {r.newsItems.slice(0, 12).map((n, i) => (
              <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.line2}` }}>
                <a href={n.link} target="_blank" rel="noreferrer" style={{ fontFamily: SERIF, fontSize: fs(12), color: C.ink, textDecoration: "none", lineHeight: 1.35 }}>{n.title}</a>
                <div style={{ ...smallMono(fs), fontSize: fs(8.5) }}>
                  {n.lang !== "en" && <span style={{ color: C.blue, fontWeight: 700, marginRight: 4 }}>{localTag}</span>}
                  {n.outlet || "—"} · {timeAgo(n.ts)}{n.feed ? " · app feed" : ""}
                </div>
              </div>
            ))}
            {!r.skipNews && !r.newsItems.length && <div style={smallMono(fs)}>{ns ? (ns.error ? `⚠ ${ns.error}` : "No headlines naming it in the last 7 days.") : <><Dots /> loading…</>}</div>}
          </div>
        </div>
      </div>
      {editing && <Edit r={r} w={w} onDone={() => setEditing(false)} />}
    </div>
  );
}
