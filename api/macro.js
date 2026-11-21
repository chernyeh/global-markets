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
//   bls       BLS API v2 — CPI items, PPI, average prices (BLS_API_KEY) PRIMARY
//   eurostat  Eurostat HICP, ECOICOP ver.2 (prc_hicp_minr)              PRIMARY, no key
//   gie       GIE AGSI+ EU gas storage (GIE_API_KEY optional)          PRIMARY
//   fao       FAO Food Price Index (monthly CSV)                       PRIMARY, no key

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

async function get(url, { signal, ua = BOT_UA, headers = {}, timeoutMs = 9000, method = "GET", body } = {}) {
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

// ─── Router ─────────────────────────────────────────────────────────────────
const ADAPTERS = {
  treasury: { fetch: fetchTreasury, tier: "PRIMARY",              ttl: 1800, max: 12, re: /^[nr]\d{1,2}[my]$/ },
  fred:     { fetch: fetchFred,     tier: "PRIMARY",              ttl: 3600, max: 40, re: /^[A-Z0-9]{2,24}$/ },
  ecb:      { fetch: fetchEcb,      tier: "PRIMARY",              ttl: 3600, max: 12, re: /^[A-Z0-9_]{2,12}\/[A-Za-z0-9_.+]{3,80}$/ },
  bbk:      { fetch: fetchBbk,      tier: "PRIMARY",              ttl: 3600, max: 4,  re: /^[A-Za-z0-9_.]{10,80}$/ },
  mof:      { fetch: fetchMof,      tier: "PRIMARY",              ttl: 3600, max: 6,  re: /^\d{1,2}Y$/ },
  yahoo:    { fetch: fetchYahoo,    tier: "SECONDARY-reliable",   ttl: 300,  max: 60, re: /^[A-Za-z0-9^=.-]{1,15}$/ },
  cbw:      { fetch: fetchCbw,      tier: "SECONDARY-unverified", ttl: 1800, max: 2,  re: /^(fed|ecb)$/ },
  bls:      { fetch: fetchBls,      tier: "PRIMARY",              ttl: 21600, max: 100, re: /^(CU[SU]R0000[A-Z0-9]{2,8}|WP[SU][A-Z0-9]{2,10}|APU0000[A-Z0-9]{4,8}|PCU[A-Z0-9-]{4,16})$/ },
  eurostat: { fetch: fetchEurostat, tier: "PRIMARY",              ttl: 21600, max: 30, re: /^[A-Z0-9_]{2,6}:[A-Z0-9_]{2,24}:[A-Z0-9_]{2,16}$/ },
  gie:      { fetch: fetchGie,      tier: "PRIMARY",              ttl: 21600, max: 2,  re: /^eu(:avg5)?$/ },
  fao:      { fetch: fetchFao,      tier: "PRIMARY",              ttl: 43200, max: 6,  re: /^(ffpi|meat|dairy|cereals|oils|sugar)$/ },
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
