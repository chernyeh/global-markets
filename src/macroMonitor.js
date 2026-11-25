// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — state hook
// ═══════════════════════════════════════════════════════════════════════════════
// Lives in App (not in the Macro tab) so data refreshes and alerts keep running
// while another tab is open, and the tab label can show unread alerts.
// Everything persists to localStorage. With the app key entered in Setup
// (Phase 4), settings, the decision log and server alerts also sync through
// /api/store to Supabase, so the scheduled server check uses your pasted values.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SK, sGet, sSet } from "./storage.js";
import { fetchMacro, mergeMacro, resolveMacro } from "./macroData.js";
import { evaluateSignals, scenarioTally } from "./macroSignals.js";
import { updateAlerts, emptyAlertState, unreadCount } from "./macroAlerts.js";
import { SCENARIOS } from "./data/macroSignals.js";
import { collectSpeechItems, officialText, pickForClassification, classifyItems, mergeSpeechStore, speechAlerts, evidenceSuggestions } from "./macroSpeech.js";
import { buildMacroDigest, MACRO_READ_SYSTEM } from "./macroRead.js";
import { getAppKey, storeAppKey, storeApi, mergeServerAlerts, dueDecisions } from "./macroSync.js";
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
  // Phase 4: server sync, decisions, server alerts
  const [appKey, setAppKeyState] = useState(getAppKey);
  const [sync, setSync] = useState({ status: null, authorised: false, lastSync: null, error: null });
  const [serverAlerts, setServerAlerts] = useState([]);
  const [serverRead, setServerRead] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const scenRef = useRef(defaultScen()), eventsRef = useRef([]), syncAtRef = useRef(0), syncTimer = useRef(null), authRef = useRef(false);

  // Refs mirror state for use inside the async refresh (updated in the setters).
  const rawRef = useRef(null), manualRef = useRef({}), pastedRef = useRef({}), alertRef = useRef(emptyAlertState()), notifyRef = useRef(false);
  const busy = useRef(false);
  const serverAlertsRef = useRef([]), decisionsRef = useRef([]), sbRef = useRef(false), lastSyncRef = useRef(0), syncSeq = useRef(0);

  // ── Server sync (Phase 4) ──────────────────────────────────────────────────
  const pushSettings = useCallback(async () => {
    if (!authRef.current || !sbRef.current) return;
    try {
      await storeApi("settings", { method: "POST", body: { value: { manual: manualRef.current, pasted: pastedRef.current, scen: scenRef.current,
        userEvents: eventsRef.current, savedAt: syncAtRef.current || Date.now() } } });
      setSync(s => ({ ...s, lastSync: Date.now(), error: null }));
    } catch (e) { setSync(s => ({ ...s, error: `settings not saved: ${e.message}` })); }
  }, []);
  // Every local change stamps the settings; a 2-second pause batches edits into one save.
  const markDirty = useCallback(() => {
    const at = Date.now(); syncAtRef.current = at; sSet(SK.macroSyncAt, at);
    clearTimeout(syncTimer.current);
    if (authRef.current) syncTimer.current = setTimeout(pushSettings, 2000);
  }, [pushSettings]);
  const saveDecisions = list => { decisionsRef.current = list; setDecisions(list); sSet(SK.macroDecisions, list); };

  // Status (no key needed) → if authorised: settings (newer side wins), server
  // alerts, decisions (local-only entries uploaded first).
  const syncAll = useCallback(async () => {
    lastSyncRef.current = Date.now();
    // Only the newest sync may write state: a slow reply to an older call
    // (e.g. before the key was entered) must not overwrite a newer one.
    const seq = ++syncSeq.current;
    const stale = () => seq !== syncSeq.current;
    let status;
    try { status = await storeApi("status"); } catch (e) { if (!stale()) setSync(s => ({ ...s, error: `status: ${e.message}` })); return; }
    if (stale()) return;
    authRef.current = !!status.authorised; sbRef.current = !!status.env?.SUPABASE_SECRET_KEY;
    setSync(s => ({ ...s, status, authorised: !!status.authorised, error: null }));
    if (!authRef.current || !sbRef.current) return;
    try {
      const [st, al] = await Promise.all([storeApi("settings"), storeApi("alerts")]);
      if (stale()) return;
      const v = st.value, local = syncAtRef.current || 0;
      if (v && (v.savedAt || 0) > local) {
        manualRef.current = v.manual || {}; setManualState(manualRef.current); sSet(SK.macroManual, manualRef.current);
        pastedRef.current = v.pasted || {}; setPastedState(pastedRef.current); sSet(SK.macroPasted, pastedRef.current);
        if (v.scen?.weights) { scenRef.current = { ...defaultScen(), ...v.scen }; setScenState(scenRef.current); sSet(SK.macroScen, scenRef.current); }
        eventsRef.current = v.userEvents || []; setUserEventsState(eventsRef.current); sSet(SK.macroEvents, eventsRef.current);
        syncAtRef.current = v.savedAt; sSet(SK.macroSyncAt, v.savedAt);
      } else if (!v || local > (v.savedAt || 0)) {
        await pushSettings();
      }
      // Watchlist alerts (kind "watch") belong to the Watchlist tab, not the macro inbox.
      serverAlertsRef.current = (al.alerts || []).filter(a => a.origin === "server" && a.kind !== "watch");
      setServerAlerts(serverAlertsRef.current);
      const pending = decisionsRef.current.filter(d => d.pending);
      const failed = [];
      for (const d of pending) {
        const { id: _id, pending: _p, created_at: _c, resolved: _r, ...body } = d;
        try { await storeApi("decisions", { method: "POST", body }); } catch { failed.push(d); }
      }
      const { decisions: list } = await storeApi("decisions");
      if (stale()) return;
      saveDecisions([...failed, ...(list || [])]);
      setSync(s => ({ ...s, lastSync: Date.now(), error: failed.length ? `${failed.length} decision(s) not uploaded yet` : null }));
    } catch (e) { if (!stale()) setSync(s => ({ ...s, error: e.message })); }
  }, [pushSettings]);

  const setAppKey = useCallback(k => {
    const key = (k || "").trim();
    storeAppKey(key); setAppKeyState(key);
    if (!key) { authRef.current = false; setSync(s => ({ ...s, authorised: false })); }
    syncAll();
  }, [syncAll]);

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
      if (s?.weights) scenRef.current = { ...defaultScen(), ...s };
      if (Array.isArray(ev)) eventsRef.current = ev;
      const [sa, ld, sr] = await Promise.all([sGet(SK.macroSyncAt), sGet(SK.macroDecisions), sGet(SK.macroServerRead)]);
      if (typeof sa === "number") syncAtRef.current = sa;
      if (Array.isArray(ld)) setDecisions(ld);
      if (Array.isArray(sr)) setServerRead(sr);
      const [sp, rd] = await Promise.all([sGet(SK.macroSpeech), sGet(SK.macroRead)]);
      if (sp?.items) { speechRef.current = { ...emptySpeech(), ...sp }; setSpeech(speechRef.current); }
      if (rd?.text) setRead(rd);
      setReady(true);
      if (!d?.fetchedAt || Date.now() - d.fetchedAt > REFRESH_MS) refresh();
      syncAll();
    })();
    return () => { cancelled = true; };
  }, [refresh, syncAll]);

  // Re-fetch every 10 minutes while the page is visible; re-sync on the same
  // cycle and whenever you come back to the tab (e.g. from a Telegram alert).
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const at = rawRef.current?.fetchedAt || 0;
      if (Date.now() - at > REFRESH_MS) refresh();
      if (Date.now() - lastSyncRef.current > REFRESH_MS) syncAll();
    }, 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible" && Date.now() - lastSyncRef.current > 60 * 1000) syncAll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh, syncAll]);

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
    manualRef.current = next; setManualState(next); sSet(SK.macroManual, next); markDirty();
  }, [markDirty]);
  const setPasted = useCallback((key, rec) => {
    const next = { ...pastedRef.current };
    if (rec) next[key] = { ...rec, at: Date.now() }; else delete next[key];
    pastedRef.current = next; setPastedState(next); sSet(SK.macroPasted, next); markDirty();
  }, [markDirty]);
  const setScenWeights = useCallback(weights => {
    const next = { weights, setAt: Date.now(), flipsAt: alertRef.current.flips || 0, fromPlaybook: false };
    scenRef.current = next; setScenState(next); sSet(SK.macroScen, next); markDirty();
  }, [markDirty]);
  const setUserEvents = useCallback(list => { eventsRef.current = list; setUserEventsState(list); sSet(SK.macroEvents, list); markDirty(); }, [markDirty]);
  const markRead = useCallback(ids => {
    const all = ids === "all";
    setServerRead(prev => {
      const next = [...new Set([...prev, ...(all ? serverAlertsRef.current.map(a => a.id) : ids.filter(id => String(id).startsWith("srv-")))])].slice(-400);
      sSet(SK.macroServerRead, next);
      return next;
    });
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

  // ── Decision log ──────────────────────────────────────────────────────────
  // acted / deferred (with a review date) / no_action, tied to the alert or
  // signal and its status at the time. Saved to Supabase when synced, else kept
  // locally and uploaded at the next sync.
  const logDecision = useCallback(async d => {
    const body = { signal_id: d.signal_id || null, alert_id: d.alert_id || null, status_at: d.status_at || null, value_at: d.value_at || null,
      decision: d.decision, note: d.note || null, due_date: d.decision === "deferred" ? d.due_date || null : null };
    if (authRef.current && sbRef.current) {
      try {
        const { decision: row } = await storeApi("decisions", { method: "POST", body });
        if (row) { saveDecisions([row, ...decisionsRef.current]); return { ok: true }; }
      } catch (e) { setSync(s => ({ ...s, error: `decision kept locally: ${e.message}` })); }
    }
    saveDecisions([{ ...body, id: `loc-${Date.now()}`, created_at: new Date().toISOString(), resolved: false, pending: true }, ...decisionsRef.current]);
    return { ok: true, local: true };
  }, []);
  const resolveDecision = useCallback(async (id, resolved = true) => {
    const apply = row => saveDecisions(decisionsRef.current.map(x => (x.id === id ? { ...x, ...row } : x)));
    if (String(id).startsWith("loc-") || !authRef.current) { apply({ resolved, resolved_at: resolved ? new Date().toISOString() : null }); return; }
    try { const { decision: row } = await storeApi("decisions", { method: "PATCH", query: { id }, body: { resolved } }); apply(row || { resolved }); }
    catch (e) { setSync(s => ({ ...s, error: `not updated: ${e.message}` })); }
  }, []);

  // ── Telegram (link / test / prefs) — errors are returned for the Setup panel ──
  const telegram = useCallback(async (action, body = {}) => {
    try { const r = await storeApi("telegram", { method: "POST", query: { action }, body }); await syncAll(); return { ok: true, ...r }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [syncAll]);

  const alerts = useMemo(() => mergeServerAlerts(alertState.alerts, serverAlerts, serverRead), [alertState.alerts, serverAlerts, serverRead]);

  return {
    ready, loading, fetchError, raw, series, results, tally, refresh,
    health: raw?.health || {}, fetchedAt: raw?.fetchedAt || null,
    paths: raw?.sources?.cbw?.paths || {},
    manual, setManual, pasted, setPasted,
    scen, setScenWeights, flipsSinceWeights: (alertState.flips || 0) - (scen.flipsAt || 0),
    userEvents, setUserEvents,
    alerts, unread: unreadCount({ alerts }), markRead,
    notify, toggleNotify,
    mpt: raw?.sources?.mpt?.paths?.fed || null,
    speech, speechBusy, runSpeech,
    read, readBusy, generateRead,
    appKey, setAppKey, sync, syncAll, telegram,
    decisions, logDecision, resolveDecision, dueDecisions,
  };
}
