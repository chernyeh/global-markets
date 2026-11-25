export const SK = {
  articles:  "gm_arts_v4",
  summaries: "gm_briefs_v4",
  lastFetch: "gm_fetch_v4",
  watchlist: "gm_watch_v4",
  watchHits: "gm_watchhits_v4",
  fontScale: "gm_fontscale_v1",
  synthModel: "gm_synthmodel_v1",
  topicDials: "gm_topicdials_v1",
  customTopics: "gm_customtopics_v1",
  // Macro monitor (src/macroMonitor.js)
  macroData:   "gm_macro_data_v1",
  macroAlerts: "gm_macro_alerts_v1",
  macroManual: "gm_macro_manual_v1",
  macroPasted: "gm_macro_pasted_v1",
  macroScen:   "gm_macro_scen_v1",
  macroEvents: "gm_macro_events_v1",
  macroNotify: "gm_macro_notify_v1",
  macroSpeech: "gm_macro_speech_v1",
  macroRead:   "gm_macro_read_v1",
  macroSyncAt: "gm_macro_syncat_v1",
  macroDecisions: "gm_macro_decisions_v1",
  macroServerRead: "gm_macro_srvread_v1",
  // Watchlist names board (src/watchMonitor.js)
  watchList:      "gm_watch_list_v1",
  watchQuotes:    "gm_watch_quotes_v1",
  watchFund:      "gm_watch_fund_v1",
  watchAlertState:"gm_watch_alertstate_v1",
  watchAlerts:    "gm_watch_alerts_v1",
  watchDismissed: "gm_watch_dismissed_v1",
  watchLocalTried:"gm_watch_localtried_v1",
  watchView:      "gm_watch_view_v1",
};

export const EM_SK = {
  clusterState: "gm_em_cluster_v1",
  lastFetch:    "gm_em_fetch_v1",
};

export async function sGet(k) {
  try {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function sSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch(e) { console.warn("Storage full:", e); }
}
