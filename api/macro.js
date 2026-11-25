/* global process, Buffer */
// Macro monitor data (src/components/MacroTab.jsx). One serverless function
// serves every source, so the deployment's function count stays small and each
// source gets its own CDN cache lifetime.
//
// GET /api/macro?src=<source>&ids=<id,id,...>[&start=YYYY-MM-DD]
// → { src, tier, fetchedAt, series: { [id]: { points:[["YYYY-MM-DD", value|null], ...], asOf } },
//     errors: { [id]: "message" } }
// The cbw source returns { paths: { fed|ecb|boj|boe|rba|rbnz|snb: {...} } } instead of series.
//
// Sources (reliability tags follow the playbook's PRIMARY / SECONDARY scheme):
//   treasury  US Treasury daily par yield curves, nominal + real       PRIMARY, no key
//   fred      St. Louis Fed FRED API (needs FRED_API_KEY)              PRIMARY (agency data)
//   ecb       ECB Data Portal (policy rates, €STR, monthly 10y yields) PRIMARY, no key
//   bbk       Bundesbank daily Bund yields                             PRIMARY, no key
//   mof       Japan Ministry of Finance JGB yields                     PRIMARY, no key
//   yahoo     Yahoo Finance chart endpoint (futures, FX, indices)      SECONDARY-reliable (unofficial API)
//   cbw       Central Bank Watch market-implied Fed/ECB paths (HTML)   SECONDARY-unverified
//   bls       BLS API v2 — CPI items, PPI, average prices (BLS_API_KEY) PRIMARY
//   eurostat  Eurostat HICP, ECOICOP ver.2 (prc_hicp_minr)              PRIMARY, no key
//   gie       GIE AGSI+ EU gas storage (GIE_API_KEY optional)          PRIMARY
//   fao       FAO Food Price Index (monthly CSV)                       PRIMARY, no key
//   mpt       Atlanta Fed Market Probability Tracker (SOFR options)    PRIMARY (Atlanta Fed model), no key
//   sina      Sina Finance daily bars, China futures (SHFE/DCE main)   SECONDARY-unverified (unofficial endpoint)
//   sinag     Sina Finance daily bars, global futures (COMEX/ICE/CBOT/LME) SECONDARY-unverified — fallback for Yahoo
//   sinaus    Sina Finance daily bars, US shares/ETFs/indices          SECONDARY-unverified — fallback for Yahoo
//   ecbfx     ECB euro reference rates → crosses and the DXY formula   PRIMARY (official daily fix), no key
//   bis       BIS central bank policy rates (WS_CBPOL)                 PRIMARY, no key

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

export async function get(url, { signal, ua = BOT_UA, headers = {}, timeoutMs = 9000, method = "GET", body } = {}) {
  // The request-wide deadline has passed: don't start new fetches (an "abort"
  // listener added to an already-aborted signal would never fire).
  if (signal?.aborted) throw new Error("timeout");
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, body, signal: ctl.signal, headers: { "User-Agent": ua, ...headers } });
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

// Spark batches up to 20 symbols per request; each result carries the same
// { meta, timestamp, indicators } block as the chart endpoint.
export function parseYahooSpark(json) {
  const out = {}, errors = {};
  if (json?.spark?.error) throw new Error(json.spark.error.description || "spark error");
  for (const r of json?.spark?.result || []) {
    try { out[r.symbol] = parseYahooChart({ chart: { result: [r.response?.[0]] } }); }
    catch (e) { errors[r.symbol] = e.message; }
  }
  return { series: out, errors };
}

// Why Yahoo tiles went blank: Yahoo throttles per IP *and* User-Agent, and the
// adapter used to send a stock Chrome User-Agent from Vercel's shared AWS IPs —
// the same string countless other scrapers there send — with one request per
// symbol (≈60 at once). Tested from the build sandbox on 23 Nov 2026: in the
// same second the Chrome string got HTTP 429 and this app's own User-Agent got
// 200. So the adapter now identifies itself as the app (like every other
// source here), asks for 20 symbols per spark request (≈75 tickers = 4
// requests, one at a time), retries a 429/5xx once after a pause on the other
// host, and stops asking for the rest of the run once Yahoo refuses twice —
// hammering a throttled endpoint only extends the block. Symbols a successful
// batch leaves out get one chart call each.
const YAHOO_BATCH = 20;
const pause = ms => new Promise(r => setTimeout(r, ms));
const retryable = e => /HTTP (429|5\d\d)|timeout|fetch failed/i.test(e?.message || "");

export async function yahooJson(path, { signal }) {
  let lastErr;
  for (const [i, host] of ["query1", "query2"].entries()) {
    try {
      if (i) await pause(1500);
      const r = await get(`https://${host}.finance.yahoo.com${path}`, { signal, headers: { Accept: "application/json" } });
      return await r.json();
    } catch (e) { lastErr = e; if (!retryable(e)) break; }
  }
  throw lastErr;
}

