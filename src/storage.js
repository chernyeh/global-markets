export const SK = {
  articles:  "gm_arts_v4",
  summaries: "gm_briefs_v4",
  lastFetch: "gm_fetch_v4",
  watchlist: "gm_watch_v4",
  watchHits: "gm_watchhits_v4",
  fontScale: "gm_fontscale_v1",
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
