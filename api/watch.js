/* global process */
// Watchlist endpoint (src/components/watch/). One function for every
// watchlist request, to keep the deployment's function count low.
//
// Private (header x-gm-key = GM_APP_KEY, as /api/store):
//   GET    ?kind=list                 Gloomberg watchlist + holdings + theses + this app's settings + 7 days of server alerts
//   POST   ?kind=item                 add a name to Gloomberg's watchlist        → { item }
//   PATCH  ?kind=item&id=             edit it (reason/notes changes logged)      → { item }
//   DELETE ?kind=item&id=             remove it                                  → { removed, notes } (full row + notes history, for undo)
//   POST   ?kind=restore              { snapshot, notes } put a removed row back → { item }
//   POST   ?kind=meta                 { patches: { TICKER: {...} } } why tracked, group, local name, benchmark, mute
//   POST   ?kind=prefs                { tgLevels, tgMoves, sigma }
// Public market data (no personal data; CDN-cached):
//   GET    ?kind=quotes&symbols=A,B   1y daily closes reduced to stats + weekly sparkline (Yahoo, 5 min)
//   GET    ?kind=fund&symbols=A,B     P/E, P/B, yield, market cap, earnings date (Yahoo v7 via Gloomberg's proxy, 4 h)
//   GET    ?kind=news&t=&n=&l=&ls=&a=&x=  Google News for one name, English + home-market language, filtered to headlines naming it (30 min)
//   GET    ?kind=lookup&symbol=       name and currency for a ticker (add form)

import { fetchSourceDirect, yahooJson } from "./macro.js";
import { supabaseConfigured } from "./_supabase.js";
import { loadCoverage, recentWatchAlerts, addItem, updateItem, removeItem, restoreItem, setMeta, setPrefs, fetchFundamentals, TICKER_RE } from "./_watchlist.js";
import { seriesStats, mergeNews } from "../src/watchCalc.js";
import { MARKETS, marketOf, coreName, matchTerms, termRegex, gnUrl } from "../src/data/watchMarkets.js";
import { parseRss } from "../src/macroSpeech.js";

export const config = { maxDuration: 30 };

const authorised = req => !!process.env.GM_APP_KEY && req.headers?.["x-gm-key"] === process.env.GM_APP_KEY;
const SYM_RE = /^[A-Za-z0-9^=.&-]{1,20}$/;
const symbolsOf = q => [...new Set(String(q || "").split(",").map(s => s.trim()).filter(s => SYM_RE.test(s)))].slice(0, 150);
const s80 = v => (v ? String(v).slice(0, 80) : "");

async function quotes(symbols, signal) {
  const out = {}, errors = {};
  for (let i = 0; i < symbols.length; i += 100) {
    const r = await fetchSourceDirect("yahoo", symbols.slice(i, i + 100), null, signal);
    for (const [sym, s] of Object.entries(r.series || {})) {
      const st = seriesStats(s);
      if (st) out[sym] = st; else errors[sym] = "too few prices";
    }
    Object.assign(errors, r.errors || {});
  }
  return { out, errors };
}

// One name's news: the English query (home edition where the home market is
// English-speaking, else the US edition) plus a home-language query, both
// over 7 days, kept only where the headline names the company.
async function news(p, signal) {
  const m = marketOf(p.t);
  const core = coreName(p.n);
  const aliases = String(p.a || "").split("|").map(s => s.trim()).filter(Boolean).slice(0, 6);
  const english = m.hl.startsWith("en") ? m : MARKETS[""];
  // "Full name" OR "short names headlines use" (e.g. OCBC, LVMH), last 7 days.
  const orq = terms => { const t = [...new Set(terms.filter(Boolean))].slice(0, 4).map(x => `"${x.replace(/"/g, "")}"`); return `${t.length > 1 ? `(${t.join(" OR ")})` : t[0]} when:7d`; };
  const qs = [{ url: gnUrl(p.x || orq([core, ...aliases]), english), lang: "en" }];
  if (!m.hl.startsWith("en")) {
    const local = p.l ? [p.l, p.ls] : m.script ? [] : [core, ...aliases];
    if (local.length) qs.push({ url: gnUrl(orq(local), m), lang: m.hl });
  }
  const re = p.x ? null : termRegex(matchTerms({ ticker: p.t, name: p.n, local: p.l, localShort: p.ls, aliases }));
  const lists = [], errors = [], counts = { n24: 0, n7: 0, perDay: 0, capped: false };
  // Google News sometimes answers a burst of requests with a page that isn't a
  // feed; that is an error (short CDN cache, one retry), not "no news".
  const read = async url => {
    const r = await fetch(url, { signal, headers: { "User-Agent": "GlobalMarketsWire/1.0 (watchlist)", Accept: "application/rss+xml,application/xml" } });
    const xml = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (!/<rss[\s>]|<channel[\s>]/i.test(xml)) throw new Error("not a feed (Google News may be throttling)");
    return xml;
  };
  await Promise.all(qs.map(async q => {
    try {
      let xml;
      try { xml = await read(q.url); } catch { await new Promise(r => setTimeout(r, 1500)); xml = await read(q.url); }
      const raw = parseRss(xml);
      const kept = raw.filter(it => !re || re.test(it.title)).sort((a, b) => b.ts - a.ts);
      const now = Date.now();
      const D = 86400000;
      counts.n24 += kept.filter(it => now - it.ts <= D).length;
      counts.n7 += kept.filter(it => now - it.ts <= 7 * D).length;
      // The usual daily rate, from the stories before the last 24h. Google returns at most
      // 100 items, and at the cap it returns a sample spread over the week rather than the
      // newest 100 (checked 25 Nov 2026: "Alphabet" gave 12/15/8/4/18/29/14 by day), so a
      // capped page has no measurable rate: perDay null, and no "unusual" call is made.
      const prior = kept.filter(it => now - it.ts > D && now - it.ts <= 7 * D).length;
      const full = raw.length >= 95;
      if (full) counts.capped = true;
      const rate = full ? null : prior / 6;
      counts.perDay = counts.perDay === null || rate === null ? null : counts.perDay + rate;
      // Newest 30 per language, so a busy home-language press doesn't crowd out English.
      lists.push(kept.slice(0, 30).map(it => ({ title: it.title, link: it.link, outlet: it.outlet, ts: it.ts, lang: q.lang === "en" ? "en" : "local" })));
    } catch (e) { errors.push(`${q.lang}: ${e.message}`); }
  }));
  const cutoff = Date.now() - 7 * 86400000;
  return { items: mergeNews(lists).filter(i => i.ts >= cutoff).slice(0, 60), stats: counts, queries: qs.length, needsLocal: m.script && !p.l, errors };
}