async function fetchYahoo(ids, { signal }) {
  const batches = [];
  for (let i = 0; i < ids.length; i += YAHOO_BATCH) batches.push(ids.slice(i, i + YAHOO_BATCH));
  const series = {}, errors = {};
  let refused = null;
  for (const batch of batches) {
    if (refused) { batch.forEach(id => { errors[id] = refused; }); continue; }
    try {
      const out = parseYahooSpark(await yahooJson(`/v7/finance/spark?symbols=${batch.map(encodeURIComponent).join(",")}&range=1y&interval=1d`, { signal }));
      Object.assign(series, out.series); Object.assign(errors, out.errors);
    } catch (e) {
      const msg = e.name === "AbortError" ? "timeout" : e.message;
      batch.forEach(id => { errors[id] = msg; });
      if (/429/.test(msg)) refused = `${msg} (Yahoo throttling — not retried this run)`;
    }
  }
  // Symbols a successful batch left out: one chart call each (a handful at most).
  const missing = ids.filter(id => !series[id] && !(errors[id] && /HTTP|timeout/.test(errors[id])));
  if (!refused && missing.length && missing.length <= 8) {
    const one = await settleLimit(missing, 2, sym =>
      yahooJson(`/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`, { signal }).then(parseYahooChart));
    missing.forEach((id, i) => { if (one[i].ok) { series[id] = one[i].value; delete errors[id]; } else errors[id] = one[i].error; });
  }
  ids.forEach(id => { if (!series[id] && !errors[id]) errors[id] = "no data"; });
  return { series, errors };
}

