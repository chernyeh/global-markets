// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — state hook
// ═══════════════════════════════════════════════════════════════════════════════
// Lives in App (not in the Macro tab) so data refreshes and alerts keep running
// while another tab is open, and the tab label can show unread alerts.
// Everything persists to localStorage; nothing leaves the browser except the
// /api/macro requests.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SK, sGet, sSet } from "./storage.js";
import { fetchMacro, mergeMacro, resolveMacro } from "./macroData.js";
import { evaluateSignals, scenarioTally } from "./macroSignals.js";
import { updateAlerts, emptyAlertState, unreadCount } from "./macroAlerts.js";
import { SCENARIOS } from "./data/macroSignals.js";
import { collectSpeechItems, officialText, pickForClassification, classifyItems, mergeSpeechStore, speechAlerts, evidenceSuggestions } from "./macroSpeech.js";
import { buildMacroDigest, MACRO_READ_SYSTEM } from "./macroRead.js";
import { callClaude, MODEL_CLASSIFY, MODEL_SYNTHESIZE, SYNTH_MODELS, getSynthModel } from "./api.js";

export const REFRESH_MS = 10 * 60 * 1000;
export const SPEECH_MS = 30 * 60 * 1000;     // speaker feeds re-read every 30 minutes
const EVIDENCE_MS = 6 * 60 * 60 * 1000;      // signal-evidence suggestions every 6 hours

// Text of any feed or page through the app's own proxy (the same one the news uses).
async function fetchText(url) {
  const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  if (!t) throw new Error("empty response");
  return t;
}
// Classification calls use Haiku with the instructions sent as a cached system block.
const classify = (system, prompt) => callClaude(prompt, 3000, { model: MODEL_CLASSIFY, system, throwOnError: true, timeoutMs: 45000 });
const emptySpeech = () => ({ items: {}, lastRun: 0, error: null, evidence: {}, evidenceAt: 0 });
const defaultScen = () => ({ weights: Object.fromEntries(SCENARIOS.map(s => [s.id, s.weight])), setAt: null, flipsAt: 0, fromPlaybook: true });

// Keep stored history small: 5 significant decimals is far finer than any source publishes.
const compact = raw => ({
  ...raw,
  sources: Object.fromEntries(Object.entries(raw.sources || {}).map(([src, s]) => [src, {
    ...s,
    series: Object.fromEntries(Object.entries(s.series || {}).map(([k, v]) => [k, {
      ...v, points: (v.points || []).map(([d, x]) => [d, typeof x === "number" ? Math.round(x * 1e5) / 1e5 : x]),
    }])),
  }])),
});

