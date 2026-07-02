// ═══════════════════════════════════════════════════════════════════════════════
// MSCI GICS SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
export const MSCI_SECTORS = [
  { code:"FIN", label:"Financials",             icon:"◈", color:"#2980b9" },
  { code:"IT",  label:"Information Technology", icon:"⬡", color:"#a78bfa" },
  { code:"IND", label:"Industrials",            icon:"⬢", color:"#fb923c" },
  { code:"CD",  label:"Consumer Discretionary", icon:"◉", color:"#f472b6" },
  { code:"CS",  label:"Consumer Staples",       icon:"◎", color:"#86efac" },
  { code:"HC",  label:"Health Care",            icon:"✦", color:"#67e8f9" },
  { code:"EN",  label:"Energy",                 icon:"◆", color:"#fbbf24" },
  { code:"MAT", label:"Materials",              icon:"◇", color:"#a3e635" },
  { code:"COM", label:"Comm. Services",         icon:"◐", color:"#f87171" },
  { code:"RE",  label:"Real Estate",            icon:"⬛", color:"#c084fc" },
  { code:"UTL", label:"Utilities",              icon:"◑", color:"#94a3b8" },
  { code:"MAC", label:"Macro / Policy",         icon:"⊕", color:"#c0392b" },
  { code:"UNK", label:"Unclassified",           icon:"○", color:"#3a4a5a" },
];
export const SECTOR_MAP = Object.fromEntries(MSCI_SECTORS.map(s => [s.code, s]));

// ═══════════════════════════════════════════════════════════════════════════════
// OPINION CATEGORIES — Opinions tab
// ═══════════════════════════════════════════════════════════════════════════════
export const OPINION_CATEGORIES = [
  { code:"MACRO",   label:"Macro / Economy",     icon:"⊕", color:"#c0392b" },
  { code:"GEO",     label:"Geopolitics",         icon:"◍", color:"#8e44ad" },
  { code:"MKT",     label:"Markets / Trading",   icon:"▦", color:"#2980b9" },
  { code:"INVEST",  label:"Investing / Strategy",icon:"◈", color:"#1b7a3e" },
  { code:"COMPANY", label:"Company-Specific",    icon:"◉", color:"#b84a00" },
  { code:"SECTOR",  label:"Sector / Industry",   icon:"⬡", color:"#0f7b8a" },
  { code:"POLICY",  label:"Policy / Regulation", icon:"§", color:"#6a1b9a" },
  { code:"OTHER",   label:"Other",               icon:"○", color:"#5a6a7a" },
];
export const OPINION_MAP = Object.fromEntries(OPINION_CATEGORIES.map(c => [c.code, c]));
export const OPINION_CODES = OPINION_CATEGORIES.map(c => c.code);

// ═══════════════════════════════════════════════════════════════════════════════
// CORPORATE ACTION SIGNAL ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
export const SIGNAL_META = {
  SP2: { label:"Strong Positive", short:"▲▲", color:"#fff", bg:"#1b7a3e", border:"#145c2e" },
  SP1: { label:"Positive",        short:"▲",  color:"#1b7a3e", bg:"#e6f4ec", border:"#a8d5b8" },
  N:   { label:"Neutral",         short:"–",  color:"#666",    bg:"#f5f5f5", border:"#ddd"    },
  SN1: { label:"Negative",        short:"▽",  color:"#b84a00", bg:"#fff3ee", border:"#ffccbc" },
  SN2: { label:"Strong Negative", short:"▽▽", color:"#fff",    bg:"#c0392b", border:"#922b21" },
};

