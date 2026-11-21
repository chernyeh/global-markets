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
//   freq                "D" daily (default) or "M" monthly — sets the history fetched
//   thr                 reference lines [{ v, label }] drawn on the sparkline
//   move                daily-move alert threshold (in the `chg` unit); upOnly for VIX
//   derived             { op:"sub"|"div", a, b, scale } — computed from two entries
//   note                shown on hover
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
  bbk:      { label: "Bundesbank",           short: "BBk",   tier: "PRIMARY",              url: "https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields" },
  mof:      { label: "Japan MoF",            short: "MoF",   tier: "PRIMARY",              url: "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/" },
  yahoo:    { label: "Yahoo Finance",        short: "Yahoo", tier: "SECONDARY-reliable",   url: "https://finance.yahoo.com/" },
  cbw:      { label: "Central Bank Watch",   short: "CBW",   tier: "SECONDARY-unverified", url: "https://centralbank.watch/" },
};

const BUND_10Y = "D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A";
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

  // ── US inflation (headline prints; components arrive in Phase 2) ─────────
  coreCpi:{ group: "inflation", label: "Core CPI index", unit: "idx", dp: 3, freq: "M", src: [["fred", "CPILFESL"]] },
  cpi:    { group: "inflation", label: "CPI index", unit: "idx", dp: 3, freq: "M", src: [["fred", "CPIAUCSL"]] },
  corePce:{ group: "inflation", label: "Core PCE index", unit: "idx", dp: 3, freq: "M", src: [["fred", "PCEPILFE"]] },

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
  hyg:    { group: "credit", label: "HYG (HY ETF)", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "HYG"]] },
  crwv:   { group: "credit", label: "CoreWeave shares", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "CRWV"]],
            note: "Equity proxy for neocloud credit stress; CoreWeave bond and CDS prices have no free feed." },
  orcl:   { group: "credit", label: "Oracle shares", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "ORCL"]] },

  // ── Equities & breadth ───────────────────────────────────────────────────
  spx:    { group: "equity", label: "S&P 500", unit: "idx", dp: 0, chg: "pct", move: 2, src: [["yahoo", "^GSPC"], ["fred", "SP500"]] },
  ndq:    { group: "equity", label: "Nasdaq Comp.", unit: "idx", dp: 0, chg: "pct", src: [["yahoo", "^IXIC"], ["fred", "NASDAQCOM"]] },
  rut:    { group: "equity", label: "Russell 2000", unit: "idx", dp: 0, chg: "pct", src: [["yahoo", "^RUT"]] },
  rsp:    { hidden: true, unit: "$", dp: 2, src: [["yahoo", "RSP"]] },
  spy:    { hidden: true, unit: "$", dp: 2, src: [["yahoo", "SPY"]] },
  ewRatio:{ group: "equity", label: "Equal- vs cap-weight", unit: "x", dp: 4, chg: "pct", derived: { op: "div", a: "rsp", b: "spy" },
            note: "RSP ÷ SPY. Rising = breadth improving (equal-weight beating the cap-weighted index)." },

  // ── FX ───────────────────────────────────────────────────────────────────
  dxy:    { group: "fx", label: "DXY", unit: "fx", dp: 2, chg: "pct", src: [["yahoo", "DX-Y.NYB"]] },
  eurusd: { group: "fx", label: "EUR/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "EURUSD=X"], ["fred", "DEXUSEU"]] },
  usdjpy: { group: "fx", label: "USD/JPY", unit: "fx", dp: 2, chg: "pct", move: 1, src: [["yahoo", "JPY=X"], ["fred", "DEXJPUS"]] },
  usdsgd: { group: "fx", label: "USD/SGD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "SGD=X"], ["fred", "DEXSIUS"]],
            thr: [{ v: 1.25, label: "1.25 carry break-even" }],
            note: "Below ≈1.25 within a year, an unhedged USD T-bill loses its ≈2pp carry over SGD (playbook)." },
  usdcnh: { group: "fx", label: "USD/CNH", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "CNH=X"], ["fred", "DEXCHUS"]],
            note: "FRED fallback is onshore CNY, not offshore CNH." },
  usdinr: { group: "fx", label: "USD/INR", unit: "fx", dp: 2, chg: "pct", src: [["yahoo", "INR=X"], ["fred", "DEXINUS"]] },
  usdidr: { group: "fx", label: "USD/IDR", unit: "fx", dp: 0, chg: "pct", src: [["yahoo", "IDR=X"]] },
  usdthb: { group: "fx", label: "USD/THB", unit: "fx", dp: 3, chg: "pct", src: [["yahoo", "THB=X"], ["fred", "DEXTHUS"]] },
  audusd: { group: "fx", label: "AUD/USD", unit: "fx", dp: 4, chg: "pct", src: [["yahoo", "AUDUSD=X"], ["fred", "DEXUSAL"]] },
  usdnok: { group: "fx", label: "USD/NOK", unit: "fx", dp: 3, chg: "pct", src: [["yahoo", "NOK=X"], ["fred", "DEXNOUS"]] },

  // ── Energy ───────────────────────────────────────────────────────────────
  brent:  { group: "energy", label: "Brent", unit: "$", dp: 2, chg: "pct", move: 3, src: [["yahoo", "BZ=F"], ["fred", "DCOILBRENTEU"]],
            thr: [{ v: 90, label: "$90" }, { v: 71, label: "pre-war $71" }] },
  brentM6:{ hidden: true, unit: "$", dp: 2, src: [["yahoo", brentContractTicker(5)]] },
  brentCurve:{ group: "energy", label: "Brent M1–M6", unit: "$", dp: 2, chg: "abs", derived: { op: "sub", a: "brent", b: "brentM6", sameSrc: true },
            note: "Front month minus the contract five months later. Positive = backwardation (tight prompt market)." },
  wti:    { group: "energy", label: "WTI", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "CL=F"], ["fred", "DCOILWTICO"]] },
  ttf:    { group: "energy", label: "TTF gas €/MWh", unit: "px", dp: 1, chg: "pct", move: 6, src: [["yahoo", "TTF=F"]] },
  hh:     { group: "energy", label: "Henry Hub", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "NG=F"], ["fred", "DHHNGSP"]] },
  rbob:   { group: "energy", label: "RBOB gasoline", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "RB=F"]] },
  hoil:   { group: "energy", label: "Heating oil (diesel)", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "HO=F"]] },
  coal:   { group: "energy", label: "Coal API2 (ARA)", unit: "$", dp: 1, chg: "pct", src: [["yahoo", "MTF=F"]],
            note: "Rotterdam coal futures. Ticker unverified from the build sandbox." },

  // ── Metals ───────────────────────────────────────────────────────────────
  gold:   { group: "metals", label: "Gold", unit: "$", dp: 0, chg: "pct", move: 2.5, src: [["yahoo", "GC=F"]] },
  silver: { group: "metals", label: "Silver", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "SI=F"]] },
  copper: { group: "metals", label: "Copper $/lb", unit: "$", dp: 3, chg: "pct", src: [["yahoo", "HG=F"]] },
  alu:    { group: "metals", label: "Aluminium", unit: "$", dp: 0, chg: "pct", src: [["yahoo", "ALI=F"]] },
  hrc:    { group: "metals", label: "US HRC steel $/t", unit: "$", dp: 0, chg: "pct", src: [["yahoo", "HRC=F"]],
            note: "CME Midwest hot-rolled coil futures. China rebar has no free official feed (Phase 4)." },

  // ── Food ─────────────────────────────────────────────────────────────────
  wheat:  { group: "food", label: "Wheat ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZW=F"]] },
  corn:   { group: "food", label: "Corn ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZC=F"]] },
  soy:    { group: "food", label: "Soybeans ¢/bu", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "ZS=F"]] },
  rice:   { group: "food", label: "Rough rice $/cwt", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "ZR=F"]] },
  sugar:  { group: "food", label: "Sugar ¢/lb", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "SB=F"]] },
  coffee: { group: "food", label: "Coffee ¢/lb", unit: "px", dp: 1, chg: "pct", src: [["yahoo", "KC=F"]] },
  cocoa:  { group: "food", label: "Cocoa $/t", unit: "px", dp: 0, chg: "pct", src: [["yahoo", "CC=F"]] },
  cattle: { group: "food", label: "Live cattle ¢/lb", unit: "px", dp: 1, chg: "pct", src: [["yahoo", "LE=F"]] },

  // ── Rare earths (equity proxies; oxide prices arrive in Phase 4) ─────────
  mp:     { group: "rare", label: "MP Materials", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "MP"]] },
  lynas:  { group: "rare", label: "Lynas (A$)", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "LYC.AX"]] },
  cnre:   { group: "rare", label: "China Northern RE (¥)", unit: "px", dp: 2, chg: "pct", src: [["yahoo", "600111.SS"]] },
  remx:   { group: "rare", label: "REMX ETF", unit: "$", dp: 2, chg: "pct", src: [["yahoo", "REMX"]] },
};