export function useMacroMonitor() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [manual, setManualState] = useState({});
  const [pasted, setPastedState] = useState({});
  const [scen, setScenState] = useState(defaultScen);
  const [userEvents, setUserEventsState] = useState([]);
  const [alertState, setAlertState] = useState(emptyAlertState);
  const [notify, setNotifyState] = useState(false);
  const [ready, setReady] = useState(false);
  const [speech, setSpeech] = useState(emptySpeech);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [read, setRead] = useState(null);
  const [readBusy, setReadBusy] = useState(false);
  const speechRef = useRef(emptySpeech());
  const speechBusyRef = useRef(false);

  // Refs mirror state for use inside the async refresh (updated in the setters).
  const rawRef = useRef(null), manualRef = useRef({}), pastedRef = useRef({}), alertRef = useRef(emptyAlertState()), notifyRef = useRef(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const fetched = await fetchMacro();
      const anyOk = Object.values(fetched.health).some(h => h.ok > 0);
      if (!anyOk) throw new Error("no source answered — check your connection or the /api/macro function");
      const merged = compact(mergeMacro(rawRef.current, fetched));
      rawRef.current = merged;
      setRaw(merged);
      setFetchError(null);
      sSet(SK.macroData, merged);
      // Alerts are evaluated once per data refresh, not on every render.
      const series = resolveMacro(merged);
      const results = evaluateSignals(series, { manual: manualRef.current, pasted: pastedRef.current });
      const next = updateAlerts(alertRef.current, { results, series, health: merged.health });
      const { newAlerts, ...toStore } = next;
      alertRef.current = toStore;
      setAlertState(toStore);
      sSet(SK.macroAlerts, toStore);
      if (notifyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        newAlerts.filter(a => a.sev !== "info").slice(0, 3).forEach(a => {
          try { new Notification(a.title, { body: a.detail, tag: a.ref }); } catch { /* not supported here */ }
        });
      }
    } catch (e) {
      setFetchError(e.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  // Load what was stored, then fetch if it is stale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, a, m, p, s, ev, n] = await Promise.all([
        sGet(SK.macroData), sGet(SK.macroAlerts), sGet(SK.macroManual), sGet(SK.macroPasted),
        sGet(SK.macroScen), sGet(SK.macroEvents), sGet(SK.macroNotify)]);
      if (cancelled) return;
      if (d?.sources) { rawRef.current = d; setRaw(d); }
      if (a?.alerts) { alertRef.current = { ...emptyAlertState(), ...a }; setAlertState(alertRef.current); }
      if (m && typeof m === "object") { manualRef.current = m; setManualState(m); }
      if (p && typeof p === "object") { pastedRef.current = p; setPastedState(p); }
      if (s?.weights) setScenState({ ...defaultScen(), ...s });
      if (Array.isArray(ev)) setUserEventsState(ev);
      if (n === true) { notifyRef.current = true; setNotifyState(true); }
      const [sp, rd] = await Promise.all([sGet(SK.macroSpeech), sGet(SK.macroRead)]);
      if (sp?.items) { speechRef.current = { ...emptySpeech(), ...sp }; setSpeech(speechRef.current); }
      if (rd?.text) setRead(rd);
      setReady(true);
      if (!d?.fetchedAt || Date.now() - d.fetchedAt > REFRESH_MS) refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // Re-fetch every 10 minutes while the page is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const at = rawRef.current?.fetchedAt || 0;
      if (Date.now() - at > REFRESH_MS) refresh();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // Add alerts raised outside the data refresh (speaker shifts, new statements).
  const appendAlerts = useCallback(list => {
    if (!list.length) return;
    const now = Date.now();
    const stamped = list.map((a, i) => ({ ...a, id: `${now}-s${i}`, at: now, read: false }));
    const next = { ...alertRef.current, alerts: [...stamped, ...alertRef.current.alerts].slice(0, 120) };
    alertRef.current = next; setAlertState(next); sSet(SK.macroAlerts, next);
    if (notifyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      stamped.filter(a => a.sev !== "info").slice(0, 3).forEach(a => { try { new Notification(a.title, { body: a.detail, tag: a.ref }); } catch { /* unsupported */ } });
    }
  }, []);

  // Speaker tracker: read feeds, fetch official texts, classify new items with
  // Haiku, store, and alert on shifts. Evidence suggestions every 6 hours.
  const runSpeech = useCallback(async ({ force = false } = {}) => {
    if (speechBusyRef.current) return;
    const prev = speechRef.current;
    if (!force && Date.now() - (prev.lastRun || 0) < SPEECH_MS) return;
    speechBusyRef.current = true; setSpeechBusy(true);
    const now = Date.now();
    try {
      const { items, errors } = await collectSpeechItems(fetchText, { now });
      const todo = pickForClassification(items, prev.items, { now });
      await Promise.all(todo.filter(it => it.kind === "official").slice(0, 8).map(async it => { it.text = await officialText(it, fetchText); }));
      const { results, errors: cErr } = todo.length ? await classifyItems(todo, classify) : { results: {}, errors: [] };
      const store = mergeSpeechStore(prev, todo, results, now);
      let evidence = prev.evidence || {}, evidenceAt = prev.evidenceAt || 0;
      if (force || now - evidenceAt > EVIDENCE_MS) {
        try { evidence = await evidenceSuggestions(fetchText, classify, { now }); evidenceAt = now; } catch { /* keep the last */ }
      }
      const failed = [...errors, ...cErr];
      const next = { items: store, lastRun: now, evidence, evidenceAt,
        error: failed.length ? `${failed.length} problem${failed.length > 1 ? "s" : ""}: ${failed[0]}` : null,
        counts: { seen: items.length, classified: Object.keys(results).length, skipped: items.length - todo.length } };
      speechRef.current = next; setSpeech(next); sSet(SK.macroSpeech, next);
      appendAlerts(speechAlerts(new Set(Object.keys(results)), store));
    } catch (e) {
      const next = { ...prev, lastRun: now, error: e.message };
      speechRef.current = next; setSpeech(next);
    } finally {
      speechBusyRef.current = false; setSpeechBusy(false);
    }
  }, [appendAlerts]);

  useEffect(() => {
    if (!ready) return;
    const tick = () => { if (typeof document === "undefined" || document.visibilityState === "visible") runSpeech(); };
    const first = setTimeout(tick, 4000); // let the market data load first
    const id = setInterval(tick, 60 * 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [ready, runSpeech]);

  const series = useMemo(() => resolveMacro(raw), [raw]);
  const results = useMemo(() => evaluateSignals(series, { manual, pasted }), [series, manual, pasted]);
  const tally = useMemo(() => scenarioTally(results), [results]);

  const setManual = useCallback((id, rec) => {
    const next = { ...manualRef.current };
    if (rec) next[id] = { ...rec, at: Date.now() }; else delete next[id];
    manualRef.current = next; setManualState(next); sSet(SK.macroManual, next);
  }, []);
  const setPasted = useCallback((key, rec) => {
    const next = { ...pastedRef.current };
    if (rec) next[key] = { ...rec, at: Date.now() }; else delete next[key];
    pastedRef.current = next; setPastedState(next); sSet(SK.macroPasted, next);
  }, []);
  const setScenWeights = useCallback(weights => {
    const next = { weights, setAt: Date.now(), flipsAt: alertRef.current.flips || 0, fromPlaybook: false };
    setScenState(next); sSet(SK.macroScen, next);
  }, []);
  const setUserEvents = useCallback(list => { setUserEventsState(list); sSet(SK.macroEvents, list); }, []);
  const markRead = useCallback(ids => {
    const all = ids === "all";
    const next = { ...alertRef.current, alerts: alertRef.current.alerts.map(a => (all || ids.includes(a.id) ? { ...a, read: true } : a)) };
    alertRef.current = next; setAlertState(next); sSet(SK.macroAlerts, next);
  }, []);
  // Macro read: the brief model (header picker) over a digest of the page.
  const generateRead = useCallback(async () => {
    setReadBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const digest = buildMacroDigest({ series, results, tally, scen, paths: raw?.sources?.cbw?.paths || {},
        mpt: raw?.sources?.mpt?.paths?.fed || null, speech: speechRef.current, today, userEvents });
      const text = await callClaude(`DIGEST:\n${digest}`, 1600, { model: MODEL_SYNTHESIZE, system: MACRO_READ_SYSTEM, throwOnError: true, timeoutMs: 60000 });
      const rec = { text, at: Date.now(), model: SYNTH_MODELS[getSynthModel()]?.label || getSynthModel(), digestChars: digest.length, error: null };
      setRead(rec); sSet(SK.macroRead, rec);
    } catch (e) {
      setRead(r => ({ ...(r || {}), error: e.message }));
    } finally { setReadBusy(false); }
  }, [series, results, tally, scen, raw, userEvents]);

  const toggleNotify = useCallback(async () => {
    if (notifyRef.current) { notifyRef.current = false; setNotifyState(false); sSet(SK.macroNotify, false); return; }
    if (typeof Notification === "undefined") return;
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    const on = perm === "granted";
    notifyRef.current = on; setNotifyState(on); sSet(SK.macroNotify, on);
  }, []);

  return {
    ready, loading, fetchError, raw, series, results, tally, refresh,
    health: raw?.health || {}, fetchedAt: raw?.fetchedAt || null,
    paths: raw?.sources?.cbw?.paths || {},
    manual, setManual, pasted, setPasted,
    scen, setScenWeights, flipsSinceWeights: (alertState.flips || 0) - (scen.flipsAt || 0),
    userEvents, setUserEvents,
    alerts: alertState.alerts, unread: unreadCount(alertState), markRead,
    notify, toggleNotify,
    mpt: raw?.sources?.mpt?.paths?.fed || null,
    speech, speechBusy, runSpeech,
    read, readBusy, generateRead,
  };
}
