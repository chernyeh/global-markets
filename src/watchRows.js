// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST — one row per name (pure; used by the browser hook and the server check)
// ═══════════════════════════════════════════════════════════════════════════════
import { marketOf, matchTerms } from "./data/watchMarkets.js";
import { levelsFor, nearestLevel, mergeNews, newsStats, feedMatches, isStale } from "./watchCalc.js";

const NO_NEWS_TYPES = new Set(["ETF", "Fund/Unit Trust"]);
const T = t => String(t || "").toUpperCase().trim();

// One row per ticker: the watchlist entry and/or the holding, the latest
// thesis, this app's settings for it, prices, valuations and news.
export function buildRows(list, quotes, fund, news, feedArts, now = Date.now()) {
  if (!list) return [];
  const byT = new Map();
  for (const w of list.watch || []) if (w.ticker) byT.set(T(w.ticker), { ticker: T(w.ticker), watch: w });
  for (const h of list.hold || []) {
    const k = T(h.ticker);
    if (!k) continue;
    const r = byT.get(k) || { ticker: k };
    r.hold = h; byT.set(k, r);
  }
  return [...byT.values()].map(r => {
    const k = r.ticker;
    const thesis = list.theses?.[k] || null;
    const meta = list.meta?.[k] || {};
    const market = marketOf(k);
    const benchSym = meta.bench || market.bench || null;
    const name = r.watch?.name || r.hold?.name || thesis?.company_name || fund?.[k]?.name || k;
    const q = quotes?.[k] || null;
    const benchQ = benchSym && benchSym !== k ? quotes?.[benchSym] || null : null;
    const levels = levelsFor({ watch: r.watch, hold: r.hold, thesis }, q?.currency, q?.last);
    const terms = matchTerms({ ticker: k, name, local: meta.local, localShort: meta.localShort, aliases: meta.aliases || [] });
    const items = mergeNews([news?.[k]?.items || [], feedMatches(feedArts || [], terms, now)]);
    const f = fund?.[k] || null;
    const rel = key => (q?.[key] !== null && q?.[key] !== undefined && benchQ?.[key] !== null && benchQ?.[key] !== undefined ? q[key] - benchQ[key] : null);
    const assetType = r.watch?.asset_type || r.hold?.asset_type || null;
    return {
      ...r, ticker: k, name, thesis, meta, market, assetType,
      sector: r.watch?.sector || r.hold?.sector || null, country: r.watch?.country || r.hold?.country || market.country,
      purposes: meta.purpose || [], group: meta.group || null, mute: !!meta.mute,
      benchSym, benchLabel: meta.bench ? meta.bench : market.benchLabel, benchQ,
      q, f, levels, nearest: nearestLevel(levels, q?.last),
      rel1m: rel("chg1m"), rel3m: rel("chg3m"), relYtd: rel("ytd"),
      newsItems: items, news: newsStats(items, now, news?.[k]?.stats), newsState: news?.[k] || null, terms,
      skipNews: NO_NEWS_TYPES.has(assetType) && !meta.q,
      nextResults: thesis?.next_results_date ? { date: thesis.next_results_date, src: "thesis" }
        : f?.earn ? { date: f.earn, src: "Yahoo", est: f.earnEst } : null,
      exDiv: list.exDiv?.[k] || null, deferral: list.deferrals?.[k] || null, liquidity: list.liquidity?.[k] || null,
      stale: isStale(q, now), ccyMismatch: levels.some(l => !l.ccyOk && !l.unitsOff), unitsOff: levels.some(l => l.unitsOff),
    };
  });
}