// Signal categories — each has a default signal strength and a management flag
export const SIGNAL_CATEGORIES = {
  EARNINGS_BEAT:     { label:"Earnings Beat",       signal:"SP2", mgmt:false },
  EARNINGS_MISS:     { label:"Earnings Miss",        signal:"SN2", mgmt:false },
  REVENUE_BEAT:      { label:"Revenue Beat",         signal:"SP1", mgmt:false },
  REVENUE_MISS:      { label:"Revenue Miss",         signal:"SN1", mgmt:false },
  GUIDANCE_UP:       { label:"Guidance Raised",      signal:"SP2", mgmt:false },
  GUIDANCE_DOWN:     { label:"Guidance Cut",         signal:"SN2", mgmt:false },
  PROFIT_WARNING:    { label:"Profit Warning",       signal:"SN2", mgmt:false },
  DIVIDEND_RAISE:    { label:"Dividend Raise",       signal:"SP1", mgmt:false },
  DIVIDEND_CUT:      { label:"Dividend Cut",         signal:"SN2", mgmt:false },
  SPECIAL_DIVIDEND:  { label:"Special Dividend",     signal:"SP2", mgmt:false },
  BUYBACK:           { label:"Share Buyback",        signal:"SP1", mgmt:false },
  MA_ACQUIRER:       { label:"M&A — Acquirer",       signal:"SP1", mgmt:false },
  MA_TARGET:         { label:"M&A — Target",         signal:"SP2", mgmt:false },
  RESTRUCTURE:       { label:"Restructuring",        signal:"SN1", mgmt:false },
  LAYOFFS:           { label:"Layoffs",              signal:"SN1", mgmt:false },
  CEO_NEW:           { label:"New CEO",              signal:"SP1", mgmt:true  },
  CEO_RESIGN:        { label:"CEO Resignation",      signal:"SN1", mgmt:true  },
  CFO_CHANGE:        { label:"CFO Change",           signal:"SN1", mgmt:true  },
  BOARD_CHANGE:      { label:"Board Change",         signal:"SP1", mgmt:true  },
  ACTIVIST_INVESTOR: { label:"Activist Investor",    signal:"SP1", mgmt:true  },
  MGMT_INTERVIEW:    { label:"Mgmt Interview",       signal:"N",   mgmt:true  },
  MGMT_STRATEGY:     { label:"Strategy Change",      signal:"SP1", mgmt:true  },
  MGMT_TURNAROUND:   { label:"Turnaround Plan",      signal:"SP1", mgmt:true  },
  MGMT_UNDER_PRESSURE:{ label:"Mgmt Under Pressure", signal:"SN1", mgmt:true  },
  MGMT_BUY:          { label:"Director Buying",      signal:"SP2", mgmt:true  },
  MGMT_SELL:         { label:"Director Selling",     signal:"SN1", mgmt:true  },
  REGULATORY_FINE:   { label:"Regulatory Fine",      signal:"SN2", mgmt:false },
  REGULATORY_BLOCK:  { label:"Regulatory Block",     signal:"SN2", mgmt:false },
  ACCOUNTING_ISSUE:  { label:"Accounting Issue",     signal:"SN2", mgmt:false },
  LAWSUIT:           { label:"Lawsuit / Legal",      signal:"SN1", mgmt:false },
  CONTRACT_WIN:      { label:"Contract Win",         signal:"SP2", mgmt:false },
  CONTRACT_LOSS:     { label:"Contract Loss",        signal:"SN2", mgmt:false },
  PARTNERSHIP:       { label:"Partnership / JV",     signal:"SP1", mgmt:false },
  DEBT_ISSUE:        { label:"Debt / Covenant",      signal:"SN2", mgmt:false },
  RATING_UP:         { label:"Analyst Upgrade",      signal:"SP1", mgmt:false },
  RATING_DOWN:       { label:"Analyst Downgrade",    signal:"SN1", mgmt:false },
  IPO:               { label:"IPO / Listing",        signal:"SP1", mgmt:false },
  DELISTING:         { label:"Delisting",            signal:"SN2", mgmt:false },
  BIZ_FEATURE:       { label:"Business Feature",     signal:"N",   mgmt:false },
  MARKET_OUTLOOK:    { label:"Market Outlook",       signal:"N",   mgmt:false },
  MACRO:             { label:"Macro / Policy",       signal:"N",   mgmt:false },
  OTHER:             { label:"Other",                signal:"N",   mgmt:false },
};

