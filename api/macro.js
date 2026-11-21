/* global process, Buffer */
// Macro monitor data (src/components/MacroTab.jsx). One serverless function
// serves every source, so the deployment's function count stays small and each
// source gets its own CDN cache lifetime.
//
// GET /api/macro?src=<source>&ids=<id,id,...>[&start=YYYY-MM-DD]
// → { src, tier, fetchedAt, series: { [id]: { points:[["YYYY-MM-DD", value|null], ...], asOf } },
//     errors: { [id]: "message" } }
// The cbw source returns { paths: { fed|ecb: {...} } } instead of series.
//
// Sources (reliability tags follow the playbook's PRIMARY / SECONDARY scheme):
//   treasury  US Treasury daily par yield curves, nominal + real       PRIMARY, no key
//   fred      St. Louis Fed FRED API (needs FRED_API_KEY)              PRIMARY (agency data)
//   ecb       ECB Data Portal (policy rates, €STR, monthly 10y yields) PRIMARY, no key
//   bbk       Bundesbank daily Bund yields                             PRIMARY, no key
//   mof       Japan Ministry of Finance JGB yields                     PRIMARY, no key
//   yahoo     Yahoo Finance chart endpoint (futures, FX, indices)      SECONDARY-reliable (unofficial API)
//   cbw       Central Bank Watch market-implied Fed/ECB paths (HTML)   SECONDARY-unverified