// ─── Central Bank Watch: market-implied meeting paths ───────────────────────
// Parsed strictly from its server-rendered table; if the layout changes the
// parser returns no rows and the source reports an error rather than guessing.
// The BoE, RBA, RBNZ and SNB pages feed the lead-central-banks card. The site's
// Bank of Canada page carried no pricing table and Dec 2024 text (checked 23 Nov
// 2026), so it is not read.
const CBW_PAGES = { fed: "federal-reserve", ecb: "european-central-bank", boj: "bank-of-japan",
  boe: "bank-of-england", rba: "reserve-bank-of-australia", rbnz: "reserve-bank-of-new-zealand", snb: "swiss-national-bank" };
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const longDate = s => {
  const m = String(s).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  const mo = m && MONTHS[m[1].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
const signedNum = s => num(String(s).replace(/[−–]/g, "-"));

export function parseCbw(html) {
  const cell = (chunk, re) => (chunk.match(re) || [])[1];
  const row = (chunk, dateRe, levelRe, splitRe) => {
    const date = longDate(cell(chunk, dateRe));
    const pct = num(cell(chunk, /class=cbw-move-pct>([\d.]+)%/));
    const stepBp = signedNum(cell(chunk, /class=cbw-move-step[^>]*>\s*([+\-−–]?[\d.]+)\s*bp/));
    const level = num(cell(chunk, levelRe));
    const [higher, same, lower] = splitRe.map(re => num(cell(chunk, re)));
    return date && stepBp !== null && level !== null ? { date, pct, stepBp, level, higher, same, lower } : null;
  };
  // Two layouts: card rows (Fed, ECB, BoJ, BoE, RBNZ, SNB) and a table (RBA).
  let meetings = html.split(/<div class=cbw-row>/).slice(1).map(c => row(c, /class=cbw-row-date>([^<]+)</, /class=cbw-exp-big>([\d.]+)%/,
    [/higher\s+([\d.]+)%/, /same\s+([\d.]+)%/, /lower\s+([\d.]+)%/])).filter(Boolean);
  if (!meetings.length) {
    meetings = html.split(/<td class=cbw-mtg-date>/).slice(1).map(c => row(`class=cbw-mtg-date>${c.split(/<\/tr>/)[0]}`, /class=cbw-mtg-date>([^<]+)</,
      /class="[^"]*cbw-exp"[^>]*>([\d.]+)%/, [/cbw-chip-up">([\d.]+)%/, /cbw-chip-flat">([\d.]+)%/, /cbw-chip-down">([\d.]+)%/])).filter(Boolean);
  }
  const head = html.match(/Markets price <strong>\s*([+\-−–]?[\d.]+)\s*bp<\/strong>\s*of\s+(tightening|easing|cuts|hikes)/i);
  const totalBp = head ? signedNum(head[1]) * (/easing|cuts/i.test(head[2]) ? -1 : 1) : null;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const asOfM = text.match(/Data as of ([A-Za-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/);
  const rateM = text.match(/Current (?:ECB |BoJ )?(?:Federal Funds|Deposit Facility|Policy) Rate\s*([\d.]+)\s*%/);
  // The rate the pricing table starts from: first meeting's expected level less
  // its priced step. The pages' prose "current rate" lines can be stale.
  const f = meetings[0];
  const baseRate = f ? Math.round((f.level - f.stepBp / 100) * 100) / 100 + 0 : null; // + 0 turns −0 into 0
  const asOf = asOfM ? (/^\d{4}-/.test(asOfM[1]) ? asOfM[1] : longDate(asOfM[1])) : null;
  return { meetings, totalBp, asOf, currentRate: rateM ? num(rateM[1]) : null, baseRate };
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

// ─── BLS (CPI items, PPI, average prices) ───────────────────────────────────
// API v2. With BLS_API_KEY: 50 series per query, 500 queries a day. Without a
// key BLS allows 25 series and a small daily quota per IP — shared cloud IPs
// often exhaust it, so the key is effectively required in production.
// Monthly periods M01–M12 only (M13 is the annual average); "-" marks a month
// not collected (e.g. Oct 2025, during the federal shutdown).
export function parseBlsJson(json, ids) {
  const series = {}, errors = {};
  if (json?.status !== "REQUEST_SUCCEEDED") {
    const msg = (json?.message || [])[0] || json?.status || "BLS request failed";
    ids.forEach(id => { errors[id] = msg.includes("threshold") ? "BLS daily quota reached — add BLS_API_KEY" : msg; });
    return { series, errors };
  }
  for (const s of json.Results?.series || []) {
    const pts = (s.data || []).filter(o => /^M(0[1-9]|1[0-2])$/.test(o.period))
      .map(o => [`${o.year}-${o.period.slice(1)}-01`, num(o.value)]);
    if (pts.some(p => p[1] !== null)) series[s.seriesID] = asSeries(pts);
  }
  // BLS lists unknown or empty series in `message` ("Series does not exist for Series X").
  for (const m of json.message || []) {
    const id = ids.find(x => m.includes(x));
    if (id && !series[id]) errors[id] = m.replace(/\s*for Series\s+\S+/i, "").trim();
  }
  ids.forEach(id => { if (!series[id] && !errors[id]) errors[id] = "no data"; });
  return { series, errors };
}

async function fetchBls(ids, { signal, start }) {
  const key = process.env.BLS_API_KEY;
  const per = key ? 50 : 25;
  const endyear = String(new Date().getUTCFullYear());
  const startyear = String(Math.max(Number(start.slice(0, 4)), Number(endyear) - (key ? 19 : 9)));
  const batches = [];
  for (let i = 0; i < ids.length; i += per) batches.push(ids.slice(i, i + per));
  const res = await settleLimit(batches, 2, async batch => {
    const body = JSON.stringify({ seriesid: batch, startyear, endyear, ...(key ? { registrationkey: key } : {}) });
    const r = await get("https://api.bls.gov/publicAPI/v2/timeseries/data/", { signal, method: "POST", body, timeoutMs: 15000,
      headers: { "Content-Type": "application/json" } });
    return parseBlsJson(await r.json(), batch);
  });
  const series = {}, errors = {};
  res.forEach((r, i) => {
    if (r.ok) { Object.assign(series, r.value.series); Object.assign(errors, r.value.errors); }
    else batches[i].forEach(id => { errors[id] = r.error; });
  });
  return { series, errors };
}

// ─── Eurostat HICP (ECOICOP ver.2) ──────────────────────────────────────────
// prc_hicp_minr replaced the ECOICOP ver.1 datasets from January 2026 data
// (the ECB portal's ICP series and prc_hicp_manr stop at Dec 2025).
// ids are "GEO:COICOP18:UNIT", e.g. "EA:TOT_X_NRG_FOOD:RCH_A".
export function parseJsonStat(j, wanted) {
  const dims = j.id, size = j.size;
  const idx = d => j.dimension[d].category.index;
  const times = Object.entries(idx("time")).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  const series = {};
  for (const w of wanted) {
    const coord = { freq: "M", unit: w.unit, coicop18: w.coicop, geo: w.geo };
    const pts = times.map(t => {
      let flat = 0;
      for (let k = 0; k < dims.length; k++) {
        const d = dims[k];
        const v = d === "time" ? idx("time")[t] : idx(d)[coord[d]];
        if (v === undefined) return [null, null];
        flat = flat * size[k] + v;
      }
      return [/^\d{4}-\d{2}$/.test(t) ? `${t}-01` : null, num(j.value?.[flat] ?? j.value?.[String(flat)])];
    });
    if (pts.some(p => p[0] && p[1] !== null)) series[w.id] = asSeries(pts);
  }
  return series;
}

async function fetchEurostat(ids, { signal, start }) {
  const wanted = ids.map(id => { const [geo, coicop, unit] = id.split(":"); return { id, geo, coicop, unit }; });
  const units = [...new Set(wanted.map(w => w.unit))];
  const res = await settleLimit(units, 2, async unit => {
    const ws = wanted.filter(w => w.unit === unit);
    const qs = [...new Set(ws.map(w => `geo=${w.geo}`)), ...new Set(ws.map(w => `coicop18=${w.coicop}`))].join("&");
    const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?format=JSON&lang=EN&unit=${unit}&${qs}&sinceTimePeriod=${start.slice(0, 7)}`;
    const j = await (await get(url, { signal, timeoutMs: 15000 })).json();
    if (j.error) throw new Error(j.error?.[0]?.label || j.error?.label || "Eurostat error");
    return parseJsonStat(j, ws);
  });
  const series = {}, errors = {};
  res.forEach((r, i) => {
    const ws = wanted.filter(w => w.unit === units[i]);
    if (r.ok) Object.assign(series, r.value);
    ws.forEach(w => { if (!series[w.id]) errors[w.id] = r.ok ? "no data" : r.error; });
  });
  return { series, errors };
}

// ─── GIE AGSI+ — EU gas storage ─────────────────────────────────────────────
// ids: "eu" → % full, daily, ~13 months; "eu:avg5" → the same gas day's
// average fill over the previous five years (one point, for the reference line).
async function gieGet(qs, signal) {
  const key = process.env.GIE_API_KEY;
  const r = await get(`https://agsi.gie.eu/api?${qs}`, { signal, timeoutMs: 12000, headers: key ? { "x-key": key } : {} });
  return r.json();
}

async function fetchGie(ids, { signal, start }) {
  const series = {}, errors = {};
  const area = "eu";
  try {
    const to = isoDay(Date.now());
    const pages = await settleLimit([1, 2], 2, page => gieGet(`type=${area}&from=${start}&to=${to}&size=300&page=${page}`, signal));
    const rows = pages.filter(p => p.ok).flatMap(p => p.value?.data || []);
    if (!rows.length) throw new Error(pages.find(p => !p.ok)?.error || "no data");
    const s = asSeries(rows.map(r => [r.gasDayStart, num(r.full)]));
    if (ids.includes("eu")) series.eu = s;
    if (ids.includes("eu:avg5") && s.asOf) {
      const [y, md] = [Number(s.asOf.slice(0, 4)), s.asOf.slice(4)];
      // One year at a time with a retry: keyless GIE calls get rate-limited, and an
      // average over whichever years happened to answer would be misleading.
      const vals = [];
      for (let k = 1; k <= 5; k++) {
        let v = null;
        for (let attempt = 0; attempt < 2 && v === null; attempt++) {
          if (attempt) await new Promise(r => setTimeout(r, 800));
          try { v = num((await gieGet(`type=${area}&date=${y - k}${md}`, signal))?.data?.[0]?.full); } catch { v = null; }
        }
        if (v === null) break;
        vals.push(v);
      }
      if (vals.length === 5) {
        series["eu:avg5"] = { points: [[s.asOf, vals.reduce((a, b) => a + b, 0) / 5]], asOf: s.asOf, years: vals };
      } else errors["eu:avg5"] = `only ${vals.length} of 5 prior years returned — add GIE_API_KEY for higher limits`;
    }
  } catch (e) {
    ids.forEach(id => { if (!series[id]) errors[id] = e.message; });
  }
  return { series, errors };
}

// ─── FAO Food Price Index ───────────────────────────────────────────────────
// The CSV link carries a changing version suffix, so it is read off the FFPI
// page first; the plain file name is the fallback.
const FAO_COLS = { ffpi: "Food Price Index", meat: "Meat", dairy: "Dairy", cereals: "Cereals", oils: "Oils", sugar: "Sugar" };
export function parseFaoCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const hi = lines.findIndex(l => /^Date,/.test(l));
  if (hi < 0) throw new Error("FAO CSV header not found");
  const head = lines[hi].split(",").map(h => h.trim());
  const rows = lines.slice(hi + 1).map(l => l.split(",")).filter(c => /^\d{4}-\d{2}$/.test(c[0]));
  const out = {};
  for (const [id, col] of Object.entries(FAO_COLS)) {
    const ci = head.indexOf(col);
    if (ci >= 0) out[id] = asSeries(rows.map(c => [`${c[0]}-01`, num(c[ci])]));
  }
  return out;
}

async function fetchFao(ids, { signal, start }) {
  const base = "https://www.fao.org/media/docs/worldfoodsituationlibraries/wfs-library/food_price_indices_data.csv";
  let url = `${base}?download=true`;
  try {
    const page = await (await get("https://www.fao.org/worldfoodsituation/foodpricesindex/en/", { signal, ua: BROWSER_UA })).text();
    const m = page.match(/href="([^"]*food_price_indices_data\.csv[^"]*)"/);
    if (m) url = m[1].replace(/&amp;/g, "&");
  } catch { /* fall back to the plain file name */ }
  const series = {}, errors = {};
  try {
    const all = parseFaoCsv(await (await get(url, { signal, ua: BROWSER_UA, timeoutMs: 15000 })).text());
    for (const id of ids) {
      const s = all[id];
      if (s) series[id] = asSeries(s.points.filter(p => p[0] >= start.slice(0, 7)));
      else errors[id] = "column not found";
    }
  } catch (e) { ids.forEach(id => { errors[id] = e.message; }); }
  return { series, errors };
}

// ─── Atlanta Fed Market Probability Tracker (SOFR options) ──────────────────
// The tracker publishes one Excel workbook (≈7 MB; its DATA sheet is ≈67 MB of
// XML, rows sorted by date). A minimal zip reader locates the entries; the
// sheet is stream-inflated and only its tail — the latest weeks — is kept.
const MPT_URL = "https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/research-and-data/data/market-probability-tracker/mpt_histdata.xlsx";
const MPT_FIELDS = new Set(["Rate: mean", "Rate: mode", "Rate: 25th percentile", "Rate: 75th percentile", "Prob: cut", "Prob: hike"]);

export function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    out[name] = { method, data: buf.subarray(dataStart, dataStart + csize) };
    p += 46 + nlen + elen + clen;
  }
  return out;
}

async function inflateEntry(entry, { tailBytes = 0 } = {}) {
  const zlib = await import("node:zlib");
  if (entry.method === 0) return entry.data.toString("utf8");
  if (!tailBytes) return zlib.inflateRawSync(entry.data).toString("utf8");
  // Stream, keeping only the last `tailBytes` of output.
  return new Promise((resolve, reject) => {
    const inf = zlib.createInflateRaw();
    let chunks = [], size = 0;
    inf.on("data", c => {
      chunks.push(c); size += c.length;
      while (size - chunks[0].length >= tailBytes) { size -= chunks[0].length; chunks.shift(); }
    });
    inf.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    inf.on("error", reject);
    inf.end(entry.data);
  });
}

const excelDay = n => isoDay(Date.UTC(1899, 11, 30) + Number(n) * DAY);

export function parseMptRows(sheetTail, strings) {
  const rows = [];
  const rowRe = /<row [^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<f>[^<]*<\/f>)?(?:<v>([^<]*)<\/v>)?(?:<is><t>([^<]*)<\/t><\/is>)?<\/c>)/g;
  let m;
  while ((m = rowRe.exec(sheetTail))) {
    const cells = {};
    let c;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(m[1]))) {
      const [, col, attrs, v, t] = c;
      cells[col] = attrs.includes('t="s"') && v !== undefined ? strings[Number(v)] : (v ?? t ?? "");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells.A || "") || !MPT_FIELDS.has(cells.D)) continue;
    rows.push({ date: cells.A, start: /^\d+(\.\d+)?$/.test(cells.B) ? excelDay(cells.B) : cells.B, range: cells.C, field: cells.D, value: num(cells.E) });
  }
  return rows;
}

