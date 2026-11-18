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
// ─── Priority topic patterns ──────────────────────────────────────────────────
// Shared by the Breaking-feed ranking and the brief ranking through the TOPICS
// registry below, so one edit moves both. Matched against the
// English translated title + description, so they stay ASCII: non-English
// headlines are translated before scoring.
export const GEOPOLITICS_RE = /\biran(ian)?\b|\bukraina?\b|\bzelensky\b|\bkyiv\b|\btaiwan\b|\bsouth china sea\b|\bpla\b|\bisrael\b|\bgaza\b|\bhamas\b|\bnetanyahu\b|\bidf\b|\bhezbollah\b|\bhouthi\b|\bwest bank\b|\bputin\b|\bkremlin\b|\brussia\b|trade war|export control|chip ban|us.china/i;

export const SEMI_SUPPLY_CHAIN_RE = /\bsemiconductor|\bchipmaker|\bchip (maker|market|sector|supply|demand|price|output|production|shortage|glut)|\bfoundry\b|\bwafer\b|\btsmc\b|\bumc\b|\bsmic\b|\bglobalfoundries\b|\bsamsung (electronics|foundry)\b|\bsk hynix\b|\bmicron\b|\bkioxia\b|\basml\b|\btokyo electron\b|\bapplied materials\b|\blam research\b|\bnvidia\b|\bbroadcom\b|\bcowos\b|advanced packaging|\bhbm\b|high.bandwidth memory|\bdram\b|\bnand\b|\bsilicon photonics\b|\bcpo\b|\bsubstrate\b|\babf\b|\bpcb\b|\bodm\b|\bosat\b|\bfoxconn\b|\bhon hai\b|\bquanta\b|\bwistron\b|\bwiwynn\b|\bpegatron\b|\binventec\b|\bcompal\b|\bdelta electronics\b|ai server|server (order|shipment|rack)|supply chain|\bcapacity (expansion|utilisation|utilization)\b|\bfab\b|\bnode\b.{0,20}\bnm\b|\b[23457]nm\b|lithography|\bepitax|component (maker|shortage|pricing)/i;

export const TRADE_POLICY_RE = /\btariff|\bduties\b|\banti.dumping\b|\bexport (control|curb|ban|licence|license|restriction)|\bimport (curb|ban|quota|restriction)\b|\bentity list\b|\bblacklist\b|\bsanction|\btrade (war|deal|talks|dispute|tension|barrier|policy)\b|\bsection 232\b|\bsection 301\b|\bwto\b|\bchip act\b|\bchips act\b|\btechnology transfer\b|\bdecoupl|\bre.?shor|\bfriend.?shor|\bnearshor|\bsupply.chain security\b|\bcross.strait\b|\bchokepoint\b/i;

// Political power centres whose decisions move markets: Washington (White
// House, Congress, the courts, the midterms), Brussels, and Beijing's elite
// politics. Scored just under geopolitics — a shutdown, a plenum or a Supreme
// Court tariff ruling is a market event, not background.
export const POLITICS_RE = /\bwhite house\b|\bcongress(ional)?\b|\bsenate\b|\bhouse (speaker|republicans|democrats|vote|passes|committee)\b|\bspeaker johnson\b|\bgovernment shutdown\b|\bdebt (ceiling|limit)\b|\bappropriations\b|\bcontinuing resolution\b|\breconciliation bill\b|\bsupreme court\b|\bexecutive order\b|\bmidterms?\b|\bimpeach|\bfilibuster\b|\bpentagon\b|\bnational security council\b|\bstate department\b|\brubio\b|\bbessent\b|\bvance\b|\btrump administration\b|\beuropean commission\b|\bvon der leyen\b|\beuropean parliament\b|\beuropean council\b|\bnato\b|\bxi jinping\b|\bpolitburo\b|\bcentral committee\b|\bplenum\b|\bcommunist party\b|\bccp\b|\bnational people's congress\b|\bstate council\b|\bli qiang\b|\bwang yi\b|\bcentral military commission\b|\bbeijing\b.{0,30}\b(warns|vows|rebukes|retaliat|sanction)|\btaiwan affairs office\b|\bmainland affairs council\b|\blai ching.te\b|\bkuomintang\b|\bkmt\b|\bdpp\b/i;

// Market-moving topics we don't otherwise detect. Before these existed, a Fed,
// BoJ or credit headline scored 0 on topic and competed on source alone.
export const RATES_CB_RE = /\bfed\b|\bfederal reserve\b|\bfomc\b|\bfed chair\b|\bpowell\b|\brate (cut|cuts|hike|hikes|decision|path|outlook)\b|\binterest rates?\b|\bmonetary policy\b|\bcentral bank|\becb\b|\blagarde\b|\bbank of england\b|\bboe\b|\bbank of japan\b|\bboj\b|\bpboc\b|\bpeople's bank of china\b|\breserve bank\b|\brba\b|\bmas\b.{0,20}\b(policy|slope|band)\b|\btreasury yields?\b|\bbond yields?\b|\b10.year yield\b|\byield curve\b|\bgilts?\b|\bjgbs?\b|\bbunds?\b|\bquantitative (easing|tightening)\b/i;