// Context flags that UPGRADE signal strength for management events
export const WEAKNESS_CONTEXT_PATTERNS = /after (disappointing|poor|weak|dismal|miss|profit warning)|amid (investor|analyst|shareholder) pressure|following (strategic review|underperformance|losses|write[- ]?down)|turnaround|restructur|strategic (overhaul|pivot|reset|review)|under pressure|calls for (change|resignation|shake[- ]?up)|operational (challenges|difficulties|failure)|execution (failure|miss)|replac(es|ing|ed) (CEO|chief)|activist/i;

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD NEWS PRIORITY SCORING — Today tab sort order
// ═══════════════════════════════════════════════════════════════════════════════
export const WORLD_TOPIC_WEIGHTS = [
  // Geopolitics: Iran, Ukraine, Taiwan, Israel/ME, US-China/Russia trade & military
  { score: 50, re: /\biran(ian)?\b|\bukraina?\b|\bzelensky\b|\bkyiv\b|\btaiwan\b|\bsouth china sea\b|\bpla\b|\bisrael\b|\bgaza\b|\bhamas\b|\bnetanyahu\b|\bidf\b|\bhezbollah\b|\bhouthi\b|\bwest bank\b|\bputin\b|\bkremlin\b|\brussia\b|trade war|export control|chip ban|us.china/i },
  // Elon Musk and his companies (Tesla, SpaceX, xAI, Starlink, X, DOGE)
  { score: 40, re: /elon musk|\bmusk\b|\btesla\b|\bspacex\b|\bstarlink\b|\bxai\b|\bgrok\b|department of government efficiency/i },
  // Oil, energy & inflationary expectations
  { score: 40, re: /oil price|crude oil|\bbrent\b|\bwti\b|\bopec\b|oil supply|oil demand|oil output|lng price|gas price|energy (price|crisis|shock|supply|disruption)/i },
  // AI buildout, infrastructure, regulation (inc. China/HK)
  { score: 35, re: /artificial intelligence|generative ai|\bai chip\b|\bai model\b|\bai regulation\b|\bai act\b|\bai infrastructure\b|large language model|\bllm\b|\bdeepseek\b|\bopenai\b|\banthropic\b|\bchatgpt\b|gpu.*data.?center|data.?center.*ai|ai.*data.?center|hyperscaler|compute cluster|foundation model/i },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BRIEF SCORING WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════════
export const BRIEF_CATEGORY_WEIGHT = {
  RATING_UP:6, RATING_DOWN:6,
  CEO_NEW:6, CEO_RESIGN:6, CFO_CHANGE:5, BOARD_CHANGE:5,
  MGMT_STRATEGY:6, MGMT_TURNAROUND:6, MGMT_UNDER_PRESSURE:5,
  MGMT_INTERVIEW:6, MARKET_OUTLOOK:6, BIZ_FEATURE:5,
  MGMT_BUY:6, MGMT_SELL:5, ACTIVIST_INVESTOR:6,
  PROFIT_WARNING:5, EARNINGS_BEAT:5, EARNINGS_MISS:5, GUIDANCE_UP:5, GUIDANCE_DOWN:5,
  MA_TARGET:5, MA_ACQUIRER:4, ACCOUNTING_ISSUE:5, DEBT_ISSUE:4, REGULATORY_BLOCK:4,
  SPECIAL_DIVIDEND:4, DIVIDEND_CUT:4, DIVIDEND_RAISE:3, BUYBACK:3, REGULATORY_FINE:3,
  CONTRACT_WIN:3, CONTRACT_LOSS:3, RESTRUCTURE:3, LAYOFFS:3, REVENUE_BEAT:3, REVENUE_MISS:3,
  DELISTING:3, LAWSUIT:2, PARTNERSHIP:2, IPO:2,
  MACRO:1, OTHER:0,
};
export const SIGNAL_STRENGTH = { SP2:3, SN2:3, SP1:2, SN1:2, N:0 };

export const BRIEF_COUNTRY_BOOST = 1.4;
export const BRIEF_COUNTRY_PENALTY = 0.5;
export const BRIEF_BOOSTED_COUNTRIES = new Set([
  "US","CA","DE","EU","SG","HK","CN","KR","TW","IL","AU",
  "BR","MX","AR","CL","CO","PE", // LatAm cluster
]);
export const BRIEF_PENALISED_COUNTRIES = new Set(["PH","NG","MY","IN"]);
