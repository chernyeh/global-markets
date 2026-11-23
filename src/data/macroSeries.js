// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — indicator registry (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════
// Every number on the Macro tab is defined here. Each entry lists its sources in
// order of preference as [source, key] pairs; the first one that returns data is
// shown, and the tile says which one it was. Fallbacks are only listed where the
// instrument is the same or near-identical (e.g. Brent futures → Brent spot), so
// a fallback never changes what the threshold means.
//
// Fields
//   label, group        display name; panel the row/tile sits in
//   unit                "%" yield/rate · "bp" spread · "$" price in USD · "px" price
//                       in another unit · "fx" exchange rate · "idx" index level · "x" ratio
//   dp                  decimals shown
//   chg                 how changes are shown: "bp" (for % series) or "pct"
//   scale               multiply raw values (FRED OAS are in percent → ×100 = bp)
//   freq                "D" daily (default), "M" monthly, or "L" daily with ≈4 years of
//                       history (policy rates: the move before the last one can be years back)
//   thr                 reference lines [{ v, label }] drawn on the sparkline
//   move                daily-move alert threshold (in the `chg` unit); upOnly for VIX
//   derived             { op:"sub"|"div", a, b, scale } — computed from two entries
//   note                shown on hover
//   src                 [[source, key, { scale }?], …] — a per-source scale converts a
//                       fallback's unit (Sina's copper is in ¢/lb, the tile in $/lb)
//
// Source keys: see api/macro.js for what each source is and how it is fetched.

const MONTH_CODES = "FGHJKMNQUVXZ";

// Yahoo's dated-contract ticker for the Brent future `ahead` months after the
// front contract. Brent's front month is two months out until expiry at the end
// of the month. Unverified on Yahoo from the build sandbox (Yahoo blocks it);
// if the ticker is wrong the curve reads "unavailable" and signal 7 says so.
export function brentContractTicker(ahead, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2 + ahead, 1));
  return `BZ${MONTH_CODES[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(-2)}.NYM`;
}

