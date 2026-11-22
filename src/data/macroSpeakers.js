// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — central-bank speakers, feeds and outlets (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════
// Fed roster: FOMC page, federalreserve.gov/monetarypolicy/fomc.htm (PRIMARY,
//   read 21 Nov 2026): 2026 members Warsh (Chair), Williams (Vice Chair), Barr,
//   Bowman, Cook, Hammack, Jefferson, Kashkari, Logan, Paulson, Powell, Waller;
//   alternates Barkin, Daly, Goolsbee, Shukla (NY FVP), Venable (Atlanta,
//   interim). 2027 rotating voters: Chicago, Richmond, Atlanta, San Francisco.
//   Boston (Collins), St. Louis (Musalem), Kansas City (Schmid): not listed on
//   that page — names as last known; verify.
// ECB: Executive Board after Vujčić became Vice-President on 1 Jun 2026 (ECB
//   press release, 25 Feb 2026); Lagarde steps down 7 Feb 2027 (ECB, 29 Oct
//   2026), successor not yet named. National governors as last known; verify.
//   ECB governors vote on a monthly rotation, so no voter badge is shown.
//
// weight: how much a statement moves the hawk–dove index (Chair/President 3,
// vice chairs / NY Fed / chief economist 2, voters 1.5, others 1; anyone not on
// the roster 0.5). The classifier reads the speaker's name and role from the
// text; this list only supplies the weight and voter status.

export const FED_ROSTER = [
  { name: "Warsh",     full: "Kevin Warsh",          role: "Chair",                 weight: 3,   v26: true,  v27: true },
  { name: "Jefferson", full: "Philip Jefferson",     role: "Vice Chair",            weight: 2,   v26: true,  v27: true },
  { name: "Williams",  full: "John Williams",        role: "NY Fed (FOMC Vice Chair)", weight: 2, v26: true, v27: true },
  { name: "Bowman",    full: "Michelle Bowman",      role: "Vice Chair, Supervision", weight: 1.5, v26: true, v27: true },
  { name: "Waller",    full: "Christopher Waller",   role: "Governor",              weight: 1.5, v26: true,  v27: true },
  { name: "Barr",      full: "Michael Barr",         role: "Governor",              weight: 1.5, v26: true,  v27: true },
  { name: "Cook",      full: "Lisa Cook",            role: "Governor",              weight: 1.5, v26: true,  v27: true },
  { name: "Powell",    full: "Jerome Powell",        role: "Governor",              weight: 1.5, v26: true,  v27: true },
  { name: "Hammack",   full: "Beth Hammack",         role: "Cleveland Fed",         weight: 1.5, v26: true,  v27: false },
  { name: "Kashkari",  full: "Neel Kashkari",        role: "Minneapolis Fed",       weight: 1.5, v26: true,  v27: false },
  { name: "Logan",     full: "Lorie Logan",          role: "Dallas Fed",            weight: 1.5, v26: true,  v27: false },
  { name: "Paulson",   full: "Anna Paulson",         role: "Philadelphia Fed",      weight: 1.5, v26: true,  v27: false },
  { name: "Goolsbee",  full: "Austan Goolsbee",      role: "Chicago Fed",           weight: 1,   v26: false, v27: true },
  { name: "Barkin",    full: "Thomas Barkin",        role: "Richmond Fed",          weight: 1,   v26: false, v27: true },
  { name: "Daly",      full: "Mary Daly",            role: "San Francisco Fed",     weight: 1,   v26: false, v27: true },
  { name: "Venable",   full: "Cheryl Venable",       role: "Atlanta Fed (interim)", weight: 1,   v26: false, v27: true },
  { name: "Collins",   full: "Susan Collins",        role: "Boston Fed",            weight: 1,   v26: false, v27: false, verify: true },
  { name: "Musalem",   full: "Alberto Musalem",      role: "St. Louis Fed",         weight: 1,   v26: false, v27: false, verify: true },
  { name: "Schmid",    full: "Jeffrey Schmid",       role: "Kansas City Fed",       weight: 1,   v26: false, v27: false, verify: true },
];

export const ECB_ROSTER = [
  { name: "Lagarde",   full: "Christine Lagarde",    role: "President (leaves 7 Feb 2027)", weight: 3 },
  { name: "Vujčić",    full: "Boris Vujčić",         role: "Vice-President",        weight: 2, aliases: ["Vujcic"] },
  { name: "Lane",      full: "Philip Lane",          role: "Chief Economist",       weight: 2 },
  { name: "Schnabel",  full: "Isabel Schnabel",      role: "Executive Board",       weight: 1.5 },
  { name: "Cipollone", full: "Piero Cipollone",      role: "Executive Board",       weight: 1.5 },
  { name: "Elderson",  full: "Frank Elderson",       role: "Executive Board",       weight: 1.5 },
  { name: "Nagel",     full: "Joachim Nagel",        role: "Bundesbank",            weight: 1.5 },
  { name: "Villeroy",  full: "François Villeroy de Galhau", role: "Banque de France", weight: 1.5, verify: true },
  { name: "Panetta",   full: "Fabio Panetta",        role: "Banca d'Italia",        weight: 1.5 },
  { name: "Escrivá",   full: "José Luis Escrivá",    role: "Banco de España",       weight: 1.5, aliases: ["Escriva"], verify: true },
  { name: "Sleijpen",  full: "Olaf Sleijpen",        role: "De Nederlandsche Bank", weight: 1, verify: true },
  { name: "Rehn",      full: "Olli Rehn",            role: "Bank of Finland",       weight: 1, verify: true },
  { name: "Kocher",    full: "Martin Kocher",        role: "Oesterreichische Nationalbank", weight: 1, verify: true },
  { name: "Wunsch",    full: "Pierre Wunsch",        role: "National Bank of Belgium", weight: 1, verify: true },
  { name: "Makhlouf",  full: "Gabriel Makhlouf",     role: "Central Bank of Ireland", weight: 1, verify: true },
  { name: "Kazāks",    full: "Mārtiņš Kazāks",       role: "Latvijas Banka",        weight: 1, aliases: ["Kazaks"], verify: true },
];