export const MACRO_DATA_RE = /\binflation\b|\bdeflation\b|\bcpi\b|\bppi\b|\bpce\b|\bconsumer prices\b|\bproducer prices\b|\bgdp\b|\bnon.?farm\b|\bpayrolls\b|\bjobs report\b|\bunemployment rate\b|\bjobless claims\b|\bpmi\b|\bretail sales\b|\bindustrial (production|output)\b|\bexports? (rose|fell|grew|slumped|jumped|data)\b|\brecession\b|\bstagflation\b|\beconomic (growth|data|slowdown|contraction)\b|\bconsumer (confidence|sentiment)\b/i;

export const CREDIT_RE = /\bdefault(s|ed)?\b|\bbankrupt|\bchapter 11\b|\binsolven|\bcredit (spread|spreads|market|markets|rating|downgrade|crunch|event|risk)\b|\bjunk (bond|bonds|debt)\b|\bhigh.yield\b|\bprivate credit\b|\bleveraged loans?\b|\bcds\b|\bdebt restructur|\bdistressed (debt|bonds?)\b|\bmoody's\b|\bfitch\b|\bs&p global ratings\b|\bbond (sale|issuance|market rout)\b/i;

export const FX_RE = /\bcurrenc(y|ies)\b|\bforex\b|\bfx\b|\bexchange rate\b|\bdevaluat|\bdollar (index|strength|weakness|rall|slid|slump|surg|fall|rise|gain|drop|jump)|\bdxy\b|\byen\b|\byuan\b|\brenminbi\b|\bsterling\b|\bringgit\b|\brupiah\b|\brupee\b|\bbaht\b|\b(singapore|taiwan|hong kong|australian|aussie|canadian) dollar\b|\beuro (rises|falls|slides|gains|weakens|strengthens|hits)\b/i;