export const config = { maxDuration: 30 };

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BOT_UA = "GlobalMarketsWire/1.0 (macro monitor)";
const DAY = 86400000;

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const num = v => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function get(url, { signal, ua = BOT_UA, headers = {}, timeoutMs = 9000 } = {}) {
  // The request-wide deadline has passed: don't start new fetches (an "abort"
  // listener added to an already-aborted signal would never fire).
  if (signal?.aborted) throw new Error("timeout");
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": ua, ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// Bounded-concurrency map; each item resolves to { ok, value | error }.
async function settleLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = { ok: true, value: await fn(items[idx]) }; }
      catch (e) { out[idx] = { ok: false, error: e.name === "AbortError" ? "timeout" : e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Minimal RFC 4180 line splitter (quoted fields may contain commas).
export function splitCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const asSeries = points => {
  const pts = points.filter(p => p[0]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const lastGood = [...pts].reverse().find(p => p[1] !== null);
  return { points: pts, asOf: lastGood ? lastGood[0] : null };
};

// ─── US Treasury par yield curves ────────────────────────────────────────────
const TREASURY_COLS = {
  n1m: ["nominal", "1 Mo"], n3m: ["nominal", "3 Mo"], n6m: ["nominal", "6 Mo"], n1y: ["nominal", "1 Yr"],
  n2y: ["nominal", "2 Yr"], n5y: ["nominal", "5 Yr"], n10y: ["nominal", "10 Yr"], n30y: ["nominal", "30 Yr"],
  r5y: ["real", "5 YR"], r10y: ["real", "10 YR"], r30y: ["real", "30 YR"],
};
const TREASURY_TYPE = { nominal: "daily_treasury_yield_curve", real: "daily_treasury_real_yield_curve" };

export function parseTreasuryCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = splitCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(splitCsvLine);
  return { head, rows: rows.map(r => {
    const [m, d, y] = (r[0] || "").split("/");
    return { date: y && m && d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null, cells: r };
  }) };
}

async function fetchTreasury(ids, { signal }) {
  const types = [...new Set(ids.map(id => TREASURY_COLS[id]?.[0]).filter(Boolean))];
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear - 1, thisYear];
  const jobs = types.flatMap(t => years.map(y => ({ t, y })));
  const res = await settleLimit(jobs, 4, async ({ t, y }) => {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${TREASURY_TYPE[t]}&field_tdr_date_value=${y}&page&_format=csv`;
    return parseTreasuryCsv(await (await get(url, { signal })).text());
  });
  const series = {}, errors = {};
  for (const id of ids) {
    const spec = TREASURY_COLS[id];
    if (!spec) { errors[id] = "unknown tenor"; continue; }
    const [t, col] = spec;
    const pts = [];
    let failed = 0;
    jobs.forEach((j, i) => {
      if (j.t !== t) return;
      if (!res[i].ok) { failed++; return; }
      const { head, rows } = res[i].value;
      const ci = head.indexOf(col);
      if (ci < 0) return;
      rows.forEach(r => { if (r.date) pts.push([r.date, num(r.cells[ci])]); });
    });
    if (!pts.length) errors[id] = failed ? "Treasury download failed" : `column "${col}" not found`;
    else series[id] = asSeries(pts);
  }
  return { series, errors };
}

// ─── FRED ────────────────────────────────────────────────────────────────────
export function parseFredJson(json) {
  return asSeries((json?.observations || []).map(o => [o.date, num(o.value)]));
}

async function fetchFred(ids, { signal, start }) {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    const msg = "FRED_API_KEY is not set in Vercel";
    return { series: {}, errors: Object.fromEntries(ids.map(id => [id, msg])) };
  }
  const res = await settleLimit(ids, 5, async id => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${encodeURIComponent(key)}&file_type=json&observation_start=${start}`;
    return parseFredJson(await (await get(url, { signal })).json());
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── ECB Data Portal (SDMX csvdata) ─────────────────────────────────────────
export function parseEcbCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return asSeries([]);
  const head = splitCsvLine(lines[0]);
  const ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) throw new Error("unexpected ECB format");
  return asSeries(lines.slice(1).map(l => {
    const c = splitCsvLine(l);
    const t = c[ti] || "";
    const date = /^\d{4}-\d{2}$/.test(t) ? `${t}-01` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
    return [date, num(c[vi])];
  }));
}

async function fetchEcb(ids, { signal, start }) {
  const res = await settleLimit(ids, 4, async id => {
    const [flow, ...rest] = id.split("/");
    const url = `https://data-api.ecb.europa.eu/service/data/${flow}/${rest.join("/")}?format=csvdata&startPeriod=${start}`;
    return parseEcbCsv(await (await get(url, { signal, timeoutMs: 12000 })).text());
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── Bundesbank (daily Bund yields) ─────────────────────────────────────────
export function parseBbkCsv(text) {
  return asSeries(text.split(/\r?\n/)
    .map(l => l.match(/^(\d{4}-\d{2}-\d{2}),([^,]*)/))
    .filter(Boolean)
    .map(m => [m[1], num(m[2])]));
}

async function fetchBbk(ids, { signal, start }) {
  const res = await settleLimit(ids, 3, async id => {
    const url = `https://api.statistiken.bundesbank.de/rest/data/BBSIS/${id}?format=csv&lang=en&startPeriod=${start}`;
    return parseBbkCsv(await (await get(url, { signal, timeoutMs: 12000 })).text());
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── Japan MoF JGB yields ────────────────────────────────────────────────────
// Two files: the full history (to last month) and the current month. Dates are
// YYYY/M/D; "-" marks tenors not issued at the time.
export function parseMofCsv(text) {
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex(l => /^Date,/.test(l));
  if (hi < 0) return { head: [], rows: [] };
  const head = lines[hi].split(",").map(h => h.trim());
  const rows = lines.slice(hi + 1).map(l => l.split(",")).filter(c => /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(c[0]))
    .map(c => { const [y, m, d] = c[0].split("/"); return { date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, cells: c }; });
  return { head, rows };
}

async function fetchMof(ids, { signal, start }) {
  const base = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate";
  const files = [`${base}/historical/jgbcme_all.csv`, `${base}/jgbcme.csv`];
  const res = await settleLimit(files, 2, async url => {
    const buf = await (await get(url, { signal, timeoutMs: 15000 })).arrayBuffer();
    return parseMofCsv(Buffer.from(buf).toString("latin1"));
  });
  const byDate = new Map();
  const series = {}, errors = {};
  for (const id of ids) {
    byDate.clear();
    res.forEach(r => {
      if (!r.ok) return;
      const ci = r.value.head.indexOf(id);
      if (ci < 0) return;
      r.value.rows.forEach(row => { if (row.date >= start) byDate.set(row.date, num(row.cells[ci])); });
    });
    if (byDate.size) series[id] = asSeries([...byDate.entries()]);
    else errors[id] = res.every(r => !r.ok) ? (res[0].error || "MoF download failed") : `tenor ${id} not found`;
  }
  return { series, errors };
}

// ─── Yahoo Finance chart endpoint ───────────────────────────────────────────
export function parseYahooChart(json) {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta) throw new Error(json?.chart?.error?.description || "no data");
  const off = (meta.gmtoffset || 0) * 1000;
  const ts = r.timestamp || [];
  const closes = r.indicators?.quote?.[0]?.close || [];
  const pts = ts.map((t, i) => [isoDay(t * 1000 + off), num(closes[i])]);
  // The latest bar is the current session; Yahoo's live price is fresher than its close.
  const live = num(meta.regularMarketPrice);
  if (live !== null && meta.regularMarketTime) {
    const d = isoDay(meta.regularMarketTime * 1000 + off);
    const last = pts[pts.length - 1];
    if (last && last[0] === d) last[1] = live;
    else if (!last || d > last[0]) pts.push([d, live]);
  }
  const s = asSeries(pts);
  s.time = meta.regularMarketTime ? meta.regularMarketTime * 1000 : null;
  s.currency = meta.currency || null;
  return s;
}

async function fetchYahoo(ids, { signal }) {
  const res = await settleLimit(ids, 8, async sym => {
    let lastErr;
    for (const host of ["query1", "query2"]) {
      try {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
        return parseYahooChart(await (await get(url, { signal, ua: BROWSER_UA, headers: { Accept: "application/json" } })).json());
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── Central Bank Watch: market-implied meeting paths ───────────────────────
// Parsed strictly from its server-rendered table; if the layout changes the
// parser returns no rows and the source reports an error rather than guessing.
const CBW_PAGES = { fed: "federal-reserve", ecb: "european-central-bank" };
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const longDate = s => {
  const m = String(s).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  const mo = m && MONTHS[m[1].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
const signedNum = s => num(String(s).replace(/[−–]/g, "-"));

export function parseCbw(html) {
  const meetings = html.split(/<div class=cbw-row>/).slice(1).map(chunk => {
    const date = longDate((chunk.match(/class=cbw-row-date>([^<]+)</) || [])[1]);
    const pct = num((chunk.match(/class=cbw-move-pct>([\d.]+)%/) || [])[1]);
    const stepBp = signedNum((chunk.match(/class=cbw-move-step[^>]*>\s*([+\-−–]?[\d.]+)\s*bp/) || [])[1]);
    const level = num((chunk.match(/class=cbw-exp-big>([\d.]+)%/) || [])[1]);
    const higher = num((chunk.match(/higher\s+([\d.]+)%/) || [])[1]);
    const same = num((chunk.match(/same\s+([\d.]+)%/) || [])[1]);
    const lower = num((chunk.match(/lower\s+([\d.]+)%/) || [])[1]);
    return date && stepBp !== null && level !== null ? { date, pct, stepBp, level, higher, same, lower } : null;
  }).filter(Boolean);
  const head = html.match(/Markets price <strong>\s*([+\-−–]?[\d.]+)\s*bp<\/strong>\s*of\s+(tightening|easing|cuts|hikes)/i);
  const totalBp = head ? signedNum(head[1]) * (/easing|cuts/i.test(head[2]) ? -1 : 1) : null;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const asOfM = text.match(/Data as of ([A-Za-z]+ \d{1,2}, \d{4})/);
  const rateM = text.match(/Current (?:ECB )?(?:Federal Funds|Deposit Facility) Rate\s*([\d.]+)\s*%/);
  return { meetings, totalBp, asOf: asOfM ? longDate(asOfM[1]) : null, currentRate: rateM ? num(rateM[1]) : null };
}

async function fetchCbw(ids, { signal }) {
  const res = await settleLimit(ids, 2, async id => {
    const html = await (await get(`https://centralbank.watch/${CBW_PAGES[id]}/`, { signal, ua: BROWSER_UA, timeoutMs: 12000 })).text();
    const p = parseCbw(html);
    if (!p.meetings.length) throw new Error("page layout changed — no meeting rows parsed");
    return p;
  });
  const paths = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) paths[id] = res[i].value; else errors[id] = res[i].error; });
  return { paths, errors };
}

// ─── Router ─────────────────────────────────────────────────────────────────
const ADAPTERS = {
  treasury: { fetch: fetchTreasury, tier: "PRIMARY",              ttl: 1800, max: 12, re: /^[nr]\d{1,2}[my]$/ },
  fred:     { fetch: fetchFred,     tier: "PRIMARY",              ttl: 3600, max: 40, re: /^[A-Z0-9]{2,24}$/ },
  ecb:      { fetch: fetchEcb,      tier: "PRIMARY",              ttl: 3600, max: 12, re: /^[A-Z0-9_]{2,12}\/[A-Za-z0-9_.+]{3,80}$/ },
  bbk:      { fetch: fetchBbk,      tier: "PRIMARY",              ttl: 3600, max: 4,  re: /^[A-Za-z0-9_.]{10,80}$/ },
  mof:      { fetch: fetchMof,      tier: "PRIMARY",              ttl: 3600, max: 6,  re: /^\d{1,2}Y$/ },
  yahoo:    { fetch: fetchYahoo,    tier: "SECONDARY-reliable",   ttl: 300,  max: 60, re: /^[A-Za-z0-9^=.-]{1,15}$/ },
  cbw:      { fetch: fetchCbw,      tier: "SECONDARY-unverified", ttl: 1800, max: 2,  re: /^(fed|ecb)$/ },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const src = String(req.query?.src || "");
  const ad = ADAPTERS[src];
  if (!ad) { res.status(400).json({ error: `unknown src "${src}"` }); return; }
  const ids = [...new Set(String(req.query?.ids || "").split(",").map(s => s.trim()).filter(s => ad.re.test(s)))].slice(0, ad.max);
  if (!ids.length) { res.status(400).json({ error: "ids query param required" }); return; }
  const startQ = String(req.query?.start || "");
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startQ) ? startQ : isoDay(Date.now() - 400 * DAY);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const out = await ad.fetch(ids, { signal: ctl.signal, start });
    const okCount = Object.keys(out.series || out.paths || {}).length;
    // Cache successes for the source's lifetime; a total failure only briefly,
    // so a transient outage doesn't stick at the CDN.
    res.setHeader("Cache-Control", okCount
      ? `s-maxage=${ad.ttl}, stale-while-revalidate=${ad.ttl * 4}`
      : "s-maxage=60");
    res.status(200).json({ src, tier: ad.tier, fetchedAt: Date.now(), ...out });
  } catch (err) {
    res.status(502).json({ src, error: err.message });
  } finally {
    clearTimeout(timer);
  }
}