const GN = (q, hl = "en-US", gl = "US", ceid = "US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
const names = list => list.map(p => p.name).join(" OR ");

// kind "official": the bank's own site — the text is fetched and read in full
// (PDFs excepted). kind "news": headlines and summaries only.
export const SPEECH_FEEDS = [
  { id: "fed_speeches",  bank: "fed", kind: "official", url: "https://www.federalreserve.gov/feeds/speeches.xml" },
  { id: "fed_testimony", bank: "fed", kind: "official", url: "https://www.federalreserve.gov/feeds/testimony.xml" },
  { id: "fed_monetary",  bank: "fed", kind: "official", url: "https://www.federalreserve.gov/feeds/press_monetary.xml" },
  { id: "ecb_press",     bank: "ecb", kind: "official", url: "https://www.ecb.europa.eu/rss/press.html" },
  { id: "fed_news_a", bank: "fed", kind: "news", url: GN(`(${names(FED_ROSTER.slice(0, 8))}) Fed rates when:7d`) },
  { id: "fed_news_b", bank: "fed", kind: "news", url: GN(`(${names(FED_ROSTER.slice(8))}) Fed rates when:7d`) },
  { id: "ecb_news_en", bank: "ecb", kind: "news", url: GN(`(${names(ECB_ROSTER.slice(0, 10))}) ECB rates when:7d`) },
  // Local-language press, where Governing Council members often speak first.
  { id: "ecb_news_de", bank: "ecb", kind: "news", lang: "de", url: GN("(Nagel OR Schnabel OR Lane OR Lagarde) EZB Zinsen when:7d", "de", "DE", "DE:de") },
  { id: "ecb_news_fr", bank: "ecb", kind: "news", lang: "fr", url: GN("(Villeroy OR Lagarde OR Lane) BCE taux when:7d", "fr", "FR", "FR:fr") },
  { id: "ecb_news_it", bank: "ecb", kind: "news", lang: "it", url: GN("(Panetta OR Cipollone OR Lagarde) BCE tassi when:7d", "it", "IT", "IT:it") },
  { id: "ecb_news_es", bank: "ecb", kind: "news", lang: "es", url: GN("(Escrivá OR Lagarde OR Lane) BCE tipos when:7d", "es", "ES", "ES:es") },
];

// Outlets whose reports count toward the hawk–dove index. Anything else is
// shown, tagged SECONDARY-unverified, and left out of the index (aggregators
// and SEO sites rewrite wire stories, sometimes wrongly).
export const TRUSTED_OUTLETS = [
  "Reuters", "Bloomberg", "CNBC", "Financial Times", "Wall Street Journal", "WSJ", "MNI", "Market News", "Associated Press", "AP News",
  "The Hill", "Fortune", "Barron's", "MarketWatch", "Axios", "Politico", "Yahoo Finance", "Fox Business",
  "Börsen-Zeitung", "Handelsblatt", "Frankfurter Allgemeine", "FAZ", "Süddeutsche", "Der Spiegel", "Die Zeit", "Tagesschau", "ARD", "ZDF", "Presseportal", "dpa",
  "Les Echos", "Le Monde", "Le Figaro", "L'Agefi", "BFM", "La Tribune", "AFP",
  "Il Sole 24 Ore", "Corriere della Sera", "la Repubblica", "ANSA", "Milano Finanza",
  "Expansión", "El País", "Cinco Días", "El Economista", "Europa Press",
  "Het Financieele Dagblad", "Irish Times", "Kathimerini",
  // Chinese-language and regional outlets for the US–China / rare-earth evidence (signal 9)
  "Xinhua", "新华", "人民日报", "人民网", "Caixin", "财新", "第一财经", "Yicai", "21世纪经济报道", "证券时报", "央视", "CCTV", "China Daily",
  "South China Morning Post", "SCMP", "Nikkei", "日本経済新聞",
];

// News queries behind the evidence suggestions for the manual signals.
export const EVIDENCE_QUERIES = {
  s6:  [GN("Treasury quarterly refunding coupon auction sizes when:30d")],
  s9:  [GN("US China trade truce rare earth export controls when:14d"),
        GN("稀土 出口管制 商务部 when:14d", "zh-CN", "CN", "CN:zh-Hans")],
  s15: [GN("(Microsoft OR Alphabet OR Amazon OR Meta) capex 2027 guidance when:21d")],
};

export const STANCE = {
  2:  { label: "hawkish",      short: "▲▲", color: "#c0392b" },
  1:  { label: "leans hawkish", short: "▲",  color: "#b84a00" },
  0:  { label: "neutral",      short: "◆",  color: "#888" },
  "-1": { label: "leans dovish", short: "▼",  color: "#3a6080" },
  "-2": { label: "dovish",     short: "▼▼", color: "#1f4e79" },
};
