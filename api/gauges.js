// Daily moves for the Focus-dial market gauges (src/data/taxonomy.js →
// MARKET_GAUGES). Uses Yahoo's chart endpoint, which — unlike the v7 quote
// endpoint behind /api/quote — does not need a session cookie ("crumb").
//
// GET /api/gauges?symbols=BZ=F,^TNX,...
// → { gauges: { "BZ=F": { price, prevClose, time } | null, ... } }
//
// prevClose is the previous daily bar's close, so the move is the latest
// session's move — including a session still in progress.

const SYMBOL_RE = /^[A-Za-z0-9^=.-]{1,15}$/;
const MAX_SYMBOLS = 12;

export function parseChart(json) {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta) return null;
  const closes = (r?.indicators?.quote?.[0]?.close || []).filter(v => typeof v === "number");
  const price = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : closes[closes.length - 1];
  // The last bar is the current (or latest) session; the one before it is the prior close.
  const prevClose = closes.length >= 2 ? closes[closes.length - 2]
    : typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose
    : meta.previousClose;
  if (typeof price !== "number" || typeof prevClose !== "number" || !prevClose) return null;
  return { price, prevClose, time: meta.regularMarketTime ? meta.regularMarketTime * 1000 : null };
}

async function fetchOne(sym, signal) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`;
  const r = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });
  if (!r.ok) return null;
  return parseChart(await r.json());
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbols = String(req.query.symbols || "").split(",").map(s => s.trim()).filter(s => SYMBOL_RE.test(s)).slice(0, MAX_SYMBOLS);
  if (!symbols.length) {
    res.status(400).json({ error: "symbols query param required" });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const results = await Promise.all(symbols.map(s => fetchOne(s, controller.signal).catch(() => null)));
    clearTimeout(timeout);
    // Daily moves change slowly; cache at the CDN for 5 minutes.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ gauges: Object.fromEntries(symbols.map((s, i) => [s, results[i]])) });
  } catch (err) {
    clearTimeout(timeout);
    res.status(500).json({ error: err.message });
  }
}