const MPT_KEY = { "Rate: mean": "mean", "Rate: mode": "mode", "Rate: 25th percentile": "p25", "Rate: 75th percentile": "p75", "Prob: cut": "pCut", "Prob: hike": "pHike" };
export function summariseMpt(rows) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const snap = date => {
    if (!date) return null;
    const byStart = {};
    let range = null;
    for (const r of rows) {
      if (r.date !== date) continue;
      range = r.range;
      (byStart[r.start] ||= { start: r.start })[MPT_KEY[r.field]] = r.value;
    }
    return { asOf: date, targetRange: range, windows: Object.values(byStart).sort((a, b) => (a.start < b.start ? -1 : 1)) };
  };
  const latest = dates[dates.length - 1];
  // Same-window comparisons 1 week, 1 month, 3 months and 6 months back: how
  // pricing for a given quarter has moved (the file goes back to March 2023).
  const back = days => [...dates].reverse().find(d => d <= isoDay(Date.parse(`${latest}T00:00:00Z`) - days * DAY));
  const priors = Object.fromEntries([["w1", 7], ["m1", 30], ["m3", 91], ["m6", 182]].map(([k, n]) => [k, snap(back(n))]));
  return { ...snap(latest), prior: priors.w1, priors };
}

async function fetchMpt(ids, { signal }) {
  try {
    const buf = Buffer.from(await (await get(MPT_URL, { signal, ua: BROWSER_UA, timeoutMs: 20000 })).arrayBuffer());
    const z = zipEntries(buf);
    const ssXml = await inflateEntry(z["xl/sharedStrings.xml"]);
    const strings = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(x => x[1].replace(/<[^>]+>/g, ""));
    const wb = await inflateEntry(z["xl/workbook.xml"]);
    const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(x => x[1]);
    const dataIdx = sheets.indexOf("DATA");
    const entry = z[`xl/worksheets/sheet${dataIdx + 1}.xml`];
    if (dataIdx < 0 || !entry) throw new Error("DATA sheet not found");
    // ≈60 KB of sheet XML per trading day: 12.5 MB reaches back ≈6½ months.
    const tail = await inflateEntry(entry, { tailBytes: 12_500_000 });
    const s = summariseMpt(parseMptRows(tail.slice(tail.indexOf("<row ")), strings));
    if (!s.windows?.length) throw new Error("no rows parsed");
    return { paths: { fed: s }, errors: {} };
  } catch (e) {
    return { paths: {}, errors: Object.fromEntries(ids.map(id => [id, e.message])) };
  }
}