export const SOURCE_META = {
  treasury: { label: "US Treasury",          short: "UST",   tier: "PRIMARY",              url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
  fred:     { label: "FRED (St. Louis Fed)", short: "FRED",  tier: "PRIMARY",              url: "https://fred.stlouisfed.org/", key: "FRED_API_KEY" },
  ecb:      { label: "ECB Data Portal",      short: "ECB",   tier: "PRIMARY",              url: "https://data.ecb.europa.eu/" },
  bls:      { label: "BLS",                  short: "BLS",   tier: "PRIMARY",              url: "https://www.bls.gov/data/", key: "BLS_API_KEY" },
  eurostat: { label: "Eurostat",             short: "ESTAT", tier: "PRIMARY",              url: "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table" },
  gie:      { label: "GIE AGSI+",            short: "GIE",   tier: "PRIMARY",              url: "https://agsi.gie.eu/" },
  sina:     { label: "Sina Finance (SHFE/DCE)", short: "Sina", tier: "SECONDARY-unverified", url: "https://finance.sina.com.cn/futuremarket/" },
  fao:      { label: "FAO",                  short: "FAO",   tier: "PRIMARY",              url: "https://www.fao.org/worldfoodsituation/foodpricesindex/en/" },
  bbk:      { label: "Bundesbank",           short: "BBk",   tier: "PRIMARY",              url: "https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields" },
  mof:      { label: "Japan MoF",            short: "MoF",   tier: "PRIMARY",              url: "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/" },
  yahoo:    { label: "Yahoo Finance",        short: "Yahoo", tier: "SECONDARY-reliable",   url: "https://finance.yahoo.com/" },
  cbw:      { label: "Central Bank Watch",   short: "CBW",   tier: "SECONDARY-unverified", url: "https://centralbank.watch/" },
  sinag:    { label: "Sina Finance (global futures)", short: "Sina gl", tag: "Sina", tier: "SECONDARY-unverified", url: "https://finance.sina.com.cn/futuremarket/" },
  sinaus:   { label: "Sina Finance (US stocks)", short: "Sina US", tag: "Sina", tier: "SECONDARY-unverified", url: "https://finance.sina.com.cn/stock/usstock/" },
  ecbfx:    { label: "ECB reference rates (crosses)", short: "ECB fx", tag: "ECB", tier: "PRIMARY", url: "https://data.ecb.europa.eu/data/datasets/EXR" },
  bis:      { label: "BIS policy rates",     short: "BIS",   tier: "PRIMARY",              url: "https://data.bis.org/topics/CBPOL" },
};

import { breadthRegistry } from "./macroInflation.js";

const BUND_10Y = "D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A";

// SGD/xxx rows: [quote currency, decimals, note?, only: "yahoo" | "ecb"].
function sgdCrosses(list) {
  return Object.fromEntries(list.map(([q, dp, note, only]) => [`sgd${q.toLowerCase()}`, {
    group: "fx", label: `SGD/${q}`, unit: "fx", dp, chg: "pct",
    src: [only !== "ecb" && ["yahoo", `SGD${q}=X`], only !== "yahoo" && ["ecbfx", `SGD${q}`]].filter(Boolean),
    ...(note ? { note } : {}),
  }]));
}
const SGD_CROSS_IDS = ["usd", "eur", "gbp", "jpy", "cny", "hkd", "aud", "myr", "thb", "idr", "php", "inr", "krw", "twd"].map(q => `sgd${q}`);
const ECB_10Y = c => `IRS/M.${c}.L.L40.CI.0000.EUR.N.Z`;

export const MACRO_SERIES = {
  // ── Rates ────────────────────────────────────────────────────────────────
  ust3m:  { group: "rates", label: "UST 3m",  unit: "%", dp: 2, chg: "bp", src: [["treasury", "n3m"], ["fred", "DGS3MO"]] },
  ust2y:  { group: "rates", label: "UST 2y",  unit: "%", dp: 2, chg: "bp", move: 12, src: [["treasury", "n2y"], ["fred", "DGS2"]] },
  ust10y: { group: "rates", label: "UST 10y", unit: "%", dp: 2, chg: "bp", move: 10, src: [["treasury", "n10y"], ["fred", "DGS10"]],
            thr: [{ v: 5.36, label: "7 Oct high 5.36" }] },
  ust30y: { group: "rates", label: "UST 30y", unit: "%", dp: 2, chg: "bp", src: [["treasury", "n30y"], ["fred", "DGS30"]] },
  c2s10s: { group: "rates", label: "2s10s curve", unit: "bp", dp: 0, chg: "bp", derived: { op: "sub", a: "ust10y", b: "ust2y", scale: 100 },
            note: "10y minus 2y par yield. Positive = upward-sloping (no recession priced)." },
  real10y:{ group: "rates", label: "10y real (TIPS)", unit: "%", dp: 2, chg: "bp", src: [["treasury", "r10y"], ["fred", "DFII10"]],
            thr: [{ v: 3.15, label: "record 3.15 (Nov 2008)" }] },
  bei10y: { group: "rates", label: "10y breakeven", unit: "%", dp: 2, chg: "bp", derived: { op: "sub", a: "ust10y", b: "real10y" },
            thr: [{ v: 2.5, label: "2.5 credibility line" }],
            note: "Nominal minus real 10y par yield (Treasury). Close to, but not identical with, FRED's T10YIE." },
  infl5y5:{ group: "rates", label: "5y5y inflation", unit: "%", dp: 2, chg: "bp", src: [["fred", "T5YIFR"]] },
  tp10y:  { group: "rates", label: "Term premium (Fed Board)", unit: "%", dp: 2, chg: "bp", src: [["fred", "THREEFYTP10"]],
            thr: [{ v: 0.8, label: "0.8 peak-confirmed line" }],
            note: "Kim-Wright 10y term premium, Federal Reserve Board model, via FRED. Published with a lag." },
  impl10y:{ group: "rates", label: "Implied avg policy rate", unit: "%", dp: 2, chg: "bp", derived: { op: "sub", a: "ust10y", b: "tp10y" },
            note: "10y yield minus term premium: the average policy rate the market expects over ten years (arithmetic)." },
  bund10: { group: "rates", label: "Bund 10y", unit: "%", dp: 2, chg: "bp", src: [["bbk", BUND_10Y]],
            note: "Bundesbank daily yield on listed Federal securities, 10-year residual maturity." },
  oatBund:{ group: "rates", label: "OAT–Bund (monthly)", unit: "bp", dp: 0, chg: "bp", freq: "M",
            derived: { op: "sub", a: "oat10m", b: "bund10m", scale: 100 },
            thr: [{ v: 100, label: "100 add-risk" }, { v: 200, label: "200 defence" }],
            note: "Monthly average 10y yields (ECB convergence series). Paste a daily spread on the Signals board to override." },
  btpBund:{ group: "rates", label: "BTP–Bund (monthly)", unit: "bp", dp: 0, chg: "bp", freq: "M", derived: { op: "sub", a: "btp10m", b: "bund10m", scale: 100 } },
  jgb10:  { group: "rates", label: "JGB 10y", unit: "%", dp: 3, chg: "bp", src: [["mof", "10Y"]], thr: [{ v: 3, label: "3.0" }] },
  jgb2:   { group: "policy", label: "JGB 2y", unit: "%", dp: 3, chg: "bp", src: [["mof", "2Y"]] },
  // inputs for the monthly spreads (not shown on their own)
  oat10m: { hidden: true, unit: "%", dp: 2, freq: "M", src: [["ecb", ECB_10Y("FR")]] },
  bund10m:{ hidden: true, unit: "%", dp: 2, freq: "M", src: [["ecb", ECB_10Y("DE")]] },
  btp10m: { hidden: true, unit: "%", dp: 2, freq: "M", src: [["ecb", ECB_10Y("IT")]] },

  // ── Policy rates ─────────────────────────────────────────────────────────
  ffLo:   { group: "policy", label: "Fed funds target, lower", unit: "%", dp: 2, src: [["fred", "DFEDTARL"]] },
  ffHi:   { group: "policy", label: "Fed funds target, upper", unit: "%", dp: 2, src: [["fred", "DFEDTARU"]] },
  effr:   { group: "policy", label: "EFFR", unit: "%", dp: 2, src: [["fred", "EFFR"]] },
  dfr:    { group: "policy", label: "ECB deposit rate", unit: "%", dp: 2, src: [["ecb", "FM/D.U2.EUR.4F.KR.DFR.LEV"], ["fred", "ECBDFR"]] },
  estr:   { group: "policy", label: "€STR", unit: "%", dp: 3, src: [["ecb", "EST/B.EU000A2X2A25.WT"]] },
  // Market-implied euro short rates from the ECB's own AAA government yield curve
  // (instantaneous forwards, daily, PRIMARY). Not OIS: the level carries a small
  // term premium and AAA-vs-€STR basis, so read the changes, not the level.
  ezFwd6m:{ group: "policy", label: "Euro rate 6m ahead", unit: "%", dp: 2, chg: "bp", src: [["ecb", "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.IF_6M"]] },
  ezFwd1y:{ group: "policy", label: "Euro rate 1y ahead", unit: "%", dp: 2, chg: "bp", src: [["ecb", "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.IF_1Y"]] },
  ezFwd2y:{ group: "policy", label: "Euro rate 2y ahead", unit: "%", dp: 2, chg: "bp", src: [["ecb", "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.IF_2Y"]] },

  // ── US inflation (BLS first; FRED carries the same data as a fallback) ───
  // SA indices for m/m and 3-month annualised; NSA for y/y, as BLS publishes.
  coreCpi:  { group: "inflation", label: "Core CPI (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SA0L1E"], ["fred", "CPILFESL"]] },
  cpi:      { group: "inflation", label: "CPI (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SA0"], ["fred", "CPIAUCSL"]] },
  cpiNsa:   { group: "inflation", label: "CPI (NSA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUUR0000SA0"], ["fred", "CPIAUCNS"]] },
  coreNsa:  { group: "inflation", label: "Core CPI (NSA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUUR0000SA0L1E"], ["fred", "CPILFENS"]] },
  coreGoods:{ group: "inflation", label: "Core goods (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SACL1E"], ["fred", "CUSR0000SACL1E"]] },
  coreServ: { group: "inflation", label: "Core services (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SASLE"], ["fred", "CUSR0000SASLE"]] },
  superCore:{ group: "inflation", label: "Services less rent of shelter (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SASL2RS"], ["fred", "CUSR0000SASL2RS"]] },
  shelter:  { group: "inflation", label: "Shelter (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUSR0000SAH1"], ["fred", "CUSR0000SAH1"]] },
  foodAway: { group: "inflation", label: "Food away from home (NSA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "CUUR0000SEFV"], ["fred", "CUUR0000SEFV"]] },
  corePce:  { group: "inflation", label: "Core PCE index", unit: "idx", dp: 3, freq: "M", src: [["fred", "PCEPILFE"]] },
  pceSuper: { group: "inflation", label: "PCE services ex energy & housing", unit: "idx", dp: 3, freq: "M", src: [["fred", "IA001260M"]] },
  medCpi:   { group: "inflation", label: "Median CPI", unit: "%", dp: 1, freq: "M", src: [["fred", "MEDCPIM158SFRBCLE"]] },
  trimCpi:  { group: "inflation", label: "Trimmed-mean CPI", unit: "%", dp: 1, freq: "M", src: [["fred", "TRMMEANCPIM158SFRBCLE"]] },
  stickyCore:{ group: "inflation", label: "Sticky core CPI y/y", unit: "%", dp: 1, freq: "M", src: [["fred", "CORESTICKM159SFRBATL"]] },
  trimPce:  { group: "inflation", label: "Trimmed-mean PCE 12m", unit: "%", dp: 1, freq: "M", src: [["fred", "PCETRIM12M159SFRBDAL"]] },
  ppiFd:    { group: "inflation", label: "PPI final demand (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "WPSFD4"], ["fred", "PPIFIS"]] },
  ppiCore:  { group: "inflation", label: "PPI ex food, energy, trade (SA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "WPSFD49116"], ["fred", "WPSFD49116"]] },
  ppiCoreNsa:{ group: "inflation", label: "PPI ex food, energy, trade (NSA)", unit: "idx", dp: 3, freq: "M", src: [["bls", "WPUFD49116"], ["fred", "WPUFD49116"]] },
  diesel:   { group: "inflation", label: "Diesel PPI", unit: "idx", dp: 3, freq: "M", src: [["bls", "WPU057303"], ["fred", "WPU057303"]] },
  trucking: { group: "inflation", label: "Truck freight PPI", unit: "idx", dp: 3, freq: "M", src: [["bls", "WPU3012"], ["fred", "WPU3012"]] },
  gasAvg:   { group: "inflation", label: "US gasoline, avg price $/gal", unit: "$", dp: 3, freq: "M", src: [["bls", "APU000074714"], ["fred", "APU000074714"]],
              note: "BLS average retail price, unleaded regular — the price CPI collects. Base for the base-effect projector." },
  gasWeekly:{ group: "inflation", label: "US gasoline, weekly $/gal", unit: "$", dp: 3, src: [["fred", "GASREGW"]], note: "EIA weekly retail price via FRED." },
  ...breadthRegistry(),

  // ── Euro-area HICP (Eurostat, ECOICOP ver.2) ─────────────────────────────
  ezHicp:   { group: "euro", label: "HICP", unit: "%", dp: 1, freq: "M", chg: "bp", src: [["eurostat", "EA:TOTAL:RCH_A"]] },
  ezCore:   { group: "euro", label: "Core HICP", unit: "%", dp: 1, freq: "M", chg: "bp", src: [["eurostat", "EA:TOT_X_NRG_FOOD:RCH_A"]] },
  ezCoreMom:{ group: "euro", label: "Core HICP m/m", unit: "%", dp: 1, freq: "M", src: [["eurostat", "EA:TOT_X_NRG_FOOD:RCH_M"]] },
  ezServ:   { group: "euro", label: "Services", unit: "%", dp: 1, freq: "M", src: [["eurostat", "EA:SERV:RCH_A"]] },
  ezNeig:   { group: "euro", label: "Non-energy industrial goods", unit: "%", dp: 1, freq: "M", src: [["eurostat", "EA:IGD_NNRG:RCH_A"]] },
  ezEnergy: { group: "euro", label: "Energy", unit: "%", dp: 1, freq: "M", src: [["eurostat", "EA:NRG:RCH_A"]] },
  ezFood:   { group: "euro", label: "Food, alcohol & tobacco", unit: "%", dp: 1, freq: "M", src: [["eurostat", "EA:FOOD:RCH_A"]] },
  deHicp:   { group: "euro", label: "Germany", unit: "%", dp: 1, freq: "M", src: [["eurostat", "DE:TOTAL:RCH_A"]] },
  frHicp:   { group: "euro", label: "France", unit: "%", dp: 1, freq: "M", src: [["eurostat", "FR:TOTAL:RCH_A"]] },
  itHicp:   { group: "euro", label: "Italy", unit: "%", dp: 1, freq: "M", src: [["eurostat", "IT:TOTAL:RCH_A"]] },
  esHicp:   { group: "euro", label: "Spain", unit: "%", dp: 1, freq: "M", src: [["eurostat", "ES:TOTAL:RCH_A"]] },

  // ── Credit & stress ──────────────────────────────────────────────────────
  hyOas:  { group: "credit", label: "HY OAS", unit: "bp", dp: 0, chg: "bp", scale: 100, move: 25, src: [["fred", "BAMLH0A0HYM2"]],
            note: "ICE BofA US High Yield option-adjusted spread, via FRED." },
  igOas:  { group: "credit", label: "IG OAS", unit: "bp", dp: 0, chg: "bp", scale: 100, src: [["fred", "BAMLC0A0CM"]],
            note: "ICE BofA US Corporate (investment grade) OAS — includes hyperscaler and bank bonds." },
  cccOas: { group: "credit", label: "CCC OAS", unit: "bp", dp: 0, chg: "bp", scale: 100, src: [["fred", "BAMLH0A3HYC"]] },
  stlfsi: { group: "credit", label: "St. Louis stress index", unit: "x", dp: 2, chg: "abs", src: [["fred", "STLFSI4"]],
            note: "Weekly. Zero = normal financial-market stress." },
  vix:    { group: "credit", label: "VIX", unit: "x", dp: 1, chg: "pct", move: 15, upOnly: true, src: [["yahoo", "^VIX"], ["fred", "VIXCLS"]] },
  moveIx: { group: "credit", label: "MOVE (bond vol)", unit: "x", dp: 1, chg: "pct", src: [["yahoo", "^MOVE"]] },
  hyg:    { group: "credit", label: "HYG (HY ETF)", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "HYG"], ["sinaus", "HYG"]] },
  crwv:   { group: "credit", label: "CoreWeave shares", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "CRWV"], ["sinaus", "CRWV"]],
            note: "Equity proxy for neocloud credit stress; CoreWeave bond and CDS prices have no free feed." },
  orcl:   { group: "credit", label: "Oracle shares", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "ORCL"], ["sinaus", "ORCL"]] },

  // ── Equities & breadth ───────────────────────────────────────────────────
  spx:    { group: "equity", label: "S&P 500", unit: "idx", dp: 0, chg: "pct", move: 2, src: [["yahoo", "^GSPC"], ["sinaus", ".INX"], ["fred", "SP500"]] },
  ndq:    { group: "equity", label: "Nasdaq Comp.", unit: "idx", dp: 0, chg: "pct", src: [["yahoo", "^IXIC"], ["sinaus", ".IXIC"], ["fred", "NASDAQCOM"]] },
  rut:    { group: "equity", label: "Russell 2000", unit: "idx", dp: 0, chg: "pct", src: [["yahoo", "^RUT"]] },
  rsp:    { hidden: true, unit: "$", dp: 2, src: [["yahoo", "RSP"], ["sinaus", "RSP"]] },
  spy:    { hidden: true, unit: "$", dp: 2, src: [["yahoo", "SPY"], ["sinaus", "SPY"]] },
  ewRatio:{ group: "equity", label: "Equal- vs cap-weight", unit: "x", dp: 4, chg: "pct", derived: { op: "div", a: "rsp", b: "spy", sameSrc: true },
            note: "RSP ÷ SPY. Rising = breadth improving (equal-weight beating the cap-weighted index)." },

  // ── FX ───────────────────────────────────────────────────────────────────
  // Fallbacks: ECB reference rates (PRIMARY, daily 14:15 CET fix; crosses are the
  // ratio of two ECB rates) ahead of FRED's H.10 rates, which arrive a week late.
  dxy:    { group: "fx", label: "DXY", unit: "fx", dp: 2, chg: "pct", src: [["yahoo", "DX-Y.NYB"], ["ecbfx", "DXY"]],
            note: "Fallback rebuilt from the ECB's daily fixes with ICE's published DXY formula (six currencies, 57.6% euro) — the same index at a different time of day." },
  eurusd: { group: "fx", label: "EUR/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "EURUSD=X"], ["ecbfx", "EURUSD"], ["fred", "DEXUSEU"]] },
  usdjpy: { group: "fx", label: "USD/JPY", unit: "fx", dp: 2, chg: "pct", move: 1, src: [["yahoo", "JPY=X"], ["ecbfx", "USDJPY"], ["fred", "DEXJPUS"]] },
  usdsgd: { group: "fx", label: "USD/SGD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "SGD=X"], ["ecbfx", "USDSGD"], ["fred", "DEXSIUS"]],
            thr: [{ v: 1.25, label: "1.25 carry break-even" }],
            note: "Below ≈1.25 within a year, an unhedged USD T-bill loses its ≈2pp carry over SGD (playbook)." },
  usdcnh: { group: "fx", label: "USD/CNH", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "CNH=X"], ["ecbfx", "USDCNY"], ["fred", "DEXCHUS"]],
            note: "The ECB and FRED fallbacks are onshore CNY, not offshore CNH." },
  usdinr: { group: "fx", label: "USD/INR", unit: "fx", dp: 2, chg: "pct", src: [["yahoo", "INR=X"], ["ecbfx", "USDINR"], ["fred", "DEXINUS"]] },
  usdidr: { group: "fx", label: "USD/IDR", unit: "fx", dp: 0, chg: "pct", src: [["yahoo", "IDR=X"], ["ecbfx", "USDIDR"]] },
  usdthb: { group: "fx", label: "USD/THB", unit: "fx", dp: 3, chg: "pct", src: [["yahoo", "THB=X"], ["ecbfx", "USDTHB"], ["fred", "DEXTHUS"]] },
  audusd: { group: "fx", label: "AUD/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "AUDUSD=X"], ["ecbfx", "AUDUSD"], ["fred", "DEXUSAL"]] },
  usdnok: { group: "fx", label: "USD/NOK", unit: "fx", dp: 3, chg: "pct", src: [["yahoo", "NOK=X"], ["ecbfx", "USDNOK"], ["fred", "DEXNOUS"]] },

  // SGD crosses (behind a toggle): units of the second currency per 1 SGD. Yahoo
  // first; the ECB fix as fallback (no TWD at the ECB; Yahoo keeps no PHP history).
  ...sgdCrosses([
    ["USD", 4], ["EUR", 4], ["GBP", 4], ["JPY", 2], ["CNY", 4, "Onshore yuan (Yahoo keeps no SGD/CNH history)."], ["HKD", 3], ["AUD", 4],
    ["MYR", 4], ["THB", 3], ["IDR", 0], ["PHP", 3, null, "ecb"], ["INR", 3], ["KRW", 1], ["TWD", 3, null, "yahoo"],
  ]),

  // Currencies of the lead central banks (not shown as rows; read by that card).
  nzdusd: { hidden: true, label: "NZD/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "NZDUSD=X"], ["ecbfx", "NZDUSD"]] },
  usdcad: { hidden: true, label: "USD/CAD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "CAD=X"], ["ecbfx", "USDCAD"]] },
  gbpusd: { hidden: true, label: "GBP/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "GBPUSD=X"], ["ecbfx", "GBPUSD"]] },
  usdbrl: { hidden: true, label: "USD/BRL", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "BRL=X"], ["ecbfx", "USDBRL"]] },
  usdsek: { hidden: true, label: "USD/SEK", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "SEK=X"], ["ecbfx", "USDSEK"]] },
  usdchf: { hidden: true, label: "USD/CHF", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "CHF=X"], ["ecbfx", "USDCHF"]] },
  usdkrw: { hidden: true, label: "USD/KRW", unit: "fx", dp: 1, chg: "pct", src: [["yahoo", "KRW=X"], ["ecbfx", "USDKRW"]] },

  // ── Lead central banks: policy rates (BIS, PRIMARY) ──────────────────────
  // Read by the Lead central banks card and its alerts; not shown as rows.
  prNZ: { hidden: true, group: "lead", label: "RBNZ OCR", unit: "%", dp: 2, freq: "L", src: [["bis", "NZ"]] },
  prCA: { hidden: true, group: "lead", label: "BoC overnight target", unit: "%", dp: 2, freq: "L", src: [["bis", "CA"]] },
  prAU: { hidden: true, group: "lead", label: "RBA cash rate target", unit: "%", dp: 2, freq: "L", src: [["bis", "AU"]] },
  prGB: { hidden: true, group: "lead", label: "BoE Bank Rate", unit: "%", dp: 2, freq: "L", src: [["bis", "GB"], ["fred", "IUDSOIA"]],
          note: "Fallback: SONIA (FRED), which sits a few bp below Bank Rate and moves with it on decision days." },
  prBR: { hidden: true, group: "lead", label: "BCB Selic target", unit: "%", dp: 2, freq: "L", src: [["bis", "BR"]] },
  prNO: { hidden: true, group: "lead", label: "Norges Bank policy rate", unit: "%", dp: 2, freq: "L", src: [["bis", "NO"]] },
  prSE: { hidden: true, group: "lead", label: "Riksbank policy rate", unit: "%", dp: 2, freq: "L", src: [["bis", "SE"]] },
  prCH: { hidden: true, group: "lead", label: "SNB policy rate", unit: "%", dp: 2, freq: "L", src: [["bis", "CH"]] },
  prKR: { hidden: true, group: "lead", label: "Bank of Korea base rate", unit: "%", dp: 2, freq: "L", src: [["bis", "KR"]] },

  // ── Energy ───────────────────────────────────────────────────────────────
  brent:  { group: "energy", label: "Brent", unit: "$", dp: 2, chg: "pct", move: 3, src: [["yahoo", "BZ=F"], ["sinag", "OIL"], ["fred", "DCOILBRENTEU"]],
            thr: [{ v: 90, label: "$90" }, { v: 71, label: "pre-war $71" }] },
  brentM6:{ hidden: true, unit: "$", dp: 2, src: [["yahoo", brentContractTicker(5)]] },
  brentCurve:{ group: "energy", label: "Brent M1–M6", unit: "$", dp: 2, chg: "abs", derived: { op: "sub", a: "brent", b: "brentM6", sameSrc: true },
            note: "Front month minus the contract five months later. Positive = backwardation (tight prompt market)." },
  wti:    { group: "energy", label: "WTI", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "CL=F"], ["sinag", "CL"], ["fred", "DCOILWTICO"]] },
  ttf:    { group: "energy", label: "TTF gas €/MWh", unit: "px", dp: 1, chg: "pct", move: 6, src: [["yahoo", "TTF=F"]] },
  hh:     { group: "energy", label: "Henry Hub", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "NG=F"], ["sinag", "NG"], ["fred", "DHHNGSP"]] },
  rbob:   { group: "energy", label: "RBOB gasoline", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "RB=F"], ["fred", "DGASNYH"]],
            note: "NYMEX RBOB, $/gal. Fallback: EIA New York Harbor conventional gasoline spot via FRED — the futures' delivery point, published with a few days' lag." },
  hoil:   { group: "energy", label: "Heating oil (diesel)", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "HO=F"], ["sinag", "HO"], ["fred", "DDFUELNYH"]],
            note: "NYMEX NY Harbor ULSD, $/gal. Fallbacks: the same contract via Sina, then EIA New York Harbor ultra-low-sulfur diesel spot via FRED." },
  gasStore:{ group: "energy", label: "EU gas storage % full", unit: "%", dp: 1, chg: "abs", src: [["gie", "eu"]],
            thrFrom: { id: "gasAvg5", label: "5y avg same day" },
            note: "GIE AGSI+ EU aggregate. Reference line: average fill on the same gas day over the previous five years." },
  gasAvg5:{ hidden: true, unit: "%", dp: 1, src: [["gie", "eu:avg5"]] },
  coal:   { group: "energy", label: "Coal API2 (ARA)", unit: "$", dp: 1, chg: "pct", src: [["yahoo", "MTF=F"]],
            note: "Rotterdam coal futures (Yahoo MTF=F). On 23 Nov 2026 Yahoo's last bar for this ticker was 26 Dec 2025, so the tile reads stale until Yahoo rolls it; the monthly IMF Australian coal tile is the maintained alternative." },

  // ── Metals ───────────────────────────────────────────────────────────────
  gold:   { group: "metals", label: "Gold", unit: "$", dp: 0, chg: "pct", move: 2.5, src: [["yahoo", "GC=F"], ["sinag", "GC"]] },
  silver: { group: "metals", label: "Silver", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "SI=F"], ["sinag", "SI"]] },
  copper: { group: "metals", label: "Copper $/lb", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "HG=F"], ["sinag", "HG", { scale: 0.01 }]] },
  alu:    { group: "metals", label: "Aluminium", unit: "$", dp: 0, chg: "pct", src: [["yahoo", "ALI=F"], ["sinag", "AHD"]],
            note: "COMEX aluminium, $/t. Fallback: LME aluminium 3-month via Sina — same metal, different exchange (usually within a few %)." },
  cnRebar:{ group: "metals", label: "China rebar ¥/t (SHFE)", unit: "px", dp: 0, chg: "pct", src: [["sina", "RB0"]],
            note: "SHFE rebar, continuous main contract, via Sina Finance (unofficial endpoint). China construction demand." },
  cnHrc:  { group: "metals", label: "China HRC ¥/t (SHFE)", unit: "px", dp: 0, chg: "pct", src: [["sina", "HC0"]],
            note: "SHFE hot-rolled coil, continuous main contract, via Sina Finance. Compare with US HRC: the export-price gap." },
  cnOre:  { group: "metals", label: "Iron ore ¥/t (DCE)", unit: "px", dp: 1, chg: "pct", src: [["sina", "I0"]],
            note: "DCE iron ore, continuous main contract, via Sina Finance. Daily; the IMF series below is monthly in USD." },
  cnCoke: { group: "metals", label: "Coking coal ¥/t (DCE)", unit: "px", dp: 1, chg: "pct", src: [["sina", "JM0"]],
            note: "DCE coking coal, continuous main contract, via Sina Finance." },
  ironOre:{ group: "metals", label: "Iron ore $/t (monthly)", unit: "$", dp: 1, chg: "pct", freq: "M", src: [["fred", "PIORECRUSDM"]],
            note: "IMF primary commodity price via FRED (China import, 62% Fe). Monthly." },
  coalAu: { group: "metals", label: "Coal, Australia $/t (monthly)", unit: "$", dp: 1, chg: "pct", freq: "M", src: [["fred", "PCOALAUUSDM"]],
            note: "IMF primary commodity price via FRED (Newcastle thermal). Monthly." },
  hrc:    { group: "metals", label: "US HRC steel $/t", unit: "$", dp: 0, chg: "pct", src: [["yahoo", "HRC=F"]],
            note: "CME Midwest hot-rolled coil futures. China rebar has no free official feed (Phase 4)." },

  // ── Food ─────────────────────────────────────────────────────────────────
  wheat:  { group: "food", label: "Wheat ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZW=F"], ["sinag", "W"]] },
  corn:   { group: "food", label: "Corn ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZC=F"], ["sinag", "C"]] },
  soy:    { group: "food", label: "Soybeans ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZS=F"], ["sinag", "S"]] },
  rice:   { group: "food", label: "Rough rice $/cwt", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "ZR=F"]] },
  sugar:  { group: "food", label: "Sugar ¢/lb", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "SB=F"]] },
  coffee: { group: "food", label: "Coffee ¢/lb", unit: "px", dp: 1, chg: "pct", src: [["yahoo", "KC=F"], ["sinag", "KC"]] },
  cocoa:  { group: "food", label: "Cocoa $/t", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "CC=F"], ["sinag", "CC"]] },
  cattle: { group: "food", label: "Live cattle ¢/lb", unit: "px", dp: 1, chg: "pct", src: [["yahoo", "LE=F"]] },

  ffpi:   { group: "food", label: "FAO Food Price Index", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "ffpi"]], note: "FAO, 2014–16 = 100. Monthly." },
  faoCereals:{ group: "food", label: "FAO cereals", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "cereals"]] },
  faoOils:{ group: "food", label: "FAO vegetable oils", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "oils"]] },
  faoSugar:{ group: "food", label: "FAO sugar", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "sugar"]] },
  faoDairy:{ group: "food", label: "FAO dairy", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "dairy"]] },
  faoMeat:{ group: "food", label: "FAO meat", unit: "idx", dp: 1, chg: "pct", freq: "M", src: [["fao", "meat"]] },

  // ── Rare earths (equity proxies; oxide prices arrive in Phase 4) ─────────
  mp:     { group: "rare", label: "MP Materials", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "MP"], ["sinaus", "MP"]] },
  lynas:  { group: "rare", label: "Lynas (A$)", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "LYC.AX"]] },
  cnre:   { group: "rare", label: "China Northern RE (¥)", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "600111.SS"]] },
  remx:   { group: "rare", label: "REMX ETF", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "REMX"], ["sinaus", "REMX"]] },
};