export default async function handler(req, res) {
  const kind = String(req.query?.kind || "");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 26000);
  try {
    // ── Public market data ──
    if (kind === "quotes" || kind === "fund") {
      const syms = symbolsOf(req.query.symbols);
      if (!syms.length) { res.status(400).json({ error: "symbols query param required" }); return; }
      const { out, errors } = kind === "quotes" ? await quotes(syms, ctl.signal) : await fetchFundamentals(syms, ctl.signal);
      const ok = Object.keys(out).length;
      res.setHeader("Cache-Control", ok ? (kind === "quotes" ? "s-maxage=300, stale-while-revalidate=900" : "s-maxage=14400, stale-while-revalidate=43200") : "s-maxage=60");
      res.status(200).json({ [kind]: out, errors, fetchedAt: Date.now() });
      return;
    }
    if (kind === "news") {
      const t = String(req.query.t || "").toUpperCase();
      if (!TICKER_RE.test(t) || !req.query.n) { res.status(400).json({ error: "t (ticker) and n (name) required" }); return; }
      const out = await news({ t, n: s80(req.query.n), l: s80(req.query.l), ls: s80(req.query.ls), a: String(req.query.a || "").slice(0, 300), x: String(req.query.x || "").slice(0, 160) }, ctl.signal);
      res.setHeader("Cache-Control", out.errors.length ? "s-maxage=120" : "s-maxage=1800, stale-while-revalidate=3600");
      res.status(200).json(out);
      return;
    }
    if (kind === "lookup") {
      const sym = String(req.query.symbol || "").toUpperCase().trim();
      if (!SYM_RE.test(sym)) { res.status(400).json({ error: "symbol required" }); return; }
      try {
        const j = await yahooJson(`/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`, { signal: ctl.signal });
        const meta = j?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error(j?.chart?.error?.description || "not found");
        res.setHeader("Cache-Control", "s-maxage=86400");
        res.status(200).json({ symbol: sym, name: meta.longName || meta.shortName || null, currency: meta.currency || null,
          exchange: meta.fullExchangeName || meta.exchangeName || null, type: meta.instrumentType || null, price: meta.regularMarketPrice ?? null });
      } catch (e) {
        res.status(404).json({ error: /404|not found|No data/i.test(e.message) ? "Yahoo doesn't know that ticker — check the suffix (e.g. 7203.T, D05.SI, 0005.HK)" : e.message });
      }
      return;
    }

    // ── Private: your Gloomberg data ──
    res.setHeader("Cache-Control", "no-store");
    if (!authorised(req)) { res.status(401).json({ error: "app key missing or wrong — enter it in Macro → Setup" }); return; }
    if (!supabaseConfigured()) { res.status(500).json({ error: "SUPABASE_SECRET_KEY is not set in Vercel" }); return; }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = String(req.query.id || "");

    if (kind === "list") {
      const [cov, alerts] = await Promise.all([loadCoverage(), recentWatchAlerts(7)]);
      res.status(200).json({ ...cov, alerts, at: Date.now() });
      return;
    }
    if (kind === "item") {
      if (req.method === "POST") { res.status(200).json({ item: await addItem(body) }); return; }
      if (req.method === "PATCH" && id) { res.status(200).json({ item: await updateItem(id, body) }); return; }
      if (req.method === "DELETE" && id) { res.status(200).json(await removeItem(id)); return; }
    }
    if (kind === "restore" && req.method === "POST") { res.status(200).json({ item: await restoreItem(body.snapshot, body.notes) }); return; }
    if (kind === "meta" && req.method === "POST") { res.status(200).json({ meta: await setMeta(body.patches) }); return; }
    if (kind === "prefs" && req.method === "POST") { res.status(200).json({ prefs: await setPrefs(body) }); return; }
    res.status(400).json({ error: `unknown request "${req.method} ${kind}"` });
  } catch (e) {
    res.status(/already on|required|not in Yahoo|Nothing to restore/.test(e.message) ? 400 : /Not found|Not on the watchlist/.test(e.message) ? 404 : 500).json({ error: e.message });
  } finally {
    clearTimeout(timer);
  }
}
