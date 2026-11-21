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

export const REFRESH_MS = 10 * 60 * 1000;
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
  };
}