export const CHINA_STIMULUS_RE = /\b(china|chinese|beijing)\b.{0,50}\bstimulus\b|\bstimulus\b.{0,50}\b(china|chinese|beijing)\b|\b(china|chinese)('s)? (property|real estate|housing|developers?)\b|\bevergrande\b|\bcountry garden\b|\bvanke\b|\blocal government (debt|financing)\b|\blgfvs?\b|\bspecial treasury bonds\b|\breserve requirement ratio\b|\brrr\b|\bloan prime rate\b|\blpr\b/i;

export const JAPAN_POLICY_RE = /\bbank of japan\b|\bboj\b|\bueda\b|\bjgbs?\b|\btakaichi\b|\bjapanese government\b|\bjapan('s)? (economy|inflation|gdp|wages|finance ministry)\b|\bshunto\b|\bnikkei (225|average|index|stock average)\b|\btokyo\b.{0,30}\bintervene|\byen intervention\b/i;

// Company results and guidance — scored low by default (corporate news already
// has its own weighting in the briefs); it exists so Earnings season can be dialled.
export const EARNINGS_RE = /\bearnings\b|\b(quarterly|annual|half.year|first.half|full.year) (results|profit|loss|revenue|earnings)\b|\bresults\b.{0,30}\b(beat|miss|top|exceed)|\b(beats?|misses|tops|topped|exceeds?) (estimates|forecasts|expectations|consensus)\b|\bguidance\b|\bprofit (warning|forecast|outlook)\b|\b(raises|cuts|lowers|lifts|reaffirms) (its )?(guidance|forecast|outlook)\b|\beps\b|\bnet (profit|income)\b|\boperating profit\b|\brevenue (rose|fell|grew|jumped|slumped|declined)\b/i;

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC REGISTRY — one entry per dialable topic (Breaking feed + briefs)
// ═══════════════════════════════════════════════════════════════════════════════
// score      Breaking-feed weight at a Neutral dial (feed rank = best match +
//            20% of any other matches, plus the source bonus).
// briefBoost Multiplier the topic gives company briefings at a Neutral dial.
//            Only the three topics that already outranked everything in the
//            briefs carry one; every other topic is neutral (1) there unless
//            the reader dials it up.
// group      Column the topic sits in on the Focus panel.
// The six topics marked NEW had no weight before (scored 0); their defaults sit
// at or below Oil / AI so that adding them does not reshuffle the feed.
export const TOPIC_GROUPS = [
  { id:"geo",   label:"Geopolitics & policy" },
  { id:"macro", label:"Macro & rates" },
  { id:"tech",  label:"Companies & themes" },
  { id:"custom", label:"Your topics" },   // reader-added keyword topics
];

export const TOPICS = [
  { id:"geo",      label:"Geopolitics",     group:"geo",   score:50, briefBoost:1.3, re:GEOPOLITICS_RE },
  { id:"trade",    label:"Trade policy",    group:"geo",   score:45, briefBoost:1.3, re:TRADE_POLICY_RE },
  { id:"politics", label:"Politics",        group:"geo",   score:45, briefBoost:1,   re:POLITICS_RE },
  { id:"china",    label:"China stimulus",  group:"geo",   score:35, briefBoost:1,   re:CHINA_STIMULUS_RE },  // NEW
  { id:"japan",    label:"Japan policy",    group:"geo",   score:30, briefBoost:1,   re:JAPAN_POLICY_RE },    // NEW
  { id:"rates",    label:"Rates & CBs",     group:"macro", score:40, briefBoost:1,   re:RATES_CB_RE },        // NEW
  { id:"macro",    label:"Macro data",      group:"macro", score:35, briefBoost:1,   re:MACRO_DATA_RE },      // NEW
  { id:"oil",      label:"Oil & energy",    group:"macro", score:40, briefBoost:1,
    re:/oil price|crude oil|\bbrent\b|\bwti\b|\bopec\b|oil supply|oil demand|oil output|lng price|gas price|energy (price|crisis|shock|supply|disruption)/i },
  { id:"credit",   label:"Credit",          group:"macro", score:35, briefBoost:1,   re:CREDIT_RE },          // NEW
  { id:"fx",       label:"FX",              group:"macro", score:30, briefBoost:1,   re:FX_RE },              // NEW
  // Semiconductor & electronics supply chain — the read-through on AI capex and
  // the subject Taiwan's business papers break first; level with geopolitics.
  { id:"semis",    label:"Semis supply chain", group:"tech", score:50, briefBoost:1.3, re:SEMI_SUPPLY_CHAIN_RE },
  { id:"ai",       label:"AI buildout",     group:"tech",  score:35, briefBoost:1,
    re:/artificial intelligence|generative ai|\bai chip\b|\bai model\b|\bai regulation\b|\bai act\b|\bai infrastructure\b|large language model|\bllm\b|\bdeepseek\b|\bopenai\b|\banthropic\b|\bchatgpt\b|gpu.*data.?center|data.?center.*ai|ai.*data.?center|hyperscaler|compute cluster|foundation model/i },
  { id:"musk",     label:"Musk companies",  group:"tech",  score:40, briefBoost:1,
    re:/elon musk|\bmusk\b|\btesla\b|\bspacex\b|\bstarlink\b|\bxai\b|\bgrok\b|department of government efficiency/i },
  { id:"earnings", label:"Earnings",       group:"tech",  score:25, briefBoost:1,   re:EARNINGS_RE },        // NEW (phase 2)
];
export const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));

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

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC PRESETS — one click sets several Focus dials for a market regime
// ═══════════════════════════════════════════════════════════════════════════════
// Applying a preset sets these dials (fresh 72h clock), returns every other
// Up / Focus / Down to Neutral, and leaves Hide settings and pinned dials alone.
export const TOPIC_PRESETS = [
  { id:"rates",    label:"Rates-driven",          short:"Rates-driven", dials:{ rates:"focus", macro:"up", fx:"up", musk:"down" } },
  { id:"riskoff",  label:"Geopolitical risk-off", short:"Risk-off",     dials:{ geo:"focus", oil:"up", trade:"up", ai:"down" } },
  { id:"aicapex",  label:"AI capex",              short:"AI capex",     dials:{ semis:"focus", ai:"up", politics:"down" } },
  { id:"tradewar", label:"Trade-war escalation",  short:"Trade war",    dials:{ trade:"focus", semis:"up", politics:"up" } },
  { id:"earnings", label:"Earnings season",       short:"Earnings",     dials:{ earnings:"focus", politics:"down" } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET GAUGES — daily moves that suggest dialling a topic up
// ═══════════════════════════════════════════════════════════════════════════════
// Yahoo Finance symbols read through /api/gauges. A move at or beyond the
// threshold (vs the previous session's close) suggests the mapped topics.
// Thresholds are starting assumptions, not calibrated — roughly a 1.5–2σ day
// for each instrument; tune them once you see how often they fire.
//   unit "bp" — the quote is a yield in percent; the move is shown in basis points.
//   upOnly    — only a rise counts (a falling VIX is not news).
export const MARKET_GAUGES = [
  { sym:"BZ=F",     label:"Brent",   unit:"pct", threshold:3,   topics:["oil"] },
  { sym:"^TNX",     label:"UST 10y", unit:"bp",  threshold:10,  topics:["rates"] },
  { sym:"^VIX",     label:"VIX",     unit:"pct", threshold:15,  topics:["geo"], upOnly:true },
  { sym:"JPY=X",    label:"USD/JPY", unit:"pct", threshold:1,   topics:["fx","japan"] },
  { sym:"DX-Y.NYB", label:"DXY",     unit:"pct", threshold:0.8, topics:["fx"] },
  { sym:"^SOX",     label:"SOX",     unit:"pct", threshold:3,   topics:["semis"] },
  { sym:"HYG",      label:"HY credit", unit:"pct", threshold:1, topics:["credit"] },
  { sym:"^HSCE",    label:"HSCEI",   unit:"pct", threshold:3,   topics:["china"] },
];
