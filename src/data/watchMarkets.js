// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST — market registry (shared by the browser and the server check)
// ═══════════════════════════════════════════════════════════════════════════════
// Keyed by the Yahoo ticker suffix (7203.T → "T"; no suffix → US listing).
//   country  Gloomberg's country label for the add form (src/components/Watchlist.jsx there)
//   bench    home-market index the 1M/3M "vs index" columns compare against.
//            Japan uses the TOPIX ETF 1306.T (Yahoo has no clean TOPIX index
//            history); every symbol here was checked on Yahoo spark on 25 Nov 2026.
//            Thailand has none: ^SET.BK returned a single point.
//   hl/gl/ceid  Google News edition for the local-language news query
//   script   true where headlines use a non-Latin script, so the English name
//            alone will not find local press — the local name is needed

export const MARKETS = {
  "":  { country: "United States",  bench: "^GSPC",      benchLabel: "S&P 500",   hl: "en-US", gl: "US", ceid: "US:en" },
  T:   { country: "Japan",          bench: "1306.T",     benchLabel: "TOPIX",     hl: "ja",    gl: "JP", ceid: "JP:ja", script: true, lang: "Japanese" },
  HK:  { country: "Hong Kong",      bench: "^HSI",       benchLabel: "Hang Seng", hl: "zh-HK", gl: "HK", ceid: "HK:zh-Hant", script: true, lang: "Traditional Chinese" },
  SI:  { country: "Singapore",      bench: "^STI",       benchLabel: "STI",       hl: "en-SG", gl: "SG", ceid: "SG:en" },
  L:   { country: "United Kingdom", bench: "^FTSE",      benchLabel: "FTSE 100",  hl: "en-GB", gl: "GB", ceid: "GB:en" },
  PA:  { country: "France",         bench: "^FCHI",      benchLabel: "CAC 40",    hl: "fr",    gl: "FR", ceid: "FR:fr", lang: "French" },
  DE:  { country: "Germany",        bench: "^GDAXI",     benchLabel: "DAX",       hl: "de",    gl: "DE", ceid: "DE:de", lang: "German" },
  F:   { country: "Germany",        bench: "^GDAXI",     benchLabel: "DAX",       hl: "de",    gl: "DE", ceid: "DE:de", lang: "German" },
  MC:  { country: "Spain",          bench: "^IBEX",      benchLabel: "IBEX 35",   hl: "es",    gl: "ES", ceid: "ES:es", lang: "Spanish" },
  SW:  { country: "Switzerland",    bench: "^SSMI",      benchLabel: "SMI",       hl: "de",    gl: "CH", ceid: "CH:de", lang: "German" },
  MI:  { country: "Italy",          bench: "FTSEMIB.MI", benchLabel: "FTSE MIB",  hl: "it",    gl: "IT", ceid: "IT:it", lang: "Italian" },
  AS:  { country: "Netherlands",    bench: "^AEX",       benchLabel: "AEX",       hl: "nl",    gl: "NL", ceid: "NL:nl", lang: "Dutch" },
  AX:  { country: "Australia",      bench: "^AXJO",      benchLabel: "ASX 200",   hl: "en-AU", gl: "AU", ceid: "AU:en" },
  TO:  { country: "Canada",         bench: "^GSPTSE",    benchLabel: "TSX",       hl: "en-CA", gl: "CA", ceid: "CA:en" },
  JK:  { country: "Indonesia",      bench: "^JKSE",      benchLabel: "JCI",       hl: "id",    gl: "ID", ceid: "ID:id", lang: "Indonesian" },
  TW:  { country: "Taiwan",         bench: "^TWII",      benchLabel: "TAIEX",     hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant", script: true, lang: "Traditional Chinese" },
  TWO: { country: "Taiwan",         bench: "^TWII",      benchLabel: "TAIEX",     hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant", script: true, lang: "Traditional Chinese" },
  SS:  { country: "China",          bench: "000001.SS",  benchLabel: "SSE Comp.", hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans", script: true, lang: "Simplified Chinese" },
  SZ:  { country: "China",          bench: "000001.SS",  benchLabel: "SSE Comp.", hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans", script: true, lang: "Simplified Chinese" },
  KL:  { country: "Malaysia",       bench: "^KLSE",      benchLabel: "KLCI",      hl: "en-MY", gl: "MY", ceid: "MY:en" },
  BK:  { country: "Thailand",       bench: null,         benchLabel: null,        hl: "th",    gl: "TH", ceid: "TH:th", script: true, lang: "Thai" },
  KS:  { country: "South Korea",    bench: "^KS11",      benchLabel: "KOSPI",     hl: "ko",    gl: "KR", ceid: "KR:ko", script: true, lang: "Korean" },
};

// Gloomberg's own option lists (src/components/Watchlist.jsx in chernyeh/gloomberg),
// so a name added here looks the same there.
export const GB_SECTORS = ["", "Banking & Finance", "Technology", "Healthcare", "Real Estate", "Consumer Staples", "Consumer Discretionary",
  "Industrials", "Energy", "Utilities", "Materials", "Communications", "REIT – Industrial", "REIT – Retail", "REIT – Office", "Infrastructure", "Other"];
export const GB_COUNTRIES = ["", "Singapore", "Australia", "Brazil", "Canada", "China", "France", "Germany", "Hong Kong", "India", "Indonesia",
  "Italy", "Japan", "Malaysia", "Mexico", "Netherlands", "Philippines", "South Korea", "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand",
  "United Kingdom", "United States", "Vietnam", "ASEAN", "Global", "Other"];
export const GB_ASSET_TYPES = ["Stock", "ETF", "Fund/Unit Trust", "REIT", "Bond", "Crypto", "Other"];

// Why a name is tracked — a name can carry several.
export const PURPOSES = [
  { id: "invest", label: "invest", tip: "A possible or actual position: valuation and your levels matter." },
  { id: "gauge",  label: "gauge",  tip: "A read on an industry or the market (e.g. a bellwether for memory, shipping, AI capex)." },
  { id: "factor", label: "factor", tip: "Tracks a style or factor (value, momentum, quality, rates-sensitive, small-cap)." },
  { id: "index",  label: "index",  tip: "Tracked for its weight in, or effect on, an index." },
];

export const suffixOf = ticker => {
  const m = String(ticker || "").toUpperCase().match(/\.([A-Z]{1,3})$/);
  return m ? m[1] : "";
};
export const marketOf = ticker => MARKETS[suffixOf(ticker)] || MARKETS[""];

// Pence-quoted listings: Yahoo reports GBp/GBX (London), ZAc (Johannesburg)
// and ILA (Tel Aviv) in minor units. Gloomberg stores levels in major units.
const MINOR = { GBp: ["GBP", 100], GBX: ["GBP", 100], GBx: ["GBP", 100], ZAc: ["ZAR", 100], ZAC: ["ZAR", 100], ILA: ["ILS", 100] };
export function majorCurrency(ccy) {
  const m = MINOR[ccy];
  return m ? { ccy: m[0], div: m[1] } : { ccy: ccy || null, div: 1 };
}

// Legal-form words dropped from a company name for news searches.
const LEGAL = /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|ag|sa|s\.a|se|nv|n\.v|spa|s\.p\.a|holdings?|group|tbk|pt|k\.k|kabushiki kaisha|bhd|berhad|adr|ads|class [a-z]|ordinary shares?|common stock|the)\b\.?/gi;
// First words too generic to match a headline on their own.
const GENERIC = new Set(["china", "japan", "bank", "first", "united", "general", "american", "national", "singapore", "hong", "new", "great",
  "global", "international", "asia", "pacific", "royal", "standard", "capital", "sun", "east", "west", "north", "south", "central",
  "industrial", "commercial", "trust", "real", "estate", "investment", "energy", "power", "oil", "gas", "steel", "tokyo", "osaka", "nippon", "japanese"]);

export function coreName(name) {
  const raw = String(name || "").replace(/\s+/g, " ").trim();
  const cleaned = raw.replace(/[,()]/g, " ").replace(LEGAL, " ").replace(/\s+/g, " ").replace(/[\s&.-]+$/, "").trim();
  return cleaned.length >= 3 ? cleaned : raw;
}

// Terms a headline must contain to count as news on this name (Google News
// returns loosely related items for short queries).
export function matchTerms({ ticker, name, local, localShort, aliases = [] }) {
  const core = coreName(name);
  const words = core.split(" ");
  const terms = [core];
  if (words.length > 1) {
    if (words[0].length >= 4 && !GENERIC.has(words[0].toLowerCase())) terms.push(words[0]);
    else if (words.length > 2) terms.push(words.slice(0, 2).join(" "));
  }
  if (local) terms.push(local);
  if (localShort) terms.push(localShort);
  aliases.forEach(a => a && terms.push(a));
  const sym = String(ticker || "").toUpperCase();
  if (!suffixOf(sym) && /^[A-Z]{3,5}$/.test(sym)) terms.push(sym);
  return [...new Set(terms.map(t => t.trim()).filter(t => t.length >= 2))];
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function termRegex(terms) {
  // Latin terms match on word boundaries; CJK/Thai terms as plain substrings.
  const parts = terms.map(t => (/^[\x20-\x7e]+$/.test(t) ? `\\b${esc(t)}\\b` : esc(t)));
  return parts.length ? new RegExp(parts.join("|"), "i") : null;
}

export const gnUrl = (q, m) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${m.hl}&gl=${m.gl}&ceid=${m.ceid}`;