// Panels on the page, in order, and which groups they show.
export const TABLE_PANELS = [
  { id: "rates",  label: "RATES & YIELDS", ids: ["ust3m", "ust2y", "ust10y", "ust30y", "c2s10s", "real10y", "bei10y", "infl5y5", "tp10y", "impl10y", "bund10", "oatBund", "btpBund", "jgb10"] },
  { id: "credit", label: "CREDIT, STRESS & BREADTH", ids: ["hyOas", "igOas", "cccOas", "stlfsi", "vix", "moveIx", "hyg", "crwv", "orcl", "spx", "ndq", "rut", "ewRatio"] },
  { id: "fx",     label: "FX", ids: ["dxy", "eurusd", "usdjpy", "usdsgd", "usdcnh", "usdinr", "usdidr", "usdthb", "audusd", "usdnok"] },
];
export const TILE_GROUPS = [
  { id: "energy", label: "ENERGY",  ids: ["brent", "brentCurve", "wti", "ttf", "hh", "rbob", "hoil", "coal"] },
  { id: "metals", label: "METALS & STEEL", ids: ["gold", "silver", "copper", "alu", "hrc"] },
  { id: "food",   label: "FOOD",    ids: ["wheat", "corn", "soy", "rice", "sugar", "coffee", "cocoa", "cattle"] },
  { id: "rare",   label: "RARE EARTHS · equity proxies", ids: ["mp", "lynas", "cnre", "remx"] },
];