// Panels on the page, in order, and which groups they show.
export const TABLE_PANELS = [
  { id: "rates",  label: "RATES & YIELDS", ids: ["ust3m", "ust2y", "ust10y", "ust30y", "c2s10s", "real10y", "bei10y", "infl5y5", "tp10y", "impl10y", "bund10", "oatBund", "btpBund", "jgb10"] },
  { id: "credit", label: "CREDIT, STRESS & BREADTH", ids: ["hyOas", "igOas", "cccOas", "stlfsi", "vix", "moveIx", "hyg", "crwv", "orcl", "spx", "ndq", "rut", "ewRatio"] },
  // INR, IDR and THB sit behind a toggle: the playbook (section 4) uses them only as
  // oil-importer stress gauges ("treat Indonesia, India and Thailand cautiously until Hormuz clears").
  // SGD crosses: your base currency against where your costs and holdings are.
  { id: "fx",     label: "FX", ids: ["dxy", "eurusd", "usdjpy", "usdcnh", "usdsgd", "audusd", "usdnok"],
    more: [{ id: "oil", label: "Asia oil importers", ids: ["usdinr", "usdidr", "usdthb"], tip: "fxMore" },
           { id: "sgd", label: "SGD crosses", ids: SGD_CROSS_IDS, tip: "fxSgd" }] },
];
export const TILE_GROUPS = [
  { id: "energy", label: "ENERGY",  ids: ["brent", "brentCurve", "wti", "ttf", "gasStore", "hh", "rbob", "hoil", "coal"] },
  { id: "metals", label: "METALS, STEEL & BULKS", ids: ["gold", "silver", "copper", "alu", "hrc", "cnHrc", "cnRebar", "cnOre", "cnCoke", "ironOre", "coalAu"] },
  { id: "food",   label: "FOOD · FAO indices (monthly) and futures", ids: ["ffpi", "faoCereals", "faoOils", "faoSugar", "faoDairy", "faoMeat", "wheat", "corn", "soy", "rice", "sugar", "coffee", "cocoa", "cattle"] },
  { id: "rare",   label: "RARE EARTHS · equity proxies", ids: ["mp", "lynas", "cnre", "remx"] },
];