// ─── Sina Finance: China commodity futures, daily bars ──────────────────────
// Continuous main contract (e.g. RB0 = SHFE rebar). Unofficial endpoint used by
// open-source tools such as akshare; exchange prices, but the roll between
// contracts can show as a jump. Response is JSONP: var _RB0=([{d,o,h,l,c,...}]).
// Domestic bars use { d, c }; global ones { date, close }.
export function parseSinaKline(text) {
  const m = String(text).match(/\(\s*(\[[\s\S]*\])\s*\)/);
  if (!m) throw new Error("unexpected Sina response");
  return asSeries(JSON.parse(m[1]).map(r => [r.d ?? r.date, num(r.c ?? r.close)]));
}

async function fetchSina(ids, { signal, start }) {
  const res = await settleLimit(ids, 4, async sym => {
    const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${sym}=/InnerFuturesNewService.getDailyKLine?symbol=${sym}`;
    const s = parseSinaKline(await (await get(url, { signal, ua: BROWSER_UA, headers: { Referer: "https://finance.sina.com.cn/" } })).text());
    return asSeries(s.points.filter(p => p[0] >= start));
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── Sina Finance: global futures, daily bars ───────────────────────────────
// The same host as above, global contracts (COMEX, NYMEX, ICE, CBOT, LME):
// GC gold, SI silver, HG copper (¢/lb), CL WTI, OIL Brent, NG Henry Hub, HO
// heating oil, AHD LME aluminium 3M, W/C/S wheat/corn/soybeans, KC coffee, CC
// cocoa. A second, independent route for the Yahoo futures tiles; Sina's
// continuous contract may sit on a different month from Yahoo's front month,
// so a fallback level can differ by the calendar spread (the tile marks it *).
// Checked from the build sandbox on 23 Nov 2026: these symbols returned bars
// dated that day; SB, RB, LC and RR returned stale or no data, so not used.
async function fetchSinaGlobal(ids, { signal, start }) {
  const res = await settleLimit(ids, 4, async sym => {
    const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${sym}=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=${sym}&source=web`;
    const s = parseSinaKline(await (await get(url, { signal, ua: BROWSER_UA, headers: { Referer: "https://finance.sina.com.cn/" } })).text());
    const pts = s.points.filter(p => p[0] >= start);
    // A contract Sina stopped updating would otherwise pass for a current price.
    if (!pts.length || Date.now() - Date.parse(`${pts[pts.length - 1][0]}T00:00:00Z`) > 10 * DAY) throw new Error("stale — no bar in the last 10 days");
    return asSeries(pts);
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── Sina Finance: US shares, ETFs and indices, daily bars ──────────────────
// Same host again: .INX = S&P 500, .IXIC = Nasdaq Composite, plus listed
// tickers (HYG, ORCL, CRWV, RSP, SPY, MP, REMX). Bars are {d,o,h,l,c,v} from
// listing day, so only the requested window is kept. The fallback for the
// Yahoo-only equity rows; checked from the build sandbox on 23 Nov 2026.
async function fetchSinaUs(ids, { signal, start }) {
  const res = await settleLimit(ids, 4, async sym => {
    const url = `https://stock2.finance.sina.com.cn/usstock/api/jsonp.php/var%20_X=/US_MinKService.getDailyK?symbol=${encodeURIComponent(sym)}`;
    const s = parseSinaKline(await (await get(url, { signal, ua: BROWSER_UA, headers: { Referer: "https://finance.sina.com.cn/" }, timeoutMs: 12000 })).text());
    const pts = s.points.filter(p => p[0] >= start);
    if (!pts.length || Date.now() - Date.parse(`${pts[pts.length - 1][0]}T00:00:00Z`) > 10 * DAY) throw new Error("stale — no bar in the last 10 days");
    return asSeries(pts);
  });
  const series = {}, errors = {};
  ids.forEach((id, i) => { if (res[i].ok) series[id] = res[i].value; else errors[id] = res[i].error; });
  return { series, errors };
}

// ─── ECB euro reference rates → any cross, and the dollar index ─────────────
// One request for every currency needed. ids are "BASEQUOTE" (units of QUOTE
// per 1 BASE, e.g. "SGDMYR", "USDJPY", "EURUSD") or "DXY". Each cross is the
// ratio of two ECB rates on the same day (the 14:15 CET fix), so it is a daily
// official fix, not a live market price. DXY uses ICE's published formula:
// 50.14348112 × EURUSD^−0.576 × USDJPY^0.136 × GBPUSD^−0.119 × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036.
export const ECB_CCY = new Set(["USD", "JPY", "BGN", "CZK", "DKK", "GBP", "HUF", "PLN", "RON", "SEK", "CHF", "ISK", "NOK", "TRY",
  "AUD", "BRL", "CAD", "CNY", "HKD", "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR"]);
const DXY_LEGS = [["EUR", "USD", -0.576], ["USD", "JPY", 0.136], ["GBP", "USD", -0.119], ["USD", "CAD", 0.091], ["USD", "SEK", 0.042], ["USD", "CHF", 0.036]];
const pairsOf = id => (id === "DXY" ? DXY_LEGS.map(([a, b]) => [a, b]) : [[id.slice(0, 3), id.slice(3, 6)]]);

export function parseEcbExr(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  const ci = head.indexOf("CURRENCY"), ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ci < 0 || ti < 0 || vi < 0) throw new Error("unexpected ECB format");
  const byCcy = {};
  for (const l of lines.slice(1)) {
    const c = splitCsvLine(l);
    const v = num(c[vi]);
    if (v !== null && /^\d{4}-\d{2}-\d{2}$/.test(c[ti])) (byCcy[c[ci]] ||= new Map()).set(c[ti], v);
  }
  return byCcy;
}

export function ecbCrosses(byCcy, ids) {
  const rate = (ccy, d) => (ccy === "EUR" ? 1 : byCcy[ccy]?.get(d) ?? null);
  const cross = (a, b, d) => { const x = rate(a, d), y = rate(b, d); return x && y ? y / x : null; };
  const dates = [...new Set(Object.values(byCcy).flatMap(m => [...m.keys()]))].sort();
  const series = {}, errors = {};
  for (const id of ids) {
    const miss = [...new Set(pairsOf(id).flat())].filter(c => c !== "EUR" && !byCcy[c]);
    if (miss.length) { errors[id] = `ECB has no ${miss.join(", ")} rate`; continue; }
    const pts = dates.map(d => {
      if (id !== "DXY") return [d, cross(id.slice(0, 3), id.slice(3, 6), d)];
      let v = 50.14348112;
      for (const [a, b, w] of DXY_LEGS) { const x = cross(a, b, d); if (x === null) return [d, null]; v *= Math.pow(x, w); }
      return [d, v];
    }).filter(p => p[1] !== null);
    if (pts.length) series[id] = asSeries(pts); else errors[id] = "no overlapping dates";
  }
  return { series, errors };
}

async function fetchEcbFx(ids, { signal, start }) {
  const ccys = [...new Set(ids.flatMap(id => pairsOf(id).flat()))].filter(c => c !== "EUR" && ECB_CCY.has(c)).sort();
  try {
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${ccys.join("+")}.EUR.SP00.A?format=csvdata&detail=dataonly&startPeriod=${start}`;
    return ecbCrosses(parseEcbExr(await (await get(url, { signal, timeoutMs: 15000 })).text()), ids);
  } catch (e) {
    return { series: {}, errors: Object.fromEntries(ids.map(id => [id, e.message])) };
  }
}

// ─── BIS central bank policy rates (WS_CBPOL) ───────────────────────────────
// One request for every bank: daily policy rates compiled by the Bank for
// International Settlements from each central bank (PRIMARY, updated weekly).
// ids are ISO country codes (CA, NZ, AU, GB, BR, KR, NO, SE, CH). The response
// is SDMX-CSV; columns are found by their SDMX ids (REF_AREA, TIME_PERIOD,
// OBS_VALUE) so either API version's layout parses. Not reachable from the
// build sandbox, so the layout is the SDMX standard's, unverified against a
// live response: if BIS answers in another shape, every id reports an error
// in Source health rather than a wrong number.
export function parseBisCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const head = splitCsvLine(lines[0] || "").map(h => h.trim().split(":")[0].replace(/^"|"$/g, ""));
  const ai = head.indexOf("REF_AREA"), ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ai < 0 || ti < 0 || vi < 0) throw new Error("unexpected BIS format");
  const by = {};
  for (const l of lines.slice(1)) {
    const c = splitCsvLine(l);
    const area = (c[ai] || "").split(":")[0].trim();
    const t = (c[ti] || "").trim();
    if (!area || !/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    (by[area] ||= []).push([t, num(c[vi])]);
  }
  return Object.fromEntries(Object.entries(by).map(([k, pts]) => [k, asSeries(pts)]));
}

async function fetchBis(ids, { signal, start }) {
  const key = `D.${ids.join("+")}`;
  const csv = "application/vnd.sdmx.data+csv;version=1.0.0";
  const tries = [
    [`https://stats.bis.org/api/v1/data/WS_CBPOL/${key}/all?startPeriod=${start}&format=csv`, "text/csv"],
    [`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/${key}?startPeriod=${start}&format=csv`, "text/csv"],
    [`https://stats.bis.org/api/v1/data/WS_CBPOL/${key}/all?startPeriod=${start}`, csv],
  ];
  let lastErr = null;
  for (const [url, accept] of tries) {
    try {
      const all = parseBisCsv(await (await get(url, { signal, timeoutMs: 10000, headers: { Accept: accept } })).text());
      const series = {}, errors = {};
      ids.forEach(id => { if (all[id]?.points?.length) series[id] = all[id]; else errors[id] = "not in BIS response"; });
      if (Object.keys(series).length) return { series, errors };
      lastErr = new Error("no rows parsed");
    } catch (e) { lastErr = e; }
  }
  return { series: {}, errors: Object.fromEntries(ids.map(id => [id, lastErr?.message || "BIS failed"])) };
}

// ─── Router ─────────────────────────────────────────────────────────────────
const ADAPTERS = {
  treasury: { fetch: fetchTreasury, tier: "PRIMARY",              ttl: 1800, max: 12, re: /^[nr]\d{1,2}[my]$/ },
  fred:     { fetch: fetchFred,     tier: "PRIMARY",              ttl: 3600, max: 40, re: /^[A-Z0-9]{2,24}$/ },
  ecb:      { fetch: fetchEcb,      tier: "PRIMARY",              ttl: 3600, max: 12, re: /^[A-Z0-9_]{2,12}\/[A-Za-z0-9_.+]{3,80}$/ },
  bbk:      { fetch: fetchBbk,      tier: "PRIMARY",              ttl: 3600, max: 4,  re: /^[A-Za-z0-9_.]{10,80}$/ },
  mof:      { fetch: fetchMof,      tier: "PRIMARY",              ttl: 3600, max: 6,  re: /^\d{1,2}Y$/ },
  yahoo:    { fetch: fetchYahoo,    tier: "SECONDARY-reliable",   ttl: 300,  max: 100, re: /^[A-Za-z0-9^=.-]{1,15}$/ },
  cbw:      { fetch: fetchCbw,      tier: "SECONDARY-unverified", ttl: 1800, max: 7,  re: /^(fed|ecb|boj|boe|rba|rbnz|snb)$/ },
  bls:      { fetch: fetchBls,      tier: "PRIMARY",              ttl: 21600, max: 100, re: /^(CU[SU]R0000[A-Z0-9]{2,8}|WP[SU][A-Z0-9]{2,10}|APU0000[A-Z0-9]{4,8}|PCU[A-Z0-9-]{4,16})$/ },
  eurostat: { fetch: fetchEurostat, tier: "PRIMARY",              ttl: 21600, max: 30, re: /^[A-Z0-9_]{2,6}:[A-Z0-9_]{2,24}:[A-Z0-9_]{2,16}$/ },
  gie:      { fetch: fetchGie,      tier: "PRIMARY",              ttl: 21600, max: 2,  re: /^eu(:avg5)?$/ },
  fao:      { fetch: fetchFao,      tier: "PRIMARY",              ttl: 43200, max: 6,  re: /^(ffpi|meat|dairy|cereals|oils|sugar)$/ },
  mpt:      { fetch: fetchMpt,      tier: "PRIMARY",              ttl: 21600, max: 1,  re: /^fed$/ },
  sina:     { fetch: fetchSina,     tier: "SECONDARY-unverified", ttl: 3600,  max: 8,  re: /^[A-Z]{1,3}0$/ },
  sinag:    { fetch: fetchSinaGlobal, tier: "SECONDARY-unverified", ttl: 900, max: 20, re: /^[A-Z]{1,4}$/ },
  sinaus:   { fetch: fetchSinaUs,   tier: "SECONDARY-unverified", ttl: 900,  max: 12, re: /^\.?[A-Z]{1,5}$/ },
  ecbfx:    { fetch: fetchEcbFx,    tier: "PRIMARY",              ttl: 3600, max: 60, re: /^([A-Z]{6}|DXY)$/ },
  bis:      { fetch: fetchBis,      tier: "PRIMARY",              ttl: 21600, max: 20, re: /^[A-Z]{2}$/ },
};

// Server-side use (the scheduled alert check): run one source directly, with
// the same validation as the HTTP endpoint.
export async function fetchSourceDirect(src, ids, start, signal) {
  const ad = ADAPTERS[src];
  if (!ad) throw new Error(`unknown src "${src}"`);
  const ok = [...new Set(ids)].filter(s => ad.re.test(s)).slice(0, ad.max);
  const out = await ad.fetch(ok, { signal, start: start || isoDay(Date.now() - 400 * DAY) });
  return { src, tier: ad.tier, fetchedAt: Date.now(), ...out };
}

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
