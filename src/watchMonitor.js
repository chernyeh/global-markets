// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST — state hook (names board)
// ═══════════════════════════════════════════════════════════════════════════════
// Lives in App so prices and alerts keep updating while another tab is open.
// The list itself is Gloomberg's (read and written through /api/watch with the
// app key), so a change made in either app shows in the other on its next load:
// here on opening the tab, on window focus and every 5 minutes.
//
// Refresh cadence: list 5 min · prices 10 min (CDN 5 min) · valuations 4 h ·
// news 30 min while the tab is open. Alerts never need a decision: dismiss
// with ×; a level fires once per crossing and a big move once per day.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SK, sGet, sSet } from "./storage.js";
import { getAppKey } from "./macroSync.js";
import { callClaude, MODEL_CLASSIFY, mapLimit } from "./api.js";
import { evaluateWatchAlerts, DEFAULT_PREFS } from "./watchCalc.js";
import { buildRows } from "./watchRows.js";

const LIST_MS = 5 * 60 * 1000, QUOTES_MS = 10 * 60 * 1000, FUND_MS = 4 * 60 * 60 * 1000, NEWS_MS = 30 * 60 * 1000;
const T = t => String(t || "").toUpperCase().trim();

export async function watchApi(kind, { method = "GET", body, query = {} } = {}) {
  const qs = new URLSearchParams({ kind, ...query }).toString();
  const r = await fetch(`/api/watch?${qs}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-gm-key": getAppKey() },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}

// Names headlines use: the home-market name for markets whose press writes in
// another script, and short English forms (OCBC, LVMH) for every market.
// Suggested once per name, marked AI-suggested until you edit them.
async function suggestNames(rows) {
  const lines = rows.map(r => `${r.ticker} — ${r.name}`).join("\n");
  const prompt = `For each listed company below (Yahoo ticker — English name), give the names news headlines use for it.
"local": the full company name as written in its home-market press, in that market's language and script — Japanese for .T, Traditional Chinese for .HK and .TW, Simplified Chinese for .SS and .SZ, Korean for .KS, Thai for .BK; null for every other market.
"short": the short local form headlines most often use (same markets; else null).
"en": up to two short English names or abbreviations headlines use when they differ from the full name (e.g. OCBC for Oversea-Chinese Banking, LVMH, HSBC) — only distinctive ones, never a common word or a bare ticker that is also an ordinary word; [] if none.
If you are not confident of a name, use null — do not guess.
Return only JSON: {"TICKER": {"local": "...", "short": "...", "en": ["..."]}}

${lines}`;
  const text = await callClaude(prompt, 2500, { model: MODEL_CLASSIFY, throwOnError: true, timeoutMs: 45000 });
  const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : {};
}

export function useWatchMonitor({ appKey, active, articles }) {
  const [list, setList] = useState(null);
  const [listErr, setListErr] = useState(null);
  const [listAt, setListAt] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [quotesMeta, setQuotesMeta] = useState({ at: null, errors: {}, error: null });
  const [fund, setFund] = useState({});
  const [fundMeta, setFundMeta] = useState({ at: null, errors: {}, error: null });
  const [news, setNews] = useState({});
  const [newsBusy, setNewsBusy] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const alertStateRef = useRef(null);
  const listRef = useRef(null), fundAtRef = useRef(0);
  useEffect(() => { listRef.current = list; }, [list]);
  const listAtRef = useRef(0), newsAtRef = useRef(0), quotesBusy = useRef(false), newsRun = useRef(false);

  // Restore the last session so the board draws at once.
  useEffect(() => {
    Promise.all([sGet(SK.watchList), sGet(SK.watchQuotes), sGet(SK.watchFund), sGet(SK.watchAlertState), sGet(SK.watchAlerts), sGet(SK.watchDismissed)])
      .then(([l, q, f, st, al, dis]) => {
        if (l?.list) { setList(l.list); setListAt(l.at); }
        if (q?.quotes) { setQuotes(q.quotes); setQuotesMeta({ at: q.at, errors: q.errors || {}, error: null }); }
        if (f?.fund) { setFund(f.fund); setFundMeta({ at: f.at, errors: f.errors || {}, error: null }); fundAtRef.current = f.at || 0; }
        alertStateRef.current = st || null;
        setAlerts(Array.isArray(al) ? al : []);
        setDismissed(Array.isArray(dis) ? dis : []);
        setReady(true);
      });
  }, []);

  const loadList = useCallback(async () => {
    if (!getAppKey()) { setListErr("no-key"); return null; }
    try {
      const l = await watchApi("list");
      const at = Date.now();
      listAtRef.current = at; listRef.current = l;
      setList(l); setListAt(at); setListErr(null);
      sSet(SK.watchList, { list: { ...l, alerts: undefined }, at });
      return l;
    } catch (e) {
      setListErr(e.status === 401 ? "bad-key" : e.message);
      return null;
    }
  }, []);

  const symbolsFor = useCallback(l => {
    const rows = buildRows(l, {}, {}, {}, []);
    return [...new Set([...rows.map(r => r.ticker), ...rows.map(r => r.benchSym).filter(Boolean)])].sort();
  }, []);

  const loadQuotes = useCallback(async (l = listRef.current) => {
    if (!l || quotesBusy.current) return;
    quotesBusy.current = true;
    try {
      const syms = symbolsFor(l);
      const out = {}, errors = {};
      for (let i = 0; i < syms.length; i += 150) {
        const j = await watchApi("quotes", { query: { symbols: syms.slice(i, i + 150).join(",") } });
        Object.assign(out, j.quotes || {}); Object.assign(errors, j.errors || {});
      }
      const at = Date.now();
      setQuotes(prev => ({ ...prev, ...out })); setQuotesMeta({ at, errors, error: null });
      sSet(SK.watchQuotes, { quotes: out, errors, at });
    } catch (e) {
      setQuotesMeta(m => ({ ...m, error: e.message }));
    } finally { quotesBusy.current = false; }
  }, [symbolsFor]);

  const loadFund = useCallback(async (l = listRef.current, force = false) => {
    if (!l) return;
    if (!force && fundAtRef.current && Date.now() - fundAtRef.current < FUND_MS) return;
    try {
      const syms = buildRows(l, {}, {}, {}, []).map(r => r.ticker).sort();
      const j = await watchApi("fund", { query: { symbols: syms.join(",") } });
      const at = Date.now();
      fundAtRef.current = at;
      setFund(j.fund || {}); setFundMeta({ at, errors: j.errors || {}, error: null });
      sSet(SK.watchFund, { fund: j.fund || {}, errors: j.errors || {}, at });
    } catch (e) { setFundMeta(m => ({ ...m, error: e.message })); }
  }, []);

  const loadNews = useCallback(async (rows, { only } = {}) => {
    const todo = rows.filter(r => !r.skipNews && (!only || only.includes(r.ticker)));
    if (!todo.length) return;
    setNewsBusy(true);
    await mapLimit(todo, 3, async r => {
      try {
        const m = r.meta || {};
        const j = await watchApi("news", { query: { t: r.ticker, n: r.name, ...(m.local ? { l: m.local } : {}), ...(m.localShort ? { ls: m.localShort } : {}),
          ...(m.aliases?.length ? { a: m.aliases.join("|") } : {}), ...(m.q ? { x: m.q } : {}) } });
        setNews(prev => ({ ...prev, [r.ticker]: { items: j.items || [], stats: j.stats || null, at: Date.now(), needsLocal: !!j.needsLocal, error: j.errors?.length ? j.errors.join("; ") : null } }));
      } catch (e) {
        setNews(prev => ({ ...prev, [r.ticker]: { ...(prev[r.ticker] || { items: [] }), error: e.message, at: Date.now() } }));
      }
    });
    newsAtRef.current = Date.now();
    setNewsBusy(false);
  }, []);

  // Start: list → prices → valuations. Re-read the list on focus and on a timer.
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    (async () => {
      const l = await loadList();
      if (stop || !l) return;
      loadQuotes(l); loadFund(l);
    })();
    const tl = setInterval(() => loadList(), LIST_MS);
    const tq = setInterval(() => { loadQuotes(); loadFund(); }, QUOTES_MS);
    const onFocus = () => { if (Date.now() - listAtRef.current > 60000) loadList(); };
    window.addEventListener("focus", onFocus);
    return () => { stop = true; clearInterval(tl); clearInterval(tq); window.removeEventListener("focus", onFocus); };
  }, [ready, appKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => buildRows(list, quotes, fund, news, articles), [list, quotes, fund, news, articles]);

  // News: when the tab is first opened, then every 30 minutes while it is open.
  useEffect(() => {
    if (!active || !list) return;
    // Stamped at the start, so a list refresh during a slow first load doesn't start a second one.
    const run = () => { if (!newsRun.current || Date.now() - newsAtRef.current > NEWS_MS) { newsRun.current = true; newsAtRef.current = Date.now(); loadNews(buildRows(list, {}, {}, {}, [])); } };
    run();
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
  }, [active, list, loadNews]);

  // Local names for Japanese / Chinese / Korean / Thai listings, suggested once
  // (and again after a week if still missing); marked as AI-suggested until edited.
  useEffect(() => {
    if (!active || !list || !getAppKey()) return;
    (async () => {
      const tried = (await sGet(SK.watchLocalTried)) || {};
      const week = 7 * 86400000;
      const need = buildRows(list, {}, {}, {}, []).filter(r => !r.skipNews && !(tried[r.ticker] && Date.now() - tried[r.ticker] < week)
        && ((r.market.script && !r.meta.local && !r.meta.localSrc) || (!r.meta.aliases?.length && !r.meta.aliasSrc))).slice(0, 40);
      if (!need.length) return;
      need.forEach(r => { tried[r.ticker] = Date.now(); });
      sSet(SK.watchLocalTried, tried);
      try {
        const got = await suggestNames(need);
        const patches = {};
        for (const r of need) {
          const g = got[r.ticker] || {};
          const p = {};
          // The source is recorded even when nothing came back, so the name isn't asked about again.
          if (r.market.script && !r.meta.local && !r.meta.localSrc) Object.assign(p, { local: g.local || null, localShort: g.short || null, localSrc: "ai" });
          if (!r.meta.aliases?.length && !r.meta.aliasSrc) Object.assign(p, { aliases: (Array.isArray(g.en) ? g.en : []).slice(0, 2), aliasSrc: "ai" });
          if (Object.keys(p).length) patches[r.ticker] = p;
        }
        if (!Object.keys(patches).length) return;
        const { meta } = await watchApi("meta", { method: "POST", body: { patches } });
        if (!meta) return;
        setList(l => (l ? { ...l, meta } : l));
        const nl = { ...list, meta };
        loadNews(buildRows(nl, {}, {}, {}, []), { only: Object.keys(patches) });
      } catch { /* retried next week */ }
    })();
  }, [active, list?.watch?.length, list?.hold?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alerts from each price refresh (browser side; the server check pushes to Telegram).
  useEffect(() => {
    if (!quotesMeta.at || !list) return;
    const { state, fresh } = evaluateWatchAlerts(alertStateRef.current, rows, { now: quotesMeta.at, prefs: list.prefs || DEFAULT_PREFS });
    alertStateRef.current = state;
    sSet(SK.watchAlertState, state);
    if (fresh.length) {
      setAlerts(prev => {
        const next = [...fresh, ...prev].slice(0, 80);
        sSet(SK.watchAlerts, next);
        return next;
      });
    }
  }, [quotesMeta.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser alerts + server alerts (raised while the app was closed); one entry per event.
  const allAlerts = useMemo(() => {
    const week = Date.now() - 7 * 86400000;
    const local = alerts.filter(a => a.at >= week);
    const out = [...local];
    for (const s of list?.alerts || []) {
      const at = Date.parse(s.at);
      if (at < week || out.some(a => a.ref === s.ref && Math.abs(a.at - at) < 86400000)) continue;
      out.push({ id: s.id, at, ref: s.ref, sev: s.sev, title: s.title, detail: s.detail, ticker: String(s.ref || "").split("|")[0], server: true, pushed: s.pushed });
    }
    const dis = new Set(dismissed);
    return out.filter(a => !dis.has(a.id)).sort((a, b) => b.at - a.at);
  }, [alerts, list?.alerts, dismissed]);

  const dismiss = useCallback(ids => {
    setDismissed(prev => {
      const next = [...new Set([...(Array.isArray(ids) ? ids : [ids]), ...prev])].slice(0, 300);
      sSet(SK.watchDismissed, next);
      return next;
    });
  }, []);

  // ── Edits (written straight to Gloomberg's watchlist) ──
  const run = useCallback(async fn => {
    setBusy(true);
    try { const r = await fn(); return { ok: true, ...r }; }
    catch (e) { return { ok: false, error: e.message }; }
    finally { setBusy(false); }
  }, []);

  const addName = useCallback((item, meta) => run(async () => {
    const { item: row } = await watchApi("item", { method: "POST", body: item });
    if (meta && Object.keys(meta).length) await watchApi("meta", { method: "POST", body: { patches: { [T(item.ticker)]: meta } } });
    const l = await loadList();
    if (l) { loadQuotes(l); loadFund(l, true); loadNews(buildRows(l, {}, {}, {}, []), { only: [T(item.ticker)] }); }
    return { item: row };
  }), [run, loadList, loadQuotes, loadFund, loadNews]);

  const updateName = useCallback((row, item, meta) => run(async () => {
    if (item && row.watch?.id) await watchApi("item", { method: "PATCH", query: { id: row.watch.id }, body: item });
    if (meta) {
      const { meta: all } = await watchApi("meta", { method: "POST", body: { patches: { [row.ticker]: meta } } });
      if (all) setList(l => (l ? { ...l, meta: all } : l));
    }
    const l = await loadList();
    const newsKeys = ["local", "localShort", "aliases", "q"];
    if (l && meta && newsKeys.some(k => k in meta)) loadNews(buildRows(l, {}, {}, {}, []), { only: [row.ticker] });
    if (l && meta && "bench" in meta) loadQuotes(l);
    return {};
  }), [run, loadList, loadNews, loadQuotes]);

  const removeName = useCallback(row => run(async () => {
    const { removed } = await watchApi("item", { method: "DELETE", query: { id: row.watch.id } });
    setUndo({ snapshot: removed, label: row.name, until: Date.now() + 10000 });
    await loadList();
    return {};
  }), [run, loadList]);

  const undoRemove = useCallback(() => run(async () => {
    if (!undo) return {};
    await watchApi("restore", { method: "POST", body: { snapshot: undo.snapshot } });
    setUndo(null);
    await loadList();
    return {};
  }), [run, undo, loadList]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  const setPrefs = useCallback(p => run(async () => {
    const { prefs } = await watchApi("prefs", { method: "POST", body: p });
    if (prefs) setList(l => (l ? { ...l, prefs } : l));
    return {};
  }), [run]);

  const refreshAll = useCallback(async () => {
    const l = await loadList();
    if (!l) return;
    await Promise.all([loadQuotes(l), loadFund(l, true), loadNews(buildRows(l, {}, {}, {}, []))]);
  }, [loadList, loadQuotes, loadFund, loadNews]);

  return {
    ready, list, listErr, listAt, rows, quotes, quotesMeta, fundMeta, news, newsBusy, busy,
    alerts: allAlerts, unread: allAlerts.length, dismiss,
    addName, updateName, removeName, undo, undoRemove, setPrefs, refreshAll,
    prefs: { ...DEFAULT_PREFS, ...(list?.prefs || {}) },
  };
}
