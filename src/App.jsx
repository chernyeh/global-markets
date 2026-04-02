import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MSCI GICS SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
const MSCI_SECTORS = [
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
const SECTOR_MAP = Object.fromEntries(MSCI_SECTORS.map(s => [s.code, s]));

// ═══════════════════════════════════════════════════════════════════════════════
// CORPORATE ACTION SIGNAL ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
const SIGNAL_META = {
  SP2: { label:"Strong Positive", short:"▲▲", color:"#fff", bg:"#1b7a3e", border:"#145c2e" },
  SP1: { label:"Positive",        short:"▲",  color:"#1b7a3e", bg:"#e6f4ec", border:"#a8d5b8" },
  N:   { label:"Neutral",         short:"–",  color:"#666",    bg:"#f5f5f5", border:"#ddd"    },
  SN1: { label:"Negative",        short:"▽",  color:"#b84a00", bg:"#fff3ee", border:"#ffccbc" },
  SN2: { label:"Strong Negative", short:"▽▽", color:"#fff",    bg:"#c0392b", border:"#922b21" },
};

// Signal categories — each has a default signal strength and a management flag
const SIGNAL_CATEGORIES = {
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
  MACRO:             { label:"Macro / Policy",       signal:"N",   mgmt:false },
  OTHER:             { label:"Other",                signal:"N",   mgmt:false },
};

// Context flags that UPGRADE signal strength for management events
const WEAKNESS_CONTEXT_PATTERNS = /after (disappointing|poor|weak|dismal|miss|profit warning)|amid (investor|analyst|shareholder) pressure|following (strategic review|underperformance|losses|write[- ]?down)|turnaround|restructur|strategic (overhaul|pivot|reset|review)|under pressure|calls for (change|resignation|shake[- ]?up)|operational (challenges|difficulties|failure)|execution (failure|miss)|replac(es|ing|ed) (CEO|chief)|activist/i;

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS BRIEFS TAB — curated company-level brief columns by market
// ═══════════════════════════════════════════════════════════════════════════════
const NEWS_BRIEF_GROUPS = [
  {
    market: "Singapore",
    flag: "🇸🇬",
    color: "#c0392b",
    sources: ["bt_stocks_watch","edge_sg_stocks_watch","edge_sg_focus","sginvestors","sgx_annc","sg_biz_review"],
    desc: "BT Stocks Watch · Edge Stocks Watch · Edge In Focus · SGinvestors · SGX Announcements",
  },
  {
    market: "Australia",
    flag: "🇦🇺",
    color: "#2e7d32",
    sources: ["afr_street_talk","stockhead_top10","fnarena","market_herald","stockhead_au"],
    desc: "AFR Street Talk · Stockhead Top 10 · FNArena Broker Research · Market Herald",
  },
  {
    market: "Hong Kong / China",
    flag: "🇭🇰",
    color: "#1565c0",
    sources: ["scmp_markets","caixin_briefs","hkex_news","aastocks_hk","etnet_hk"],
    desc: "SCMP Markets Today · Caixin Briefs · HKEX News · AAStocks · ET Net",
  },
  {
    market: "Japan",
    flag: "🇯🇵",
    color: "#6a1b9a",
    sources: ["nikkei_biz_spotlight","nikkei_asia"],
    desc: "Nikkei Biz Spotlight · Nikkei Asia",
  },
  {
    market: "United States",
    flag: "🇺🇸",
    color: "#b84a00",
    sources: ["wsj_heard","wsj_mkt","wsj_global_equities","wsj_global_commodities","seekalpha","wsj","barrons","marketwatch","axios_biz"],
    desc: "WSJ Heard on the Street · WSJ Markets Features · WSJ Global Equities Roundup · WSJ Global Commodities Roundup · Seeking Alpha Earnings · Barron's · MarketWatch · Axios",
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES
// ═══════════════════════════════════════════════════════════════════════════════
const GN = (q,hl="en-US",gl="US",ceid="US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const SOURCES = [
  // ── United States ──────────────────────────────────────────────────────────
  {id:"reuters",tier:1,    country:"US",name:"Reuters Business",       lang:"en",flag:"🇺🇸",url:GN("site:reuters.com business finance")},
  {id:"marketwatch",tier:2,desc:"Dow Jones-owned; strong on US equities, earnings, and retail investor flow.",country:"US",name:"MarketWatch",            lang:"en",flag:"🇺🇸",url:GN("site:marketwatch.com markets stocks")},
  {id:"wsj",tier:2,        country:"US",name:"WSJ Markets",            lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",paywall:true},
  {id:"wsj2",tier:2,       country:"US",name:"WSJ Business",           lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness",paywall:true},
  {id:"wsj_heard",tier:2,  desc:"WSJ Heard on the Street — flagship stock analysis column; buy/sell calls, earnings analysis, company-specific deep dives. Highest-signal WSJ feed for equity investors.", country:"US",name:"WSJ Heard on the Street",lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSHEARDONTHESTREET",paywall:true},
  {id:"wsj_mkt",tier:2,    desc:"WSJ Markets Features — longer-form WSJ market analysis, stock-specific features, and sector deep dives beyond daily news.",                                              country:"US",name:"WSJ Markets Features",   lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",paywall:true},
  {id:"wsj_global_equities",tier:2,desc:"WSJ Global Equities Roundup: Market Talk — daily global equity market insights, regional trading activity, and stock-specific catalysts across major exchanges.",country:"US",name:"WSJ Global Equities Roundup",lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSGLOBALEQUITIESROUNDUP",paywall:true},
  {id:"wsj_global_commodities",tier:2,desc:"WSJ Global Commodities Roundup: Market Talk — daily commodity price moves, supply/demand dynamics, and macroeconomic impacts on oil, metals, and agricultural markets.",country:"US",name:"WSJ Global Commodities Roundup",lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSGLOBALCOMMODITIESROUNDUP",paywall:true},
  {id:"bloomberg",tier:1,  country:"US",name:"Bloomberg Markets",      lang:"en",flag:"🇺🇸",url:"https://feeds.bloomberg.com/markets/news.rss",paywall:true},
  {id:"bloomberg2",tier:1, country:"US",name:"Bloomberg Business",     lang:"en",flag:"🇺🇸",url:"https://feeds.bloomberg.com/business/news.rss",paywall:true},
  {id:"ft",tier:2,         country:"US",name:"Financial Times",        lang:"en",flag:"🇺🇸",url:GN("site:ft.com markets economy business"),paywall:true},
  {id:"nyt",tier:2,        country:"US",name:"NY Times Business",      lang:"en",flag:"🇺🇸",url:"https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",paywall:true},
  {id:"axios_biz",tier:2,  desc:"Axios — smart brevity format; fast, context-rich on tech, policy, and market-moving Washington news.",country:"US",name:"Axios Business",         lang:"en",flag:"🇺🇸",url:GN("site:axios.com business economy markets finance")},
  {id:"wapo",tier:2,       desc:"Washington Post — authoritative on US politics, policy, and national security; essential for Washington-driven market moves.",country:"US",name:"Washington Post",        lang:"en",flag:"🇺🇸",url:GN("site:washingtonpost.com business economy policy"),paywall:true},
  {id:"barrons",tier:2,    desc:"Barron\'s — Dow Jones\'s premier investment weekly; stock-specific analysis, ratings, earnings previews, and buy/sell calls. Highly actionable for fundamental investors.",country:"US",name:"Barron\'s",              lang:"en",flag:"🇺🇸",url:GN("site:barrons.com stocks earnings analysis"),paywall:true},
  {id:"seekalpha",tier:3,  desc:"Seeking Alpha Earnings — earnings beats/misses, dividend announcements, and analyst rating changes. Filtered to high-signal corporate events only.",country:"US",name:"Seeking Alpha Earnings",  lang:"en",flag:"🇺🇸",url:GN("site:seekingalpha.com earnings beat miss dividend CEO acquires merger")},
  {id:"prnewswire",tier:3, desc:"PR Newswire — filtered to primary corporate events: earnings results, M&A, dividend changes, and CEO/CFO appointments only.",country:"US",name:"PR Newswire",            lang:"en",flag:"🇺🇸",url:GN("site:prnewswire.com quarterly results OR earnings per share OR acquires OR merger agreement OR dividend OR appoints CEO OR names CFO")},
  {id:"semafor",tier:2,    desc:"Semafor Business — sharp, independently sourced business and finance journalism; well-connected on Wall Street, Washington policy, and global capital flows.",country:"US",name:"Semafor Business",       lang:"en",flag:"🇺🇸",url:GN("site:semafor.com business finance economy markets")},
  {id:"politico",tier:2,   desc:"Politico Economy — authoritative on US fiscal policy, Fed regulation, trade, and Washington\'s influence on markets. Essential for policy-driven investment themes.",country:"US",name:"Politico Economy",       lang:"en",flag:"🇺🇸",url:GN("site:politico.com economy finance tax trade regulation")},
  // ── Germany ────────────────────────────────────────────────────────────────
  {id:"handelsblatt",tier:2,  desc:"Handelsblatt — Germany\'s leading financial daily; required reading for DAX, German industry and European monetary policy.",               country:"DE",name:"Handelsblatt",        lang:"de",flag:"🇩🇪",url:"https://www.handelsblatt.com/contentexport/feed/schlagzeilen",paywall:true},
  {id:"handelsblatt_en",tier:2,desc:"Handelsblatt English — curated English-language coverage of German business and European economic news.",                                 country:"DE",name:"Handelsblatt (EN)",    lang:"en",flag:"🇩🇪",url:GN("site:handelsblatt.com english economy business"),paywall:true},
  {id:"faz",tier:2,           desc:"FAZ (Frankfurter Allgemeine) — Germany\'s newspaper of record; authoritative on politics, economics and ECB.",                             country:"DE",name:"FAZ",                  lang:"de",flag:"🇩🇪",url:"https://www.faz.net/rss/aktuell",paywall:true},
  {id:"faz_finance",tier:2,   desc:"FAZ Finance — financial markets, banking and investment coverage from Germany\'s most authoritative broadsheet.",                          country:"DE",name:"FAZ Finance",          lang:"de",flag:"🇩🇪",url:GN("site:faz.net Wirtschaft Finanzen","de","DE","DE:de")},
  {id:"spiegel_de",tier:2,    desc:"Der Spiegel (International) — Germany\'s top news magazine; investigative, with strong European and geopolitical depth in English.",        country:"DE",name:"Der Spiegel",          lang:"en",flag:"🇩🇪",url:"https://www.spiegel.de/international/index.rss"},
  {id:"sz_de",tier:2,         desc:"Süddeutsche Zeitung — centrist German broadsheet; strong on investigative journalism and European affairs.",                               country:"DE",name:"Süddeutsche Zeitung",  lang:"de",flag:"🇩🇪",url:GN("site:sueddeutsche.de Wirtschaft Finanzen","de","DE","DE:de")},
  {id:"dw_de",tier:1,         desc:"Deutsche Welle Business — Germany\'s international broadcaster; English-language coverage of German and European economic news.",           country:"DE",name:"Deutsche Welle",       lang:"en",flag:"🇩🇪",url:"https://rss.dw.com/xml/rss-en-bus"},
  {id:"reuters_de",tier:1,    desc:"Reuters Germany — wire coverage of German markets, DAX companies and European economic policy.",                                          country:"DE",name:"Reuters Germany",      lang:"en",flag:"🇩🇪",url:GN("site:reuters.com Germany economy business finance DAX")},
  {id:"bloom_de",tier:1,      desc:"Bloomberg Germany — markets and corporate coverage with a Germany/DACH focus.",                                                           country:"DE",name:"Bloomberg Germany",    lang:"en",flag:"🇩🇪",url:GN("site:bloomberg.com Germany economy business"),paywall:true},
  // ── Canada ─────────────────────────────────────────────────────────────────
  {id:"globe_mail",tier:2,desc:"Canada\'s newspaper of record; best source for Bay Street and TSX corporate news.", country:"CA",name:"Globe and Mail",         lang:"en",flag:"🇨🇦",url:GN("site:theglobeandmail.com business economy markets"),paywall:true},
  {id:"fin_post",tier:2,desc:"Canada\'s leading dedicated financial daily; covers TSX, commodities, and energy.",   country:"CA",name:"Financial Post",         lang:"en",flag:"🇨🇦",url:GN("site:financialpost.com"),paywall:true},
  {id:"bnn",tier:2,desc:"BNN Bloomberg\'s Canadian TV wire; fast-moving market updates and Bay Street commentary.",        country:"CA",name:"BNN Bloomberg Canada",   lang:"en",flag:"🇨🇦",url:GN("site:bnnbloomberg.ca")},
  {id:"reuters_ca",tier:1,desc:"Reuters\' Canada-focused feed; strong on energy, mining, and macro.", country:"CA",name:"Reuters Canada",         lang:"en",flag:"🇨🇦",url:GN("site:reuters.com Canada economy business")},
  {id:"bloom_ca",tier:1,desc:"Bloomberg\'s Canada feed; authoritative on oil sands, housing, and BoC policy.",   country:"CA",name:"Bloomberg Canada",       lang:"en",flag:"🇨🇦",url:GN("site:bloomberg.com Canada economy markets"),paywall:true},
  // ── Nikkei Asia ──────────────────────────────────────────────────────────
  {id:"nikkei_asia",tier:2,   desc:"Nikkei Asia — premier English-language source for Asian corporate news; essential for Japan, Korea, SEA company-level coverage.",          country:"JP",name:"Nikkei Asia",          lang:"en",flag:"🇯🇵",url:"https://asia.nikkei.com/rss/feed/nar",paywall:true},
  {id:"nikkei_biz_spotlight",tier:2,desc:"Nikkei Asia Business Spotlight — company-specific deep dives; earnings, management changes, and strategic pivots for Japan and Asia-listed corporates.",country:"JP",name:"Nikkei Biz Spotlight",lang:"en",flag:"🇯🇵",url:GN("site:asia.nikkei.com business companies"),paywall:true},
  // ── Singapore ──────────────────────────────────────────────────────────────
  {id:"bt_sg",tier:2,desc:"SGX\'s go-to daily; essential for listed companies, REITs, and MAS policy.",      country:"SG",name:"Business Times SG",      lang:"en",flag:"🇸🇬",url:GN("site:businesstimes.com.sg"),paywall:true},
  {id:"bt_stocks_watch",tier:2,desc:"BT Stocks Watch — daily BT column flagging company-specific news and trading catalysts for SGX-listed stocks. High-signal micro feed.",country:"SG",name:"BT Stocks Watch",lang:"en",flag:"🇸🇬",url:GN("site:businesstimes.com.sg stocks-watch"),paywall:true},
  {id:"sginvestors",tier:3,desc:"SGinvestors.io — aggregates BT, The Edge, CNA and SGX announcements; reliable daily digest of SGX-listed company news including BT Stocks Watch.",country:"SG",name:"SGinvestors.io",lang:"en",flag:"🇸🇬",url:"https://sginvestors.io/feed"},
  {id:"edge_sg_stocks_watch",tier:2,desc:"The Edge SG Stocks Watch — daily column covering SGX-listed company events, corporate actions, and trading catalysts. High-signal micro feed.",country:"SG",name:"Edge SG Stocks Watch",lang:"en",flag:"🇸🇬",url:GN("site:theedgesingapore.com stocks-watch"),paywall:true},
  {id:"edge_sg_focus",tier:2,desc:"The Edge SG In Focus — in-depth stock analysis, executive interviews, and corporate movements. Best source for management quality signals on SGX.",country:"SG",name:"Edge SG In Focus",lang:"en",flag:"🇸🇬",url:GN("site:theedgesingapore.com capital focus"),paywall:true},
  {id:"cna_sg",tier:2,desc:"Singapore\'s public broadcaster; reliable on government policy and Southeast Asian macro.",     country:"SG",name:"CNA Business",           lang:"en",flag:"🇸🇬",url:GN("site:channelnewsasia.com business")},
  {id:"edge_sg",tier:3,desc:"In-depth weekly; known for contrarian analysis on SGX stocks and property.",    country:"SG",name:"The Edge Singapore",     lang:"en",flag:"🇸🇬",url:GN("site:theedgesingapore.com"),paywall:true},
  {id:"reuters_sg",tier:1,desc:"Reuters\' Singapore hub; covers regional trade flows and Southeast Asian markets.", country:"SG",name:"Reuters Singapore",       lang:"en",flag:"🇸🇬",url:GN("site:reuters.com Singapore economy business")},
  {id:"bloom_sg",tier:1,desc:"Bloomberg Singapore; strong on central bank, tech, and broader ASEAN.",   country:"SG",name:"Bloomberg Singapore",     lang:"en",flag:"🇸🇬",url:GN("site:bloomberg.com Singapore markets economy"),paywall:true},
  {id:"sgx_annc",tier:3,      desc:"SGX company announcements — earnings, dividends, rights issues, M&A and corporate actions from SGX-listed companies. Most actionable micro feed for SGX investors.",country:"SG",name:"SGX Announcements",    lang:"en",flag:"🇸🇬",url:GN("SGX company earnings dividend rights issue acquisition Singapore announcement")},
  {id:"sg_biz_review",tier:3, desc:"Singapore Business Review — company-specific news on SGX listings, deal flow, and corporate actions.",                                      country:"SG",name:"SG Business Review",   lang:"en",flag:"🇸🇬",url:GN("site:sbr.com.sg")},
  // ── Hong Kong ──────────────────────────────────────────────────────────────
  {id:"scmp",tier:2,desc:"Hong Kong\'s English paper of record; best English-language lens on China policy and HKEX.",       country:"HK",name:"South China Morning Post",lang:"en",flag:"🇭🇰",url:GN("site:scmp.com business finance"),paywall:true},
  {id:"scmp_markets",tier:2,desc:"SCMP Markets Today — daily column unpacking HK and China market moves, company results, and trading catalysts. Direct equivalent of BT Stocks Watch for HKEX.",country:"HK",name:"SCMP Markets Today",lang:"en",flag:"🇭🇰",url:GN("site:scmp.com markets-today OR business-briefing"),paywall:true},
  {id:"mingtiandi",tier:3,desc:"Specialist in China and Asia real estate; essential for REIT and property investors.", country:"HK",name:"Mingtiandi",             lang:"en",flag:"🇭🇰",url:GN("site:mingtiandi.com")},
  {id:"hket",tier:2,desc:"Hong Kong Economic Times — HK\'s top Chinese financial daily, auto-translated.",       country:"HK",name:"香港經濟日報 HKET",        lang:"zh",flag:"🇭🇰",url:GN("site:hket.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"mingpao",tier:2,desc:"Ming Pao Finance — respected HK Chinese daily; strong on local markets and Mainland flows.",    country:"HK",name:"明報財經 Ming Pao",       lang:"zh",flag:"🇭🇰",url:GN("site:mingpao.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"reuters_hk",tier:1,desc:"Reuters\' Hong Kong desk; key for Hang Seng, IPOs, and China-HK market mechanics.", country:"HK",name:"Reuters Hong Kong",       lang:"en",flag:"🇭🇰",url:GN("site:reuters.com \"Hong Kong\" economy business finance")},
  {id:"bloom_hk",tier:1,desc:"Bloomberg HK; covers Hang Seng constituents, H-shares, and property sector.",   country:"HK",name:"Bloomberg Hong Kong",     lang:"en",flag:"🇭🇰",url:GN("site:bloomberg.com \"Hong Kong\" markets economy"),paywall:true},
  // ── Korea ──────────────────────────────────────────────────────────────────
  {id:"ked",tier:2,desc:"Korea Economic Daily's English arm; first-mover on Samsung, SK, and Korean chaebol.",        country:"KR",name:"KED Global",             lang:"en",flag:"🇰🇷",url:GN("site:kedglobal.com"),paywall:true},
  {id:"ktimes",tier:2,desc:"Korea Times Business — broad English coverage of Korean economy and trade policy.",      country:"KR",name:"Korea Times Business",    lang:"en",flag:"🇰🇷",url:"https://feed.koreatimes.co.kr/k/business.xml",paywall:true},
  {id:"kr_herald",tier:2,desc:"Korea Herald Economy — accessible English daily; good for foreign investor context.",  country:"KR",name:"Korea Herald Business",  lang:"en",flag:"🇰🇷",url:"https://www.koreaherald.com/rss/kh_Business",paywall:true},
  {id:"yonhap",tier:1,desc:"Korea's official wire agency; authoritative on government policy, trade, and North Korea risk.",     country:"KR",name:"Yonhap Economy",         lang:"en",flag:"🇰🇷",url:"https://en.yna.co.kr/RSS/economy.xml"},
  {id:"yonhap2",tier:1,desc:"Yonhap financial sub-feed; focused on markets, earnings, and corporate actions.",     country:"KR",name:"Yonhap Finance",          lang:"en",flag:"🇰🇷",url:"https://en.yna.co.kr/RSS/industry.xml"},
  {id:"hankyung",tier:2,desc:"Hankyung (Korean Economic Daily) — the Bloomberg of Korea, auto-translated; most read by fund managers.",   country:"KR",name:"한국경제 Hankyung",        lang:"ko",flag:"🇰🇷",url:"https://www.hankyung.com/feed/economy"},
  {id:"maeil",tier:2,desc:"Maeil Business Newspaper — Korea's oldest financial daily, auto-translated; strong on industry.",      country:"KR",name:"매일경제 Maeil",           lang:"ko",flag:"🇰🇷",url:"https://www.mk.co.kr/rss/30100041/"},
  {id:"chosunbiz",tier:2,desc:"Chosun's business arm — widely read by Korean executives; covers strategy and M&A.",  country:"KR",name:"조선비즈 Chosunbiz",      lang:"ko",flag:"🇰🇷",url:"https://biz.chosun.com/arc/outboundfeeds/rss/"},
  {id:"reuters_kr",tier:1,desc:"Reuters Korea; covers Samsung, semiconductors, and BoK monetary policy in English.", country:"KR",name:"Reuters Korea",           lang:"en",flag:"🇰🇷",url:GN("site:reuters.com \"South Korea\" economy business")},
  {id:"bloom_kr",tier:1,desc:"Bloomberg Korea; strong on Korean equities, currency, and export data.",   country:"KR",name:"Bloomberg Korea",         lang:"en",flag:"🇰🇷",url:GN("site:bloomberg.com \"South Korea\" markets economy"),paywall:true},
  // ── Taiwan ─────────────────────────────────────────────────────────────────
  {id:"taipei_t",tier:2,desc:"Taiwan's main English daily; useful for government policy, cross-strait tension, and macro.",   country:"TW",name:"Taipei Times Business",  lang:"en",flag:"🇹🇼",url:GN("site:taipeitimes.com business"),paywall:true},
  {id:"focus_tw",tier:2,desc:"CNA's English Taiwan feed; official wire — fast on policy announcements and corporate filings.",   country:"TW",name:"Focus Taiwan CNA",       lang:"en",flag:"🇹🇼",url:GN("site:focustaiwan.tw business"),paywall:true},
  {id:"udn_money",tier:2,desc:"UDN Money — Taiwan's major Mandarin financial portal, auto-translated; strong on TSMC and tech supply chain.",  country:"TW",name:"經濟日報 UDN Money",       lang:"zh",flag:"🇹🇼",url:GN("site:money.udn.com","zh-TW","TW","TW:zh-Hant")},
  {id:"ctee",tier:2,desc:"China Times Economy — influential Mandarin business paper, auto-translated; covers Taiwan equities and property.",       country:"TW",name:"工商時報 CTEE",            lang:"zh",flag:"🇹🇼",url:GN("site:ctee.com.tw","zh-TW","TW","TW:zh-Hant")},
  {id:"digitimes",tier:2,desc:"The definitive English source for Taiwan semiconductor, electronics, and supply chain intelligence.",  country:"TW",name:"DigiTimes",              lang:"en",flag:"🇹🇼",url:GN("site:digitimes.com Taiwan semiconductor technology supply chain"),paywall:true},
  {id:"reuters_tw",tier:1,desc:"Reuters Taiwan; essential for TSMC, semiconductors, and US-China tech trade.", country:"TW",name:"Reuters Taiwan",          lang:"en",flag:"🇹🇼",url:GN("site:reuters.com Taiwan economy business")},
  {id:"bloom_tw",tier:1,desc:"Bloomberg Taiwan; covers TWD, TAIEX, and chip sector in depth.",   country:"TW",name:"Bloomberg Taiwan",        lang:"en",flag:"🇹🇼",url:GN("site:bloomberg.com Taiwan markets economy"),paywall:true},
  // ── India ──────────────────────────────────────────────────────────────────
  {id:"econ_times",tier:2,desc:"India's most-read financial daily; essential for NSE/BSE, RBI policy, and conglomerates.", country:"IN",name:"Economic Times",         lang:"en",flag:"🇮🇳",url:"https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",paywall:true},
  {id:"biz_std",tier:2,desc:"Business Standard — analyst-favourite for macroeconomic depth and policy commentary.",    country:"IN",name:"Business Standard",      lang:"en",flag:"🇮🇳",url:"https://www.business-standard.com/rss/markets-106.rss",paywall:true},
  {id:"mint",tier:2,desc:"Mint/Livemint — HT-owned; strong on startups, fintech, and technology investments.",       country:"IN",name:"Mint Markets",           lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/markets",paywall:true},
  {id:"mint2",tier:2,desc:"Mint markets sub-feed; focused on Sensex, Nifty, and equity-specific news.",      country:"IN",name:"Mint Companies",         lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/companies",paywall:true},
  {id:"mint3",tier:2,desc:"Mint companies sub-feed; earnings, M&A, and corporate strategy.",      country:"IN",name:"Mint Economy",            lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/economy",paywall:true},
  {id:"hindubiz",tier:2,desc:"The Hindu BusinessLine — rigorous, less breathless than peers; good for agriculture and rural economy.",   country:"IN",name:"Hindu BusinessLine",     lang:"en",flag:"🇮🇳",url:"https://www.thehindubusinessline.com/?service=rss",paywall:true},
  {id:"fin_exp",tier:2,desc:"Financial Express — Indian Express Group's financial arm; strong on banking and government schemes.",    country:"IN",name:"Financial Express",       lang:"en",flag:"🇮🇳",url:"https://www.financialexpress.com/feed/",paywall:true},
  {id:"moneyctrl",tier:2,desc:"Moneycontrol — India's highest-traffic financial site; fastest on markets and breaking corporate news.",  country:"IN",name:"Moneycontrol Markets",   lang:"en",flag:"🇮🇳",url:"https://www.moneycontrol.com/rss/business.xml",paywall:true},
  {id:"cnbctv18",tier:2,desc:"CNBC TV18 — real-time Indian market television wire; good for intraday flow and broker commentary.",   country:"IN",name:"CNBC-TV18 Markets",      lang:"en",flag:"🇮🇳",url:"https://www.cnbctv18.com/commonfeeds/v1/eng/rss/market.xml"},
  {id:"forbes_in",tier:2,desc:"Forbes India — features-driven; valuable for billionaire moves, startup funding, and deals.",  country:"IN",name:"Forbes India",           lang:"en",flag:"🇮🇳",url:GN("site:forbesindia.com economy business markets"),paywall:true},
  {id:"reuters_in",tier:1,desc:"Reuters India; authoritative on RBI, macro data, and large-cap corporates in English.", country:"IN",name:"Reuters India",           lang:"en",flag:"🇮🇳",url:GN("site:reuters.com India economy business markets")},
  {id:"bloom_in",tier:1,desc:"Bloomberg India; covers Sensex, rupee, and major conglomerates like Reliance and Adani.",   country:"IN",name:"Bloomberg India",         lang:"en",flag:"🇮🇳",url:GN("site:bloomberg.com India markets economy"),paywall:true},
  // ── Australia ──────────────────────────────────────────────────────────────
  {id:"afr",tier:2,desc:"Australia's Financial Review — the AFR; essential for ASX, RBA policy, and mining.",        country:"AU",name:"Australian Fin. Review", lang:"en",flag:"🇦🇺",url:GN("site:afr.com markets economy business"),paywall:true},
  {id:"afr_street_talk",tier:2,desc:"AFR Street Talk — Australia's most important M&A and deals column; breaks news on acquisitions, capital raisings, IPOs, and boardroom changes before they're public.",country:"AU",name:"AFR Street Talk",lang:"en",flag:"🇦🇺",url:GN("site:afr.com street-talk"),paywall:true},
  {id:"stockhead_top10",tier:3,desc:"Stockhead Top 10 at 11 — daily briefing of the top ASX movers with company-specific context. Excellent micro signal feed for small/mid-caps.",country:"AU",name:"Stockhead Top 10",lang:"en",flag:"🇦🇺",url:GN("site:stockhead.com.au top-10")},
  {id:"fnarena",tier:3,desc:"FNArena — aggregates ASX broker research, upgrades/downgrades, target price changes, and earnings analysis from major Australian broking houses. Essential for analyst signal tracking.",country:"AU",name:"FNArena Broker Research",lang:"en",flag:"🇦🇺",url:GN("site:fnarena.com")},
  {id:"guardian_au",tier:2,desc:"The Guardian Australia Business — quality long-form; good for ESG, regulation, and macro critique.",country:"AU",name:"Guardian Australia Business",lang:"en",flag:"🇦🇺",url:"https://www.theguardian.com/australia-news/rss"},
  {id:"the_aus",tier:2,desc:"The Australian Business — Murdoch flagship; strong on resources, infrastructure, and government.",    country:"AU",name:"The Australian Business",lang:"en",flag:"🇦🇺",url:GN("The Australian newspaper business economy finance"),paywall:true},
  {id:"abc_au",tier:2,desc:"ABC News Australia Business — public broadcaster; balanced and strong on commodities and rural economy.",     country:"AU",name:"ABC Business",           lang:"en",flag:"🇦🇺",url:"https://www.abc.net.au/news/feed/51120/rss.xml"},
  {id:"smh",tier:2,desc:"Sydney Morning Herald Business — one of Australia's oldest mastheads; good for property and finance.",        country:"AU",name:"Sydney Morning Herald",  lang:"en",flag:"🇦🇺",url:"https://www.smh.com.au/rss/feed.xml"},
  {id:"reuters_au",tier:1,desc:"Reuters Australia; covers RBA, iron ore, LNG, and major ASX corporates.", country:"AU",name:"Reuters Australia",       lang:"en",flag:"🇦🇺",url:GN("site:reuters.com Australia economy business")},
  {id:"bloom_au",tier:1,desc:"Bloomberg Australia; strong on RBA rate decisions, mining majors, and AUD moves.",   country:"AU",name:"Bloomberg Australia",     lang:"en",flag:"🇦🇺",url:GN("site:bloomberg.com Australia markets economy"),paywall:true},
  {id:"stockhead_au",tier:3, desc:"Stockhead — specialist ASX small/mid-cap company news; earnings, capital raises, resource discoveries, and broker calls.",  country:"AU",name:"Stockhead ASX",        lang:"en",flag:"🇦🇺",url:GN("site:stockhead.com.au")},
  {id:"market_herald",tier:3, desc:"The Market Herald — Australia's leading ASX company news wire; covers earnings, placements, and corporate actions across all listed companies.", country:"AU",name:"The Market Herald",    lang:"en",flag:"🇦🇺",url:"https://themarketonline.com.au/feed"},
  // ── China ──────────────────────────────────────────────────────────────────
  {id:"kr36",tier:3,desc:"36Kr — China's leading tech and startup news site, auto-translated; essential for VC deals and unicorns.",        country:"CN",name:"36Kr 快讯",              lang:"zh",flag:"🇨🇳",url:GN("36氪 融资 科技 独角兽","zh-CN","CN","CN:zh-Hans")},
  {id:"caixin",tier:2,desc:"Caixin Global — China's most credible independent financial journalism; known for breaking regulatory news.",     country:"CN",name:"Caixin Global",          lang:"en",flag:"🇨🇳",url:GN("site:caixinglobal.com economy finance"),paywall:true},
  {id:"caixin_briefs",tier:2,desc:"Caixin News Briefs — short-form company and regulatory news items from Caixin; captures smaller announcements not in headline feeds. Equivalent of BT Stocks Watch for China.",country:"CN",name:"Caixin News Briefs",lang:"en",flag:"🇨🇳",url:GN("site:caixinglobal.com news-briefs OR brief"),paywall:true},
  {id:"xinhua",tier:1,desc:"Xinhua — China's state wire; first with official announcements, policy signals, and economic data releases.",      country:"CN",name:"Xinhua Finance",           lang:"en",flag:"🇨🇳",url:GN("site:english.news.cn OR site:xinhuanet.com economy finance")},
  {id:"cgtn",tier:1,desc:"CGTN Business — state broadcaster's English arm; reflects official Chinese economic narrative.",        country:"CN",name:"CGTN Business",             lang:"en",flag:"🇨🇳",url:"https://www.cgtn.com/subscribe/rss/section/business.xml"},
  {id:"chinadaily",tier:2,desc:"China Daily Business — state-owned English daily; useful for understanding Beijing's policy framing.",  country:"CN",name:"China Daily Business",     lang:"en",flag:"🇨🇳",url:GN("site:chinadaily.com.cn business economy")},
  {id:"yicai",tier:2,desc:"Yicai Global — respected Shanghai-based financial outlet; strong on Chinese equities and corporate moves.",       country:"CN",name:"Yicai Global",            lang:"en",flag:"🇨🇳",url:GN("site:yicaiglobal.com")},
  {id:"globaltimes",tier:2,desc:"Global Times Economy — nationalistic state tabloid; tracks how Beijing wants economic news framed.", country:"CN",name:"Global Times Economy",     lang:"en",flag:"🇨🇳",url:GN("site:globaltimes.cn economy")},
  {id:"peoples_d",tier:2,desc:"People's Daily Economy — the CCP organ; essential for reading between the lines on official policy.",   country:"CN",name:"People's Daily",          lang:"en",flag:"🇨🇳",url:"https://en.people.cn/rss/economy.xml"},
  {id:"reuters_cn",tier:1,desc:"Reuters China; independent and fast on PBOC moves, trade data, and major corporate events.", country:"CN",name:"Reuters China",            lang:"en",flag:"🇨🇳",url:GN("site:reuters.com China economy business finance")},
  {id:"bloom_cn",tier:1,desc:"Bloomberg China; authoritative on yuan, PBOC policy, and major index constituents.",   country:"CN",name:"Bloomberg China",          lang:"en",flag:"🇨🇳",url:GN("site:bloomberg.com China markets economy"),paywall:true},
  // ── Israel ─────────────────────────────────────────────────────────────────
  {id:"globes_il",tier:2,desc:"Globes — Israel's financial daily of record; essential for TASE, Israeli tech IPOs, and shekel.",  country:"IL",name:"Globes Israel",            lang:"en",flag:"🇮🇱",url:GN("site:en.globes.co.il")},
  {id:"jpost_il",tier:2,desc:"Jerusalem Post Business — Israel's most-read English paper; covers Israeli economy, startups, and US-Israel trade.",   country:"IL",name:"Jerusalem Post Business",  lang:"en",flag:"🇮🇱",url:GN("site:jpost.com business innovation technology")},
  {id:"toi_il",tier:2,desc:"Times of Israel — well-sourced English outlet; strong on Israeli politics, tech sector, and regional conflict impact.",     country:"IL",name:"Times of Israel",          lang:"en",flag:"🇮🇱",url:GN("site:timesofisrael.com")},
  {id:"haaretz_il",tier:2,desc:"Haaretz — Israel's liberal paper of record; strong investigative coverage of business, policy, and governance.", country:"IL",name:"Haaretz Israel",           lang:"en",flag:"🇮🇱",url:GN("site:haaretz.com Israel economy business technology"),paywall:true},
  {id:"ctech_il",tier:3,desc:"CTech (Calcalist) — Israel's top English-language tech and VC publication; best for Israeli startup ecosystem.",   country:"IL",name:"Calcalist CTech",          lang:"en",flag:"🇮🇱",url:GN("site:calcalistech.com")},
  {id:"calcalist",tier:3,desc:"כלכליסט — Israel's dedicated Hebrew financial daily, auto-translated; first-mover on TASE and corporate news.",  country:"IL",name:"כלכליסט Calcalist",        lang:"he",flag:"🇮🇱",url:GN("site:calcalist.co.il","iw","IL","IL:he")},
  {id:"reuters_il",tier:1,desc:"Reuters Israel; covers Israeli equities, defence sector, and economic fallout from regional conflict.", country:"IL",name:"Reuters Israel",           lang:"en",flag:"🇮🇱",url:GN("site:reuters.com Israel")},
  {id:"bloom_il",tier:1,desc:"Bloomberg Israel; strong on shekel, TASE index, and Israeli tech M&A.",   country:"IL",name:"Bloomberg Israel",         lang:"en",flag:"🇮🇱",url:GN("site:bloomberg.com Israel economy markets shekel"),paywall:true},
  // ── Middle East / Gulf ─────────────────────────────────────────────────────
  {id:"arabnews",tier:2,desc:"Arab News — Saudi Arabia's flagship English daily; first on Vision 2030 projects and Saudi policy.",    country:"ME",name:"Arab News",               lang:"en",flag:"🌍",url:GN("site:arabnews.com")},
  {id:"arabnews_biz",tier:2,desc:"Arab News Economy — dedicated business feed; covers Gulf M&A, energy deals, and giga-projects.",country:"ME",name:"Arab News Economy",       lang:"en",flag:"🌍",url:GN("site:arabnews.com economy energy")},
  {id:"national_ae",tier:2,desc:"The National — Abu Dhabi's quality English broadsheet; best for UAE sovereign wealth and ADNOC news.", country:"ME",name:"The National UAE",        lang:"en",flag:"🌍",url:GN("site:thenationalnews.com business economy energy")},
  {id:"gulfnews",tier:2,desc:"Gulf News — Dubai-based; wide regional coverage of UAE, Saudi, and Gulf corporate news.",    country:"ME",name:"Gulf News Business",      lang:"en",flag:"🌍",url:GN("site:gulfnews.com business economy")},
  {id:"arabianbiz",tier:3,desc:"Arabian Business — pan-Gulf English magazine; strong on real estate, construction, and billionaire profiles.",  country:"ME",name:"Arabian Business",        lang:"en",flag:"🌍",url:"https://www.arabianbusiness.com/feed"},
  {id:"agbi",tier:3,desc:"AGBI — Gulf Business Intelligence; specialist in GCC investment, trade, and financial regulation.",        country:"ME",name:"AGBI Gulf Business",      lang:"en",flag:"🌍",url:"https://www.agbi.com/feed"},
  {id:"tradearabia",tier:3,desc:"Asharq Al-Awsat Business — pan-Arab broadsheet's business arm; credible on Gulf macro and oil.", country:"ME",name:"Asharq Al-Awsat Business",             lang:"en",flag:"🌍",url:GN("site:english.aawsat.com business economy Gulf")},
  {id:"gulftimes",tier:3,desc:"Gulf Times — Qatar's main English daily; essential for QIA, LNG, and Qatari economic developments.",   country:"ME",name:"Gulf Times Qatar",        lang:"en",flag:"🌍",url:GN("site:gulf-times.com business economy")},
  {id:"khaleej",tier:3,desc:"Khaleej Times — UAE's oldest English daily; broad business coverage of Dubai and wider UAE economy.",     country:"ME",name:"Khaleej Times UAE",       lang:"en",flag:"🌍",url:GN("site:khaleejtimes.com business economy")},
  {id:"alarabiya",tier:2,desc:"Al Arabiya Business — MBC-owned; fast English news on Gulf markets and geopolitical risk.",   country:"ME",name:"Al Arabiya Business",     lang:"en",flag:"🌍",url:GN("site:english.alarabiya.net business economy")},
  {id:"saudigazette",tier:3,desc:"Saudi Gazette — English daily in Riyadh; covers Saudi government, Aramco, and Vision 2030 projects.",country:"ME",name:"Saudi Gazette",           lang:"en",flag:"🌍",url:"https://www.saudigazette.com.sa/feed"},
  {id:"zawya",tier:2,desc:"Zawya — LSEG-owned MENA business intelligence platform; strong on GCC corporate filings and deals.",       country:"ME",name:"Zawya MENA",              lang:"en",flag:"🌍",url:"https://www.zawya.com/sitemaps/en/rss"},
  {id:"gulfbiz",tier:3,desc:"Gulf Business — Dubai-based English magazine; covers C-suite news, rankings, and Gulf conglomerates.",     country:"ME",name:"Gulf Business",           lang:"en",flag:"🌍",url:"https://gulfbusiness.com/feed/"},
  {id:"menafn_sa",tier:3,desc:"MENAFN Saudi — press release wire for Saudi corporates; useful for earnings and regulatory filings.",   country:"ME",name:"MENAFN Saudi",            lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=SaudiArabia"},
  {id:"menafn_uae",tier:3,desc:"MENAFN UAE — press release wire for UAE corporates; useful for earnings and regulatory filings.",  country:"ME",name:"MENAFN UAE",              lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=UAE"},
  {id:"menafn_qa",tier:3,desc:"MENAFN Qatar — press release wire for Qatari corporates; useful for QIA-linked announcements.",   country:"ME",name:"MENAFN Qatar",            lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Qatar"},
  {id:"menafn_kw",tier:3,desc:"MENAFN Kuwait — press release wire covering KSE-listed companies and Kuwaiti government initiatives.",   country:"ME",name:"MENAFN Kuwait",           lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Kuwait"},
  {id:"menafn_bh",tier:3,desc:"MENAFN Bahrain — covers Bahrain Bourse and the island's financial services and fintech sector.",   country:"ME",name:"MENAFN Bahrain",          lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Bahrain"},
  {id:"menafn_om",tier:3,desc:"MENAFN Oman — covers MSM (Muscat Stock Exchange) and Omani energy and logistics projects.",   country:"ME",name:"MENAFN Oman",             lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Oman"},
  {id:"reuters_me",tier:1,desc:"Reuters Gulf; covers oil prices, OPEC+ decisions, and major Gulf sovereign moves in English.",  country:"ME",name:"Reuters Gulf",            lang:"en",flag:"🌍",url:GN("site:reuters.com Saudi Arabia UAE Qatar Kuwait Oman Bahrain economy")},
  {id:"bloom_me",tier:1,desc:"Bloomberg Gulf; strong on Saudi Aramco, UAE banks, and Gulf currency pegs.",    country:"ME",name:"Bloomberg Gulf",          lang:"en",flag:"🌍",url:GN("site:bloomberg.com Saudi Arabia UAE Qatar Kuwait Gulf economy"),paywall:true},
  {id:"alarabiya_ar",tier:3,desc:"العربية — leading pan-Arab TV network's business feed, auto-translated; fast on Gulf market sentiment.",country:"ME",name:"العربية أعمال",           lang:"ar",flag:"🌍",url:GN("site:alarabiya.net اقتصاد أعمال","ar","SA","SA:ar")},
  // ── Iran ──────────────────────────────────────────────────────────────────
  {id:"iranintl",tier:2,desc:"Iran International — London-based, independent; most trusted external source on Iran's economy and crisis.",    country:"IR",name:"Iran International",     lang:"en",flag:"🇮🇷",url:GN("\"Iran International\" Iran politics military economy Hormuz")},
  {id:"tehrantimes",tier:2,desc:"Tehran Times — state-adjacent English daily; reflects official Iranian government economic narrative.", country:"IR",name:"Tehran Times",           lang:"en",flag:"🇮🇷",url:GN("Tehran Times Iran economy politics")},
  {id:"fin_trib",tier:3,desc:"Financial Tribune — Iran's only non-government English business paper; covers Iranian equities and trade.",    country:"IR",name:"Financial Tribune",      lang:"en",flag:"🇮🇷",url:GN("Financial Tribune Iran business economy markets")},
  {id:"irna_en",tier:1,desc:"IRNA — Islamic Republic's official wire; first with government statements, sanctions responses, and data.",     country:"IR",name:"IRNA English",           lang:"en",flag:"🇮🇷",url:GN("IRNA Iran official government economy")},
  {id:"tasnim",tier:3,desc:"Tasnim News — semi-official Iranian agency; covers IRGC-linked industries, energy, and trade.",      country:"IR",name:"Tasnim News",            lang:"en",flag:"🇮🇷",url:GN("Tasnim News Iran IRGC energy")},
  {id:"mehrnews",tier:3,desc:"Mehr News — state-owned Iranian agency; strong on industry, infrastructure, and domestic economy.",    country:"IR",name:"Mehr News Agency",       lang:"en",flag:"🇮🇷",url:GN("Mehr News Iran industry infrastructure")},
  {id:"ifpnews",tier:3,desc:"IFP News — aggregates and translates from leading Persian sources; useful cross-section of Iranian press.",     country:"IR",name:"IFP News",               lang:"en",flag:"🇮🇷",url:GN("IFP News Iran politics economy")},
  {id:"entekhab",tier:3,desc:"انتخاب — one of Iran's most-read Persian news portals, auto-translated; broad economic and political coverage.",    country:"IR",name:"انتخاب Entekhab",        lang:"fa",flag:"🇮🇷",url:GN("site:entekhab.ir","fa","IR","IR:fa")},
  {id:"tabnak",tier:3,desc:"تابناک — Persian outlet with close ties to Iranian political factions, auto-translated; useful for policy signals.",      country:"IR",name:"تابناک Tabnak",          lang:"fa",flag:"🇮🇷",url:GN("site:tabnak.ir اقتصاد","fa","IR","IR:fa")},
  {id:"reuters_ir",tier:1,desc:"Reuters Iran; independent English coverage of sanctions, nuclear talks, and Iranian economic conditions.",  country:"IR",name:"Reuters Iran",           lang:"en",flag:"🇮🇷",url:GN("site:reuters.com Iran economy nuclear sanctions")},
  {id:"bloom_ir",tier:1,desc:"Bloomberg Iran; covers oil output, rial, and impact of sanctions and conflict on Iranian markets.",    country:"IR",name:"Bloomberg Iran",         lang:"en",flag:"🇮🇷",url:GN("site:bloomberg.com Iran economy nuclear sanctions"),paywall:true},
];

const COUNTRIES = [
  {code:"ALL",label:"All Markets",   flag:"🌐"},
  {code:"US", label:"United States", flag:"🇺🇸"},
  {code:"DE", label:"Germany",       flag:"🇩🇪"},
  {code:"CA", label:"Canada",        flag:"🇨🇦"},
  {code:"SG", label:"Singapore",     flag:"🇸🇬"},
  {code:"HK", label:"Hong Kong",     flag:"🇭🇰"},
  {code:"KR", label:"Korea",         flag:"🇰🇷"},
  {code:"TW", label:"Taiwan",        flag:"🇹🇼"},
  {code:"IN", label:"India",         flag:"🇮🇳"},
  {code:"AU", label:"Australia",     flag:"🇦🇺"},
  {code:"CN", label:"China",         flag:"🇨🇳"},
  {code:"IL", label:"Israel",        flag:"🇮🇱"},
  {code:"ME", label:"Middle East",   flag:"🌍"},
  {code:"IR", label:"Iran",          flag:"🇮🇷"},
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SK = {
  articles:  "gm_arts_v4",
  summaries: "gm_briefs_v4",
  lastFetch: "gm_fetch_v4",
  watchlist: "gm_watch_v4",
  watchHits: "gm_watchhits_v4",
};
async function sGet(k) {
  try {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function sSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch(e) { console.warn("Storage full:", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSS FETCH
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchFeed(source) {
  try {
    const res = await fetch("/api/rss?url=" + encodeURIComponent(source.url));
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || text.length < 100) return [];
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const items = Array.from(xml.querySelectorAll("item"));
    if (!items.length) return [];
    return items.slice(0,10).map(item => {
      const g = t => item.querySelector(t)?.textContent?.trim() || "";
      let title = g("title").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
      title = title
        .replace(/\s*[-–]\s*\d{8}\s*[-–].*$/,"")
        .replace(/\s*[-–]\s*[^-–]{3,50}$/, "")
        .trim();
      if (!title) return null;
      const JUNK_PATTERNS = [
        /\b(award[s]?|recogni[sz]|certif|named one of|best place|top \d+ company|proud to announce|thrilled to|excited to|sponsorship|celebrate[s]?|anniversary)\b/i,
        /\b(why i (bought|sold|own|like)|my top pick|portfolio update|buy the dip|passive income|monthly dividend|drip investing|high yield|income investor|deep dive into|a closer look at|dividend king|dividend aristocrat)\b/i,
        /please complete.*verif/i,
        /tehrantimes pdf/i,
        /verif.*to continue/i,
        /access denied/i,
        /just a moment/i,
        /checking your browser/i,
        /ddos protection/i,
        /cloudflare/i,
        /enable javascript/i,
        /why do i have to complete a captcha/i,
      ];
      if (JUNK_PATTERNS.some(p => p.test(title))) return null;
      return {
        id: btoa(encodeURIComponent(title.slice(0,60))).replace(/[^a-zA-Z0-9]/g,"").slice(0,20),
        title,
        description: g("description").replace(/<[^>]+>/g,"").replace(/<!\[CDATA\[|\]\]>/g,"").trim().slice(0,260),
        link: g("link")||g("guid"),
        pubDate: g("pubDate")||g("dc:date")||"",
        source: source.name, sourceId: source.id,
        country: source.country, flag: source.flag, lang: source.lang,
        fetchedAt: Date.now(),
        translatedTitle: null, insight: null, sector: null, signal: null, signalCategory: null, weaknessContext: false, duplicateOf: null, isMicro: classifyMicro(title),
        watchMatches: [],
      };
    }).filter(Boolean);
  } catch(e) {
    console.warn("fetchFeed error:", source.id, e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════
const MICRO_KEYWORDS = /\b(earnings|revenue|profit|loss|EPS|guidance|dividend|buyback|repurchase|acquisition|merger|takeover|IPO|listing|delisting|CEO|CFO|CTO|appoint|resign|downgrade|upgrade|target price|analyst|price target|beat|miss|outlook|forecast|results|quarterly|annual report|rights issue|placement|disposal|stake|JV|joint venture|contract|deal|award|tender|lawsuit|settlement|fine|penalty|recall|bankruptcy|restructur|spinoff|spin-off|demerger|rights offer|AGM|EGM|shareholder|insider|buyout|LBO|PE fund|privatisation|privatization|delist|default|impairment|writedown|write-off|capex|guidance|raise|cut|lifted|lowered|reaffirm|initiat|reiterat)\b/i;
function classifyMicro(title) {
  return MICRO_KEYWORDS.test(title);
}
const STOP = new Set(["that","this","with","from","have","been","will","were","their","they","about","after","into","over","under","more","also","when","than","just","like","says","said"]);
function fingerprint(t) {
  return (t||"").toLowerCase().replace(/[^\w\s]/g,"").split(/\s+/)
    .filter(w=>w.length>3&&!STOP.has(w)).sort().join(" ");
}
function jaccard(a,b) {
  const sa=new Set(a.split(" ")),sb=new Set(b.split(" "));
  const inter=[...sa].filter(w=>sb.has(w)).length;
  const union=new Set([...sa,...sb]).size;
  return union===0?0:inter/union;
}
function resolveGroup(arts) {
  const src = id => SOURCES.find(s=>s.id===id);
  const free    = arts.filter(a=>!src(a.sourceId)?.paywall);
  const paywalled = arts.filter(a=> src(a.sourceId)?.paywall);
  const byDate = a => a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
  const pool   = free.length ? free : paywalled;
  const canon  = pool.slice().sort((a,b)=>byDate(b)-byDate(a))[0];
  const paywallSource = paywalled.length
    ? paywalled.slice().sort((a,b)=>byDate(b)-byDate(a))[0].sourceId
    : null;
  const paywallArticle = paywalled.length
    ? paywalled.slice().sort((a,b)=>byDate(b)-byDate(a))[0]
    : null;
  const canonUpdated = {
    ...canon,
    duplicateOf: null,
    originalSourceId: (free.length && paywallSource && !sameFamily(canon.sourceId, paywallSource))
      ? paywallSource
      : (canon.originalSourceId||null),
    originalSourceLink: (free.length && paywallArticle && !sameFamily(canon.sourceId, paywallSource))
      ? (paywallArticle.link || null)
      : (canon.originalSourceLink||null),
  };
  const dupes = arts.filter(a=>a.id!==canon.id).map(a=>({...a,duplicateOf:canon.id}));
  return [canonUpdated, ...dupes];
}
const PUBLISHER_FAMILIES = [
  ["bloomberg","bloomberg2"],
  ["wsj","wsj2"],
];
function sameFamily(idA, idB) {
  return PUBLISHER_FAMILIES.some(fam=>fam.includes(idA)&&fam.includes(idB));
}
function localDedup(articles) {
  const seenIds = new Set();
  const uniqueArts = [];
  const exactDupes = [];
  for (const art of articles) {
    if (seenIds.has(art.id)) exactDupes.push({...art, duplicateOf: art.id});
    else { seenIds.add(art.id); uniqueArts.push(art); }
  }
  const seen = [];
  const groupMap = {};
  const posToGroup = {};
  uniqueArts.forEach((art, i) => {
    const fp = fingerprint(art.translatedTitle || art.title);
    const match = seen.find(s => {
      const threshold = sameFamily(art.sourceId, uniqueArts[s.idx]?.sourceId) ? 0.25 : 0.45;
      return jaccard(fp, s.fp) > threshold;
    });
    if (match) {
      if (!groupMap[match.idx]) groupMap[match.idx] = [uniqueArts[match.idx]];
      groupMap[match.idx].push(art);
      posToGroup[i] = match.idx;
    } else {
      seen.push({fp, idx: i});
    }
  });
  const resolvedAtPos = {};
  Object.entries(groupMap).forEach(([canonIdxStr, grpArts]) => {
    const canonIdx = Number(canonIdxStr);
    const resolved = resolveGroup(grpArts);
    grpArts.forEach((origArt, j) => {
      const match = resolved.find(r => r.sourceId === origArt.sourceId && r.id === origArt.id)
                 || resolved[j];
      const pos = uniqueArts.indexOf(origArt);
      if (pos >= 0) resolvedAtPos[pos] = match;
    });
  });
  const result = uniqueArts.map((art, i) => resolvedAtPos[i] || art);
  return [...result, ...exactDupes];
}
async function claudeDedup(articles) {
  const candidates=articles.filter(a=>!a.duplicateOf);
  if(candidates.length<3) return articles;
  const prompt=`Identify groups of headlines covering the SAME news story (across languages too).
Return ONLY a JSON array of index arrays e.g. [[0,3],[1,5]]. Only groups of 2+. Empty array [] if none.
${candidates.map((a,i)=>`${i}. [${a.lang}] ${a.translatedTitle||a.title}`).join("\n")}`;
  try {
    const res=await callClaude(prompt,600);
    const groups=JSON.parse(res.replace(/```json|```/g,"").trim());
    let updated=[...articles];
    groups.forEach(grp=>{
      if(!Array.isArray(grp)||grp.length<2) return;
      const grpArts=grp.map(idx=>candidates[idx]).filter(Boolean);
      if(grpArts.length<2) return;
      const resolved=resolveGroup(grpArts);
      resolved.forEach(a=>{
        const i=updated.findIndex(u=>u.id===a.id);
        if(i!==-1) updated[i]=a;
      });
    });
    return updated;
  } catch { return articles; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE API HELPER
// ═══════════════════════════════════════════════════════════════════════════════
async function callClaude(prompt, maxTokens=2000) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHMENT — translate + insight + sector + signal
// ═══════════════════════════════════════════════════════════════════════════════
async function googleTranslate(text, sourceLang) {
  const langs = sourceLang === "zh" ? ["zh-CN", "zh-TW"] : [sourceLang];
  for (const lang of langs) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translated = data?.[0]?.map(x=>x?.[0]||"").join("") || "";
      const cjkRatio = (translated.match(/[\u4e00-\u9fff\uac00-\ud7ff]/g)||[]).length / (translated.length||1);
      if (translated && cjkRatio < 0.1) return translated;
    } catch {}
  }
  return text;
}

async function enrichBatch(articles) {
  if(!articles.length) return [];
  const withTranslations = await Promise.all(articles.map(async a => {
    if (a.lang === "en") return { ...a, _preTranslated: a.title };
    const translated = await googleTranslate(a.title, a.lang === "zh" ? "zh-CN" : a.lang);
    return { ...a, _preTranslated: translated };
  }));
  const catCodes = Object.keys(SIGNAL_CATEGORIES).join("|");
  const prompt=`Financial analyst. For each headline return a JSON array (one object per item).
Each item: {"translated":"<English title>","insight":"<one sentence investor takeaway>","sector":"<sector code>","signal":"<signal code>","signalCategory":"<category code>","weaknessContext":<true|false>}
Use EXACTLY the pre-translated title provided — do not re-translate.

Sector codes: FIN=banks/insurance/capital markets, IT=software/hardware/semis, IND=manufacturing/transport/conglomerates, CD=autos/retail/luxury/leisure, CS=food/beverages/household, HC=pharma/biotech/hospitals, EN=oil/gas/renewables, MAT=mining/chemicals/steel, COM=media/telecom/internet platforms, RE=property/REITs, UTL=power/water, MAC=central bank/rates/GDP/trade/FX/fiscal/elections/tariffs, UNK=unclear.

Signal codes (what is the LIKELY SHARE PRICE impact for the named company?):
SP2 = Strong Positive: clear upside catalyst — earnings beat, contract win, buyback, special dividend, M&A target at premium, director buying, turnaround plan by credible new CEO
SP1 = Positive: mild positive — analyst upgrade, dividend raise, new CEO (no distress context), small contract win, partnership, IPO
N  = Neutral: macro/policy news, no direct named-company impact, general market commentary
SN1 = Negative: mild negative — analyst downgrade, minor regulatory query, CFO change, small earnings miss, director selling
SN2 = Strong Negative: clear downside — profit warning, dividend cut, CEO resignation under pressure, regulatory fine, accounting restatement, debt covenant breach, large earnings miss, contract loss

Signal category — pick the SINGLE best code:
${catCodes}

Special management signals:
MGMT_INTERVIEW = CEO/CFO gives interview (set weaknessContext=true if it follows poor results or under pressure)
MGMT_STRATEGY = new strategic direction announced
MGMT_TURNAROUND = explicit turnaround plan after underperformance (set signal=SP2 if new leader, SN1 if incumbent)
MGMT_UNDER_PRESSURE = management defending strategy under analyst/investor/activist pressure (signal=SN1)
MGMT_BUY = director/insider buying own stock (signal=SP2)
MGMT_SELL = director/insider selling own stock (signal=SN1)
ACTIVIST_INVESTOR = activist fund takes stake or pushes for change (signal=SP1)

weaknessContext: set to TRUE if the headline mentions or implies the event follows a period of poor results, execution failure, strategic miss, investor pressure, or calls for change. Otherwise false.

STRICT FACTUAL RULE: Only classify based on what is EXPLICITLY in the headline. Do not infer figures or details not present. When uncertain between two categories, pick the more conservative signal strength.

Return ONLY a valid JSON array, no markdown. ${withTranslations.length} items:
${withTranslations.map((a,i)=>`${i}. ${a._preTranslated}`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 2000);
    const cleaned = text.replace(/```json|```/g,"").trim();
    return JSON.parse(cleaned);
  } catch { 
    return withTranslations.map(a=>({translated:a._preTranslated, insight:"", sector:"UNK"}));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLIMITED SUMMARY — splits into chunks, summarises each, then synthesises
// ═══════════════════════════════════════════════════════════════════════════════
async function generateBriefUnlimited(articles, label) {
  if (!articles.length) return {text:"", articles:[]};
  const sourceArticles = articles;

  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < articles.length; i += CHUNK) chunks.push(articles.slice(i, i + CHUNK));

  if (chunks.length === 1) {
    const prompt = `You are a senior financial analyst writing a detailed investment briefing for ${label}.

Use this exact format:

## [Descriptive title capturing the dominant macro theme and key risk]

[3-4 sentence BIG PICTURE executive summary: What is the dominant macro force driving markets right now? What geopolitical or policy development is most significant? What is the overall risk-on/risk-off tone? Only after setting this context, note 1-2 of the most market-moving company developments.]

## Macro & Geopolitical Environment
- [The single most important macro/geopolitical development and its broad market implications. Explain the transmission mechanism to markets and portfolios.]
- [Second key macro development. What sectors/assets does this affect and how?]

## [Regional/Sector theme]
- [Specific development: name companies, figures, percentages. Explain WHY it matters.]
[REF citations after each bullet]

## Company-Specific Actions
- [Earnings beat/miss: company, amount, implication. [REF:N]]
- [M&A, dividend change, CEO appointment, analyst upgrade/downgrade: company, details, implication. [REF:N]]

## Risks & Outlook
- [Specific risk with context and what to watch for]

Rules:
- ALWAYS start with big-picture macro/geopolitical context before zooming into companies
- Each bullet must be 1-2 sentences with real detail and investor perspective
- Name EVERY company mentioned in the headlines
- End each bullet with [REF:N] citing the article number(s)
- COVERAGE PRIORITY: Cover US and China stories first and most thoroughly. Then HK, Korea, Taiwan, India, Australia, Israel, Middle East, Iran. Then Singapore and Canada.
- COMPANY BALANCE: At least one full section dedicated to company-specific events. Name every company with ticker where known.
- INDUSTRY TRENDS: When multiple companies in the same sector report similar themes, call out the sector-level pattern explicitly.
- STRICT FACTUAL RULE: You may ONLY state facts that are EXPLICITLY present in the headline text. Do NOT infer, extrapolate, or add ANY figures, percentages, names, deal sizes, earnings amounts, or details that are not literally in the headline. Violation of this rule is unacceptable.

Articles (cite using [REF:N] at end of each bullet, N = article number):
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} — ${a.source}`).join("\n")}`;
    const text = await callClaude(prompt, 6000);
    return {text, articles: sourceArticles, generatedAt: Date.now()};
  }

  const summaries = await Promise.all(chunks.map((chunk, ci) => {
    const offset = ci * CHUNK;
    const prompt = `Summarise these headlines for ${label}. For each story, name the company, what happened, and the investor implication in 1 sentence. Include the article number in parentheses at the end of each sentence so it can be cited, e.g. "(article 3)".
${chunk.map((a,i)=>`${offset+i}. ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    return callClaude(prompt, 800);
  }));

  const articleIndex = articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} — ${a.source}`).join("\n");

  const synthPrompt = `You are a senior financial analyst. Synthesise these summaries into a detailed investment briefing for ${label}.

Format:
## [Title capturing dominant macro theme AND key risk]

[3-4 sentence BIG PICTURE summary: Lead with the dominant macro/geopolitical force.]

## Macro & Geopolitical Environment
- [Most important macro/geopolitical development. [REF:N]]
- [Second key macro development. [REF:N]]

## [Regional/Sector theme]
- [Development with figures and investor implication. [REF:N]]

## Company-Specific Actions
- [Earnings/M&A/dividend/executive change with company name, details, implication. [REF:N]]

## Risks & Outlook
- [Specific risk or opportunity. [REF:N]]

Rules:
- ALWAYS open with macro/geopolitical big picture BEFORE company detail
- Name every company, be specific with figures/percentages
- EVERY bullet must end with [REF:N] or [REF:N,M]
- COVERAGE PRIORITY: US and China first, then HK/Korea/Taiwan/India/Australia/Israel/ME/Iran, then Singapore/Canada
- STRICT FACTUAL RULE: Only state facts explicitly in the headline text. Never add figures, percentages, names, or details not literally present in the headlines.

Article index (use N in [REF:N]):
${articleIndex}

Summaries to synthesise:
${summaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, 6000);
  return {text, articles: sourceArticles, generatedAt: Date.now()};
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
function directMatch(art, keyword) {
  const kw = keyword.toLowerCase();
  const text = `${art.translatedTitle||art.title} ${art.description||""} ${art.insight||""}`.toLowerCase();
  return text.includes(kw);
}

async function intelligentMatch(keyword, articles) {
  if (!articles.length) return [];
  const prompt=`You are an investment research analyst monitoring news for relevance to a specific subject.

Subject being tracked: "${keyword}"

Your job: For EACH headline below, decide if it is relevant to "${keyword}" — either DIRECTLY (mentions it) or INDIRECTLY (affects it, involves competitors/peers/suppliers/customers/regulators/macro factors that impact it).

Think broadly: if tracking "Samsung", flag news about TSMC, SK Hynix, Apple, Qualcomm, memory chip demand, Korean Won, Korean economy, semiconductor regulations, etc.

Return ONLY a JSON array. Include ONLY relevant articles (skip irrelevant ones):
[{"idx": <number>, "matchType": "direct"|"related", "reason": "brief explanation of why relevant (1 sentence)"}]

${articles.length} headlines:
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}, ${a.country}]`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 3000);
    const clean = text.replace(/```json|```/g,"").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch { return []; }
}

async function runWatchlistAnalysis(keywords, articles, onProgress) {
  let working = articles.map(a => ({ ...a, watchMatches: [] }));
  for (let ki = 0; ki < keywords.length; ki++) {
    const kw = keywords[ki].trim();
    if (!kw) continue;
    onProgress(`Analysing keyword ${ki+1}/${keywords.length}: "${kw}"…`);
    const BATCH = 50;
    for (let i = 0; i < working.length; i += BATCH) {
      const batch = working.slice(i, i + BATCH);
      const results = await intelligentMatch(kw, batch);
      results.forEach(r => {
        const art = batch[r.idx];
        if (!art) return;
        const globalIdx = working.findIndex(a => a.id === art.id);
        if (globalIdx === -1) return;
        const existing = working[globalIdx].watchMatches || [];
        if (!existing.find(m => m.keyword === kw)) {
          working[globalIdx] = {
            ...working[globalIdx],
            watchMatches: [...existing, { keyword: kw, matchType: r.matchType, reason: r.reason }]
          };
        }
      });
    }
  }
  return working;
}

async function generateKeywordBrief(keyword, articles) {
  if (!articles.length) return "";
  const direct = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="direct"));
  const related = articles.filter(a => a.watchMatches?.find(m=>m.keyword===keyword&&m.matchType==="related"));
  const prompt=`You are an investment analyst producing a comprehensive intelligence brief on: "${keyword}"

You have ${direct.length} direct mentions and ${related.length} related/indirect stories from global news sources.
Synthesise ALL of them into a complete picture:
(1) What is happening directly with ${keyword} right now
(2) The broader ecosystem: competitors, suppliers, customers, regulators, macro factors — what are they signalling
(3) Overall investment assessment: risks, opportunities, and what to watch

Name specific companies, figures, and events. Flowing prose, no bullets. Be thorough — cover everything.

DIRECT MENTIONS (${direct.length}):
${direct.map(a=>`• ${a.translatedTitle||a.title} [${a.source}]`).join("\n")||"(none)"}

RELATED/INDIRECT (${related.length}):
${related.map(a=>`• ${a.translatedTitle||a.title} [${a.source}] — ${a.watchMatches?.find(m=>m.keyword===keyword)?.reason||""}`).join("\n")||"(none)"}`;
  const text = await callClaude(prompt, 3000);
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS & SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function timeAgo(ms) {
  if(!ms) return "";
  const d=(Date.now()-ms)/60000;
  if(d<1) return "just now";
  if(d<60) return `${Math.round(d)}m ago`;
  if(d<1440) return `${Math.round(d/60)}h ago`;
  return `${Math.round(d/1440)}d ago`;
}

function Dots({color="#c0392b"}) {
  return (
    <span style={{display:"inline-flex",gap:3,alignItems:"center"}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:4,height:4,borderRadius:"50%",background:color,
          animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>
      ))}
    </span>
  );
}

function Tag({children,color="#c0392b",onClick}) {
  return (
    <span onClick={onClick} style={{fontSize:9,padding:"1px 6px",borderRadius:3,
      fontFamily:"'DM Mono',monospace",background:`${color}18`,color,
      border:`1px solid ${color}44`,whiteSpace:"nowrap",cursor:onClick?"pointer":"default"}}>
      {children}
    </span>
  );
}

function ArticleCard({art, highlightKeyword=null}) {
  const sec = art.sector ? SECTOR_MAP[art.sector] : null;
  const sigMeta   = art.signal ? SIGNAL_META[art.signal] : null;
  const catMeta   = art.signalCategory ? SIGNAL_CATEGORIES[art.signalCategory] : null;
  const isMgmt    = catMeta?.mgmt === true;
  const isStrong  = art.signal === "SP2" || art.signal === "SN2";
  const isWeakCtx = art.weaknessContext === true;
  const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.25;
  const rawTitle = art.translatedTitle || art.title;
  const displayTitle = isCJK(rawTitle) && art.lang !== "en"
    ? (art.translatedTitle && !isCJK(art.translatedTitle) ? art.translatedTitle : "[Translation pending…] " + rawTitle)
    : rawTitle;
  const directMatches = (art.watchMatches||[]).filter(m=>m.matchType==="direct");
  const relatedMatches = (art.watchMatches||[]).filter(m=>m.matchType==="related");
  const isHighlighted = art.watchMatches?.length > 0;
  const focusMatch = highlightKeyword ? art.watchMatches?.find(m=>m.keyword===highlightKeyword) : null;
  const cardBg = isMgmt && isWeakCtx
    ? "linear-gradient(90deg,#fdf6e3 0%,#fff9f0 60%,transparent 100%)"
    : isStrong && art.signal==="SP2"
      ? "linear-gradient(90deg,#e6f4ec44 0%,transparent 100%)"
      : isStrong && art.signal==="SN2"
        ? "linear-gradient(90deg,#fdecea44 0%,transparent 100%)"
        : isHighlighted
          ? "linear-gradient(90deg,#c9a84c04 0%,transparent 100%)"
          : "transparent";
  const cardBorderLeft = isMgmt && isWeakCtx
    ? "3px solid #c9a84c"
    : isStrong
      ? `3px solid ${art.signal==="SP2"?"#1b7a3e":"#c0392b"}`
      : isHighlighted
        ? `2px solid ${directMatches.length?"#c0392b":"#4a9eff"}`
        : "2px solid transparent";

  return (
    <div style={{padding:"13px 0",borderBottom:"1px solid #e8e2d6",animation:"fadeIn 0.3s ease",
      background:cardBg,borderLeft:cardBorderLeft,
      paddingLeft:(isMgmt&&isWeakCtx)||isStrong||isHighlighted?10:0}}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5,marginBottom:5}}>
        <span style={{fontSize:11,color:"#c0392b",fontFamily:"'DM Mono',monospace",fontWeight:600}}>
          {art.flag} {art.source}
        </span>
        {art.originalSourceId&&(()=>{
          const orig=SOURCES.find(s=>s.id===art.originalSourceId);
          if(!orig) return null;
          const label = "Originally from " + orig.name.split(" ").slice(0,2).join(" ");
          return art.originalSourceLink ? (
            <a href={art.originalSourceLink} target="_blank" rel="noopener noreferrer"
              style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#8a6a20",
                background:"#fdf6e3",padding:"1px 6px",borderRadius:3,
                border:"1px solid #e8d9a0",textDecoration:"none",cursor:"pointer"}}>
              ↗ {label}
            </a>
          ) : (
            <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#888",
              background:"#f5f0e8",padding:"1px 6px",borderRadius:3,border:"1px solid #e0d8cc"}}>
              {label}
            </span>
          );
        })()}
        {art.lang!=="en" && <Tag color="#7a8fa6">{art.lang.toUpperCase()}→EN</Tag>}
        {sec && sec.code!=="UNK" && <Tag color={sec.color}>{sec.icon} {sec.label}</Tag>}
        {sigMeta && art.signal !== "N" && (
          <span style={{display:"inline-flex",alignItems:"center",gap:3,
            fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,
            padding:"2px 7px",borderRadius:3,letterSpacing:"0.04em",
            color:sigMeta.color,background:sigMeta.bg,border:`1px solid ${sigMeta.border}`}}>
            {sigMeta.short} {catMeta?.label||art.signalCategory}
          </span>
        )}
        {isMgmt && isWeakCtx && (
          <span style={{display:"inline-flex",alignItems:"center",gap:3,
            fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,
            padding:"2px 7px",borderRadius:3,letterSpacing:"0.04em",
            color:"#7a5c00",background:"#fdf6e3",border:"1px solid #e8c94c"}}>
            ⚑ post-weakness
          </span>
        )}
        {directMatches.map(m=>(<Tag key={m.keyword} color="#c0392b">⦿ {m.keyword}</Tag>))}
        {relatedMatches.map(m=>(<Tag key={m.keyword} color="#4a9eff">◎ {m.keyword}</Tag>))}
        {art.pubDate&&(
          <span style={{fontSize:9,color:"#2a3a4a",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>
            {timeAgo(new Date(art.pubDate).getTime())}
          </span>
        )}
      </div>
      <a href={art.link} target="_blank" rel="noopener noreferrer"
        style={{color:"#1a1a1a",fontFamily:"'Playfair Display',Georgia,serif",
          fontSize:14,lineHeight:1.5,fontWeight:600,textDecoration:"none",
          display:"block",marginBottom:4,transition:"color 0.15s"}}
        onMouseOver={e=>e.target.style.color="#c0392b"}
        onMouseOut={e=>e.target.style.color="#1a1a1a"}>
        {displayTitle}
      </a>
      {focusMatch && (
        <div style={{fontSize:11,color:focusMatch.matchType==="direct"?"#c0392b":"#4a9eff",
          lineHeight:1.6,paddingLeft:0,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>
          {focusMatch.matchType==="direct"?"⦿ direct":"◎ related"} — {focusMatch.reason}
        </div>
      )}
      {art.insight&&(
        <div style={{fontSize:12,color:"#666",lineHeight:1.65,
          borderLeft:"2px solid #c9a84c33",paddingLeft:9,
          fontStyle:"italic",fontFamily:"'DM Sans',sans-serif"}}>
          {art.insight}
        </div>
      )}
    </div>
  );
}

function findLinksForBullet(bulletText, articles) {
  if (!articles?.length || !bulletText) return [];
  const refMatch = bulletText.match(/\[REF:([\d,\s]+)\]/);
  if (refMatch) {
    const indices = refMatch[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    return indices.map(i=>articles[i]).filter(Boolean);
  }
  const words = bulletText.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>4);
  return articles
    .map(a=>{
      const haystack=((a.translatedTitle||a.title)+" "+(a.source||"")).toLowerCase();
      const hits=words.filter(w=>haystack.includes(w)).length;
      return {art:a,score:hits};
    })
    .filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.art);
}

function BriefRenderer({text, articles=[]}) {
  if (!text) return null;
  const rawLines = text.split("\n");
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t === "---" || t === "***" || t === "___") continue;
    if (/^\*\*[^*]+\*\*:?$/.test(t) && !t.startsWith("- ") && !t.startsWith("* ")) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j].trim()) j++;
      const next = rawLines[j]?.trim() || "";
      if (next && !next.startsWith("#") && !next.startsWith("- ") && !next.startsWith("* ") && !next.startsWith("**")) {
        lines.push(t + "\n" + next);
        i = j;
        continue;
      }
    }
    lines.push(rawLines[i]);
  }
  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:14,marginTop:4}}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{height:6}}/>;
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:13,
              fontWeight:700,color:"#8B4513",margin:"22px 0 10px",
              textTransform:"uppercase",letterSpacing:"0.1em",
              borderBottom:"2px solid #e0d8cc",paddingBottom:6}}>
              {trimmed.replace(/^## /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <div key={i} style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:16,
              fontWeight:700,color:"#1a1a1a",margin:"4px 0 14px",lineHeight:1.3}}>
              {trimmed.replace(/^# /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const txt = trimmed.replace(/^[-*] /,"");
          const cleanTxt = txt.replace(/\[REF:[\d,\s]+\]/g, "").trim();
          const boldMatch = cleanTxt.match(/^\*\*(.+?)\*\*:?\s*(.*)/s);
          const links = findLinksForBullet(txt, articles);
          return (
            <div key={i} style={{display:"flex",gap:8,margin:"8px 0",paddingLeft:8,alignItems:"flex-start"}}>
              <span style={{color:"#c0392b",fontWeight:700,marginTop:2,flexShrink:0,fontSize:16}}>•</span>
              <span style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:14,color:"#1a1a1a",lineHeight:1.7}}>
                {boldMatch
                  ? <><strong style={{color:"#1a1a1a"}}>{boldMatch[1]}</strong>{boldMatch[2]?": "+boldMatch[2]:""}</>
                  : cleanTxt}
                {links.map((a,li) => {
                  const src = SOURCES.find(s=>s.id===a.sourceId);
                  const isPaywall = src?.paywall;
                  const rawName = src?.name || a.source || "LINK";
                  const shortName = rawName.split(" ").slice(0,2).join(" ").slice(0,14);
                  const bg = isPaywall ? "#6b6b6b" : "#2a6a4a";
                  const bgHover = isPaywall ? "#444" : "#1a4a32";
                  return (
                    <a key={li} href={a.link} target="_blank" rel="noopener noreferrer"
                      title={`${rawName}${isPaywall?" (paywalled)":""}`}
                      style={{display:"inline-flex",alignItems:"center",gap:3,marginLeft:6,
                        padding:"2px 7px",background:bg,color:"#fff",borderRadius:3,
                        fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:600,
                        textDecoration:"none",letterSpacing:"0.03em",verticalAlign:"middle",
                        transition:"background 0.15s"}}
                      onMouseOver={e=>e.currentTarget.style.background=bgHover}
                      onMouseOut={e=>e.currentTarget.style.background=bg}>
                      {isPaywall && <span style={{fontSize:8,opacity:0.85}}>🔒</span>}
                      {shortName}
                    </a>
                  );
                })}
              </span>
            </div>
          );
        }
        const mergedMatch = trimmed.match(/^\*\*([^*]+)\*\*:?\n([\s\S]+)$/);
        // Strip [REF:N] citation markers from plain paragraphs (exec summary, risk sections)
        const cleanPara = trimmed.replace(/\[REF:[\d,\s]+\]/g, "").trim();
        return (
          <p key={i} style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:14,
            color:"#1a1a1a",lineHeight:1.7,margin:"10px 0",
            background:"#f0ece4",padding:"14px 18px",borderRadius:4}}>
            {mergedMatch
              ? <><strong>{mergedMatch[1].replace(/\[REF:[\d,\s]+\]/g,"").trim()}</strong>{": "}{mergedMatch[2].replace(/\[REF:[\d,\s]+\]/g,"").trim()}</>
              : cleanPara.replace(/\*\*([^*]+)\*\*/g, (_, t) => t)
            }
          </p>
        );
      })}
    </div>
  );
}


function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading}) {
  const briefData=briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);
  const briefArts = briefData?.articles ?? articles;
  const generatedAt = briefData?.generatedAt ?? null;
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    const b=await generateBriefUnlimited(articles,label);
    setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
    setLoading(p=>({...p,[briefKey]:false}));
  };
  const formatTime = (ms) => {
    try {
      return new Date(ms).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    } catch { return ""; }
  };
  return (
    <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
      padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>
              AI INVESTMENT BRIEF · {articles.length} articles analysed{generatedAt ? ` · generated ${formatTime(generatedAt)}` : ""}
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:700}}>
              {label}
            </div>
          </div>
        </div>
        <button onClick={run} disabled={isLoading}
          style={{background:"none",border:"1px solid #bbb",color:"#333",
            padding:"6px 14px",borderRadius:5,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background="none"}>
          {isLoading?<><Dots/> generating…</>:brief?"↺ refresh":"✦ generate brief"}
        </button>
      </div>
      {brief && <BriefRenderer text={brief} articles={briefArts}/>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// OVERFLOW MENU — ··· button with dropdown for secondary header actions
// ═══════════════════════════════════════════════════════════════════════════════
function OverflowMenu({allArticles, enrichedCount, dupeCount, showDupes, setShowDupes,
                       isLoading, enriching, runEnrichment, setAllArticles,
                       setBriefs, setLastFetch, setStatusMsg, SK}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const mono = { fontFamily:"'DM Mono',monospace" };
  const unenriched = allArticles.filter(a => !a.insight).length;

  const item = (label, onClick, color="#333", disabled=false) => (
    <button onClick={() => { if (!disabled) { onClick(); setOpen(false); } }}
      disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 16px",
        background:"none",border:"none",color:disabled?"#ccc":color,
        cursor:disabled?"not-allowed":"pointer",...mono,fontSize:11,
        textAlign:"left",whiteSpace:"nowrap",opacity:disabled?0.5:1}}
      onMouseOver={e=>{ if(!disabled) e.currentTarget.style.background="#f5f5f5"; }}
      onMouseOut={e=>e.currentTarget.style.background="none"}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button onClick={() => setOpen(p => !p)}
        style={{padding:"5px 10px",border:"1px solid #ccc",borderRadius:5,
          background:open?"#f0f0f0":"none",color:"#555",cursor:"pointer",
          ...mono,fontSize:14,lineHeight:1,letterSpacing:"0.1em"}}>
        ···
      </button>

      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",
          background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:300,minWidth:230,overflow:"hidden"}}>

          {/* Stats */}
          <div style={{padding:"8px 16px",borderBottom:"1px solid #f0ece4",...mono,fontSize:9,color:"#888",display:"flex",gap:14}}>
            <span style={{color:"#2a4a6a"}}>{allArticles.length} fetched</span>
            <span style={{color:"#1a3a2a"}}>−{dupeCount} dupes</span>
            <span style={{color:"#2a3a1a"}}>{enrichedCount} enriched</span>
          </div>

          {item(
            <><span style={{animation:enriching?"spin 1s linear infinite":"none",display:"inline-block"}}>✦</span> {enriching ? "Enriching…" : `Enrich headlines (${unenriched})`}</>,
            () => { if (unenriched) runEnrichment(allArticles, allArticles.filter(a=>!a.insight)); },
            "#7b68ee",
            isLoading || enriching || unenriched === 0
          )}

          {item(
            showDupes ? "∙ Hide duplicates" : "∙ Show duplicates",
            () => setShowDupes(p => !p)
          )}

          <div style={{borderTop:"1px solid #f0ece4"}}/>

          {item(
            <>✕ Clear cache</>,
            () => {
              if (!window.confirm("Clear all cached headlines and summaries? The app will re-fetch everything from scratch.")) return;
              Object.values(SK).forEach(k => localStorage.removeItem(k));
              setAllArticles([]); setBriefs({}); setLastFetch({});
              setStatusMsg("Cache cleared — reloading…");
              setTimeout(() => window.location.reload(), 800);
            },
            "#c0392b"
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// REGULATORY FILINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
const FILING_EXCHANGES = [
  { code:"US",  label:"SEC (US)",      flag:"🇺🇸", desc:"8-K / 10-Q / 10-K from SEC EDGAR — free public API, real-time" },
];

const SEC_FORM_TYPES = [
  { id:"8-K",    label:"8-K",   desc:"Material events — earnings, M&A, CEO changes, guidance" },
  { id:"10-Q",   label:"10-Q",  desc:"Quarterly financial statements" },
  { id:"10-K",   label:"10-K",  desc:"Annual reports" },
  { id:"SC 13D", label:"13D",   desc:">5% ownership stake disclosures" },
  { id:"DEF 14A",label:"Proxy", desc:"Shareholder votes, executive compensation" },
];

async function fetchSecFilings(formType, count=100) {
  try {
    const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=${count}&search_text=&output=atom`;
    const res = await fetch(`/api/rss?url=${encodeURIComponent(edgarUrl)}`);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML parse error");
    return [...doc.querySelectorAll("entry")].map(e => {
      const rawTitle   = e.querySelector("title")?.textContent?.trim() || "";
      const summary    = e.querySelector("summary")?.textContent || "";
      const updated    = e.querySelector("updated")?.textContent || "";
      const linkEl     = e.querySelector("link");
      const link       = linkEl?.getAttribute("href") || linkEl?.textContent?.trim() || "";
      const idEl       = e.querySelector("id")?.textContent || "";
      const titleParts = rawTitle.match(/^([^\-]+)\s*-\s*(.+?)\s*\(\d+\)/);
      const ftype      = titleParts ? titleParts[1].trim() : formType;
      const company    = titleParts ? titleParts[2].trim() : rawTitle;
      const filedMatch = summary.match(/Filed:<\/b>\s*([\d-]+)/);
      const filed      = filedMatch ? filedMatch[1] : updated.slice(0, 10);
      const accMatch   = (idEl + summary).match(/(\d{10}-\d{2}-\d{6})/);
      const accNum     = accMatch ? accMatch[1] : "";
      const id = accNum || (company + filed + ftype).replace(/\s/g, "").slice(0, 30);
      return { id, title: rawTitle, company, formType: ftype, filed, link, exchange: "US" };
    }).filter(f => f.company || f.title);
  } catch(e) {
    console.warn("SEC EDGAR fetch error:", e.message);
    return [];
  }
}

async function fetchAllSecFilings() {
  const results = await Promise.all(SEC_FORM_TYPES.map(ft => fetchSecFilings(ft.id, 40)));
  const seen = new Set();
  const all = results.flat().filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
  return all.sort((a, b) => (new Date(b.filed||0)) - (new Date(a.filed||0)));
}

async function generateGlobalFilingsBrief(filingsByExchange, secForm) {
  const usFilings = (filingsByExchange["US"] || []).slice(0, 30);
  const lines = usFilings.map((f, i) => {
    const date = f.filed
      ? (() => { try { return new Date(f.filed).toLocaleDateString("en-SG",{day:"numeric",month:"short"}); } catch(e){ return ""; } })()
      : "";
    return `${i+1}. [${f.formType}] ${f.company||f.title}${date?` (${date})`:""}${f.title!==f.company&&f.company?` — ${f.title}`:""}`;
  }).join("\n");
  const sectionsTruncated = (`🇺🇸 United States · SEC EDGAR · ${secForm}:\n${lines}`).slice(0, 5000);

  const prompt = `You are a buy-side analyst. Based on the following SEC regulatory filings from the last 48 hours, write an investment briefing.

${sectionsTruncated}

FORMAT:

## SEC Filings Brief — [headline summarising main themes]

[2-3 sentence executive summary of the most important filings]

## Key Corporate Events
- [most material filing: company name, what happened, investment implication]
- [next — be specific: earnings beat/miss by how much, M&A deal size, CEO name change, etc.]

## Sector Themes
- [Cross-company patterns: multiple companies in same sector, directional earnings trend, M&A wave]

## Watch List
- [High priority items to monitor — follow-up catalysts, risk events]

Rules:
- Name EVERY company, include ticker where inferable
- Quantify: deal sizes, EPS beat/miss, % changes
- Earnings, M&A, dividend changes, CEO changes = highest priority
- Each bullet 1-2 sentences, specific and actionable`;

  try {
    return await callClaude(prompt, 2000);
  } catch(e) {
    console.warn("Global filing brief error:", e.message);
    return `Error generating briefing: ${e.message}`;
  }
}

function FilingsTab() {
  const [secForm,      setSecForm]      = useState("8-K");
  const [filings,      setFilings]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [brief,        setBrief]        = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setFilings([]);
    setBrief("");
    if (secForm === "ALL") {
      const all = [];
      const seen = new Set();
      for (const ft of SEC_FORM_TYPES) {
        const results = await fetchSecFilings(ft.id, 40);
        results.forEach(f => { if (!seen.has(f.id)) { seen.add(f.id); all.push(f); } });
        await new Promise(r => setTimeout(r, 200));
      }
      setFilings(all.sort((a,b)=>(new Date(b.filed||0))-(new Date(a.filed||0))));
    } else {
      setFilings(await fetchSecFilings(secForm, 100));
    }
    setLoading(false);
  };

  const generateBrief = async () => {
    if (!filtered.length) return;
    setBriefLoading(true);
    setBrief("");
    const byEx = { US: filtered };
    const text = await generateGlobalFilingsBrief(byEx, secForm === "ALL" ? "All Form Types" : secForm);
    setBrief(text);
    setBriefLoading(false);
  };

  useEffect(() => { load(); }, [secForm]);

  const filtered = filings.filter(f =>
    !searchFilter ||
    f.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (f.company || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  const mono = { fontFamily:"'DM Mono',monospace" };

  const renderBrief = (text) => {
    if (!text) return null;
    const rawLines = text.split("\n");
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      const t = rawLines[i].trim();
      if (t === "---" || t === "***" || t === "___") continue;
      if (/^\*\*[^*]+\*\*:?$/.test(t) && !t.startsWith("- ")) {
        let j = i + 1;
        while (j < rawLines.length && !rawLines[j].trim()) j++;
        const next = rawLines[j]?.trim() || "";
        if (next && !next.startsWith("#") && !next.startsWith("- ") && !next.startsWith("**")) {
          lines.push(t + "\n" + next); i = j; continue;
        }
      }
      lines.push(rawLines[i]);
    }
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{height:5}}/>;
      if (trimmed.startsWith("### ")) return (
        <div key={i} style={{...mono,fontSize:12,fontWeight:600,color:"#1a1a1a",
          marginTop:i===0?0:18,marginBottom:5,borderBottom:"1px solid #e8e2d6",paddingBottom:5}}>
          {trimmed.replace("### ","")}
        </div>
      );
      if (trimmed.startsWith("## ")) return (
        <div key={i} style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,
          color:"#1a1a1a",marginTop:i===0?0:20,marginBottom:7}}>
          {trimmed.replace("## ","")}
        </div>
      );
      if (trimmed.startsWith("- ")) return (
        <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:13,lineHeight:1.6,paddingLeft:4}}>
          <span style={{color:"#c0392b",flexShrink:0,marginTop:3}}>•</span>
          <span>{trimmed.replace("- ","").replace(/\*\*([^*]+)\*\*/g,(_,t)=>t)}</span>
        </div>
      );
      const mergedMatch = trimmed.match(/^\*\*([^*]+)\*\*:?\n([\s\S]+)$/);
      return (
        <p key={i} style={{fontSize:13,lineHeight:1.65,marginBottom:8,color:"#333"}}>
          {mergedMatch
            ? <><strong>{mergedMatch[1]}</strong>{": "}{mergedMatch[2]}</>
            : trimmed.replace(/\*\*([^*]+)\*\*/g, (_,t) => t)
          }
        </p>
      );
    });
  };

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{...mono,fontSize:10,color:"#888"}}>Form type:</span>
          <button onClick={()=>setSecForm("ALL")}
            style={{...mono,fontSize:10,padding:"3px 9px",borderRadius:4,cursor:"pointer",
              border: secForm==="ALL" ? "2px solid #1a1a1a" : "1px solid #ddd",
              background: secForm==="ALL" ? "#1a1a1a" : "#fff",
              color: secForm==="ALL" ? "#fff" : "#555"}}>All</button>
          {SEC_FORM_TYPES.map(ft => (
            <button key={ft.id} onClick={()=>setSecForm(ft.id)} title={ft.desc}
              style={{...mono,fontSize:10,padding:"3px 9px",borderRadius:4,cursor:"pointer",
                border: secForm===ft.id ? "2px solid #1a1a1a" : "1px solid #ddd",
                background: secForm===ft.id ? "#1a1a1a" : "#fff",
                color: secForm===ft.id ? "#fff" : "#555"}}>
              {ft.id}
            </button>
          ))}
        </div>
        <input value={searchFilter} onChange={e=>setSearchFilter(e.target.value)}
          placeholder="Filter by company or keyword…"
          style={{...mono,fontSize:11,padding:"4px 10px",border:"1px solid #ccc",
            borderRadius:4,background:"#fff",flex:1,minWidth:180}} />
        <button onClick={load} disabled={loading}
          style={{...mono,fontSize:11,padding:"4px 10px",borderRadius:4,
            border:"1px solid #888",background:"#fff",cursor:"pointer",opacity:loading?0.5:1}}>
          ↺ Refresh
        </button>
        <button onClick={generateBrief} disabled={briefLoading||loading||filtered.length===0}
          style={{...mono,fontSize:11,padding:"5px 14px",borderRadius:4,cursor:"pointer",
            border:"2px solid #c0392b",
            background: brief ? "#fff5f5" : "#c0392b",
            color: brief ? "#c0392b" : "#fff",fontWeight:600,
            opacity:(briefLoading||loading||filtered.length===0)?0.45:1}}>
          {briefLoading ? "⊕ Generating briefing…" : brief ? "↺ Regenerate briefing" : `⊕ Generate briefing (all forms)`}
        </button>
      </div>
      <div style={{...mono,fontSize:10,color:"#888",marginBottom:16,padding:"5px 10px",
        background:"#f9f5ed",borderRadius:4,border:"1px solid #e8e2d6"}}>
        🇺🇸 SEC EDGAR · {secForm === "ALL" ? "All form types (8-K, 10-Q, 10-K, 13D, Proxy)" : SEC_FORM_TYPES.find(f=>f.id===secForm)?.desc}
        {" · "}{loading ? "loading…" : `${filtered.length} filings`}{" · Free public API · No key required"}
      </div>
      {(brief || briefLoading) && (
        <div style={{background:"#fff",border:"2px solid #1a1a1a",borderRadius:6,padding:"20px 24px",marginBottom:24}}>
          <div style={{...mono,fontSize:9,color:"#888",marginBottom:14,textTransform:"uppercase",
            letterSpacing:"0.08em",display:"flex",justifyContent:"space-between"}}>
            <span>◈ SEC Filings Intelligence Brief · {secForm}</span>
            <span>{new Date().toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {briefLoading
            ? <div style={{...mono,fontSize:12,color:"#888",padding:"16px 0",textAlign:"center"}}>Analysing {filtered.length} filings…</div>
            : <div>{renderBrief(brief)}</div>
          }
        </div>
      )}
      {loading && <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>Loading SEC EDGAR filings…</div>}
      {!loading && filtered.length===0 && <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>No filings found. Try refreshing.</div>}
      {!loading && filtered.length>0 && (
        <div>
          <div style={{...mono,fontSize:10,color:"#888",marginBottom:8,borderBottom:"1px solid #e8e2d6",paddingBottom:6}}>
            {filtered.length} filings — click to view on SEC EDGAR
          </div>
          {filtered.map(filing => (
            <div key={filing.id} style={{display:"flex",gap:10,alignItems:"flex-start",borderBottom:"1px solid #f0ebe0",padding:"8px 0"}}>
              <span style={{...mono,fontSize:9,background:"#1a1a1a",color:"#fff",padding:"2px 6px",borderRadius:3,flexShrink:0,marginTop:2,whiteSpace:"nowrap"}}>{filing.formType}</span>
              <span style={{...mono,fontSize:9,color:"#aaa",flexShrink:0,marginTop:2,minWidth:80,whiteSpace:"nowrap"}}>
                {filing.filed ? (() => { try { return new Date(filing.filed).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); } catch(e){ return filing.filed?.slice(0,10)||""; } })() : ""}
              </span>
              {classifyMicro(filing.title) && <span style={{...mono,fontSize:9,background:"#2e7d32",color:"#fff",padding:"2px 4px",borderRadius:3,flexShrink:0,marginTop:2}}>◈</span>}
              <div style={{flex:1,minWidth:0}}>
                <a href={filing.link} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:13,color:"#1a1a1a",textDecoration:"none",lineHeight:1.4}}>
                  {filing.company && filing.company !== filing.title
                    ? <><strong>{filing.company}</strong> — {filing.title.replace(filing.company,"").replace(/^[\s–-]+/,"")}</>
                    : filing.title}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{...mono,fontSize:9,color:"#bbb",textAlign:"center",marginTop:20,paddingBottom:8}}>
        Source: SEC EDGAR public Atom feed · sec.gov · Free · No API key required
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST TAB
// ═══════════════════════════════════════════════════════════════════════════════
function WatchlistTab({allArticles, setAllArticles}) {
  const [keywords,     setKeywords]     = useState([]);
  const [inputVal,     setInputVal]     = useState("");
  const [analysing,    setAnalysing]    = useState(false);
  const [statusMsg,    setStatusMsg]    = useState("");
  const [activeKw,     setActiveKw]     = useState(null);
  const [kwBriefs,     setKwBriefs]     = useState({});
  const [kwBriefLoad,  setKwBriefLoad]  = useState({});
  const [lastAnalysed, setLastAnalysed] = useState(null);

  useEffect(()=>{
    sGet(SK.watchlist).then(kws=>{ if(kws) setKeywords(kws); });
    sGet(SK.watchHits).then(hits=>{
      if(!hits) return;
      setAllArticles(prev=>prev.map(a=>({...a, watchMatches: hits[a.id] || a.watchMatches || []})));
    });
  },[]);

  const canonical = allArticles.filter(a=>!a.duplicateOf);

  const addKeyword = () => {
    const kw = inputVal.trim();
    if (!kw || keywords.includes(kw)) { setInputVal(""); return; }
    const updated = [...keywords, kw];
    setKeywords(updated); sSet(SK.watchlist, updated); setInputVal("");
  };

  const removeKeyword = (kw) => {
    const updated = keywords.filter(k=>k!==kw);
    setKeywords(updated); sSet(SK.watchlist, updated);
    if (activeKw===kw) setActiveKw(null);
    setAllArticles(prev=>prev.map(a=>({...a, watchMatches:(a.watchMatches||[]).filter(m=>m.keyword!==kw)})));
  };

  const runAnalysis = async () => {
    if (!keywords.length) return;
    setAnalysing(true);
    const updated = await runWatchlistAnalysis(keywords, canonical, setStatusMsg);
    setAllArticles(prev=>{
      const result = prev.map(a=>{ const upd=updated.find(u=>u.id===a.id); return upd?{...a,watchMatches:upd.watchMatches}:a; });
      const hitMap = {};
      result.forEach(a=>{ if(a.watchMatches?.length) hitMap[a.id]=a.watchMatches; });
      sSet(SK.watchHits, hitMap);
      return result;
    });
    setLastAnalysed(Date.now()); setStatusMsg(""); setAnalysing(false);
    if (!activeKw && keywords.length) setActiveKw(keywords[0]);
  };

  const kwArticles = activeKw ? canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw)) : [];
  const directArts  = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="direct"));
  const relatedArts = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="related"));
  const kwCounts = {};
  keywords.forEach(kw=>{
    kwCounts[kw] = {
      direct:  canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="direct")).length,
      related: canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="related")).length,
    };
  });

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"20px 24px",marginBottom:20}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em",marginBottom:4}}>WATCHLIST TRACKER</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:600,marginBottom:14}}>Intelligent Keyword Monitoring</div>
        <p style={{fontSize:12,color:"#4a6a8a",fontFamily:"'DM Sans',sans-serif",lineHeight:1.7,margin:"0 0 16px"}}>
          Add companies, people, sectors, or themes to track. Claude will flag both direct mentions and related stories — competitors, suppliers, regulators, macro factors — giving you a complete picture around each subject.
        </p>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addKeyword()}
            placeholder="e.g. Samsung, Fed rate cut, TSMC, Reliance Industries…"
            style={{flex:1,background:"#fff",border:"1px solid #ddd",borderRadius:6,padding:"9px 14px",color:"#1a1a1a",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
          <button onClick={addKeyword}
            style={{padding:"9px 18px",background:"#c0392b11",border:"1px solid #c0392b66",color:"#c0392b",borderRadius:6,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.15s"}}
            onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>+ add</button>
        </div>
        {keywords.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {keywords.map(kw=>(
              <div key={kw} onClick={()=>setActiveKw(kw)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:activeKw===kw?"#fdecea":"#fff",
                  border:`1px solid ${activeKw===kw?"#c0392b":"#ddd"}`,borderRadius:20,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:activeKw===kw?"#c0392b":"#333"}}>{kw}</span>
                {kwCounts[kw]&&(kwCounts[kw].direct||kwCounts[kw].related)>0&&(
                  <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#3a6080"}}>
                    <span style={{color:"#c0392b"}}>{kwCounts[kw].direct}</span>
                    {kwCounts[kw].related>0&&<span style={{color:"#2980b9"}}> +{kwCounts[kw].related}</span>}
                  </span>
                )}
                <span onClick={e=>{e.stopPropagation();removeKeyword(kw);}}
                  style={{fontSize:12,color:"#2a4050",cursor:"pointer",lineHeight:1,transition:"color 0.15s"}}
                  onMouseOver={e=>e.target.style.color="#f87171"} onMouseOut={e=>e.target.style.color="#2a4050"}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={runAnalysis} disabled={analysing||!keywords.length||!canonical.length}
            style={{padding:"9px 20px",background:(!keywords.length||!canonical.length)?"#f5f5f5":"#fdecea",
              border:"1px solid #bbb",color:"#333",borderRadius:6,cursor:(!keywords.length||!canonical.length)?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",opacity:(!keywords.length||!canonical.length)?0.4:1}}
            onMouseOver={e=>{if(!analysing)e.currentTarget.style.background="#c9a84c22"}}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            {analysing?<><Dots/> {statusMsg}</>:`⟳ run analysis (${canonical.length} articles × ${keywords.length} keywords)`}
          </button>
          {lastAnalysed&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>last run {timeAgo(lastAnalysed)}</span>}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
            <span style={{color:"#c0392b"}}>⦿ direct mention</span>
            <span style={{color:"#2980b9"}}>◎ related / indirect</span>
          </div>
        </div>
      </div>

      {activeKw && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"18px 22px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:kwBriefs[activeKw]?12:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>INTELLIGENCE BRIEF · {kwArticles.length} relevant articles</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:600}}>"{activeKw}" — Full Picture</div>
              </div>
              <button onClick={async()=>{
                  setKwBriefLoad(p=>({...p,[activeKw]:true}));
                  const b=await generateKeywordBrief(activeKw,kwArticles);
                  setKwBriefs(p=>({...p,[activeKw]:b}));
                  setKwBriefLoad(p=>({...p,[activeKw]:false}));
                }}
                disabled={kwBriefLoad[activeKw]||!kwArticles.length}
                style={{background:"none",border:"1px solid #bbb",color:"#333",padding:"6px 14px",borderRadius:5,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",opacity:!kwArticles.length?0.4:1}}
                onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
                onMouseOut={e=>e.currentTarget.style.background="none"}>
                {kwBriefLoad[activeKw]?<><Dots/> generating…</>:kwBriefs[activeKw]?"↺ refresh brief":"✦ generate intelligence brief"}
              </button>
            </div>
            {kwBriefs[activeKw]&&<BriefRenderer text={kwBriefs[activeKw]} articles={kwArticles}/>}
          </div>
          {kwArticles.length===0 ? (
            <div style={{textAlign:"center",padding:"40px",fontFamily:"'DM Mono',monospace",color:"#1e2a38",fontSize:12}}>No matches yet — run analysis first</div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span>⦿ DIRECT MENTIONS</span>
                  <span style={{background:"#c0392b18",color:"#c0392b",padding:"1px 7px",borderRadius:10,fontSize:9}}>{directArts.length}</span>
                </div>
                {directArts.length===0?<div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",padding:"20px 0"}}>No direct mentions found</div>
                  :directArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)}
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2980b9",fontWeight:600,letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span>◎ RELATED / INDIRECT</span>
                  <span style={{background:"#4a9eff22",color:"#2980b9",padding:"1px 7px",borderRadius:10,fontSize:9}}>{relatedArts.length}</span>
                </div>
                {relatedArts.length===0?<div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",padding:"20px 0"}}>No related stories found</div>
                  :relatedArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)}
              </div>
            </div>
          )}
        </div>
      )}
      {!activeKw && keywords.length>0 && <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",color:"#2a4050",fontSize:12}}>Select a keyword above to view its matches, or run analysis first</div>}
      {keywords.length===0&&<div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",color:"#1e2a38",fontSize:12}}>Add keywords above to start tracking</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES TAB
// ═══════════════════════════════════════════════════════════════════════════════
const SOURCE_RANK = {
  US: ["reuters","bloomberg","bloomberg2","wsj","wsj2","wsj_heard","wsj_mkt","ft","wapo","nyt","barrons","marketwatch","axios_biz","semafor","politico","seekalpha","prnewswire"],
  DE: ["reuters_de","bloom_de","handelsblatt","handelsblatt_en","faz","faz_finance","spiegel_de","sz_de","dw_de"],
  CA: ["reuters_ca","bloom_ca","globe_mail","fin_post","bnn"],
  SG: ["reuters_sg","bloom_sg","bt_sg","bt_stocks_watch","edge_sg_stocks_watch","edge_sg_focus","sginvestors","edge_sg","cna_sg","sgx_annc","sg_biz_review"],
  HK: ["reuters_hk","bloom_hk","scmp","scmp_markets","mingtiandi","hket","mingpao"],
  KR: ["reuters_kr","bloom_kr","kr_herald","yonhap","yonhap2","ktimes","ked","hankyung","maeil","chosunbiz"],
  TW: ["reuters_tw","bloom_tw","focus_tw","taipei_t","digitimes","udn_money","ctee"],
  IN: ["reuters_in","bloom_in","econ_times","mint","mint2","mint3","biz_std","hindubiz","fin_exp","cnbctv18","moneyctrl","forbes_in"],
  AU: ["reuters_au","bloom_au","afr","afr_street_talk","market_herald","smh","abc_au","stockhead_top10","fnarena","stockhead_au","guardian_au","the_aus"],
  CN: ["reuters_cn","bloom_cn","xinhua","cgtn","chinadaily","caixin","caixin_briefs","kr36","globaltimes","yicai","peoples_d"],
  IL: ["globes_il","reuters_il","bloom_il","jpost_il","toi_il","haaretz_il","ctech_il","calcalist"],
  ME: ["arabnews","arabnews_biz","national_ae","gulfnews","arabianbiz","reuters_me","bloom_me","agbi","tradearabia","alarabiya","zawya","gulfbiz","gulftimes","khaleej","saudigazette","menafn_sa","menafn_uae","menafn_qa","menafn_kw","menafn_bh","menafn_om","alarabiya_ar"],
  IR: ["iranintl","reuters_ir","bloom_ir","tehrantimes","fin_trib","irna_en","tasnim","ifpnews","mehrnews","entekhab","tabnak"],
  JP: ["nikkei_asia","nikkei_biz_spotlight"],
};

function SourcesTab({canonical, lastFetch, briefs, setBriefs}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[1].code);
  const [selectedSource,  setSelectedSource]  = useState("ALL");
  const [selectedTier,    setSelectedTier]    = useState(0);
  const [briefLoading,    setBriefLoading]    = useState({});
  const TIER_COLORS = {1:"#2e7d32", 2:"#1565c0", 3:"#6a1b9a"};

  const countryObj   = COUNTRIES.find(c => c.code === selectedCountry);
  const rankOrder    = SOURCE_RANK[selectedCountry] || [];
  const allCountrySources = SOURCES.filter(s => s.country === selectedCountry);
  const rankedSources = [
    ...rankOrder.map(id => allCountrySources.find(s => s.id === id)).filter(Boolean),
    ...allCountrySources.filter(s => !rankOrder.includes(s.id)),
  ];
  const tierFilteredSources = selectedTier === 0 ? rankedSources : rankedSources.filter(s => (s.tier||3) === selectedTier);
  const visibleSources = selectedSource === "ALL" ? tierFilteredSources : tierFilteredSources.filter(s => s.id === selectedSource);
  const countryArts = canonical.filter(a => a.country === selectedCountry);
  const briefKey = `sources_country_${selectedCountry}`;
  const briefData = briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData === "string" ? briefData : null);
  const briefArts = briefData?.articles ?? countryArts;

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"12px 18px",flexWrap:"wrap"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>COUNTRY</span>
        <div style={{position:"relative"}}>
          <select value={selectedCountry} onChange={e=>{setSelectedCountry(e.target.value);setSelectedSource("ALL");}}
            style={{appearance:"none",background:"#fff",border:"1px solid #c0392b",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:180}}>
            {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>(<option key={c.code} value={c.code}>{c.flag} {c.label}</option>))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#c0392b",fontSize:10}}>▼</span>
        </div>
        <div style={{display:"flex",gap:4,marginLeft:4,flexWrap:"wrap"}}>
          {[0,1,2,3].map(t=>(
            <button key={t} onClick={()=>{setSelectedTier(t);setSelectedSource("ALL");}}
              style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:3,cursor:"pointer",
                border: selectedTier===t ? `1px solid ${t===0?"#888":TIER_COLORS[t]}` : "1px solid #ddd",
                background: selectedTier===t ? (t===0?"#888":TIER_COLORS[t]) : "#fff",
                color: selectedTier===t ? "#fff" : "#888"}}>
              {t===0?"All tiers":`T${t}`}
            </button>
          ))}
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",letterSpacing:"0.08em",whiteSpace:"nowrap",marginLeft:8}}>SOURCE</span>
        <div style={{position:"relative"}}>
          <select value={selectedSource} onChange={e=>setSelectedSource(e.target.value)}
            style={{appearance:"none",background:"#fff",border:"1px solid #bbb",borderRadius:6,padding:"7px 32px 7px 12px",fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",cursor:"pointer",outline:"none",minWidth:200}}>
            <option value="ALL">All sources ({rankedSources.length})</option>
            {rankedSources.map((s,i)=>(<option key={s.id} value={s.id}>#{i+1} {s.name} ({canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id).length})</option>))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",marginLeft:4}}>
          <span style={{color:"#c0392b",fontWeight:600}}>{countryArts.length}</span> articles
        </span>
        <button onClick={async()=>{
            setBriefLoading(p=>({...p,[briefKey]:true}));
            const b = await generateBriefUnlimited(countryArts, `${countryObj?.flag} ${countryObj?.label} Markets`);
            setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
            setBriefLoading(p=>({...p,[briefKey]:false}));
          }}
          disabled={briefLoading[briefKey]||!countryArts.length}
          style={{marginLeft:"auto",padding:"7px 16px",background:brief?"none":"#fdecea",border:"1px solid #c0392b",color:"#c0392b",borderRadius:6,cursor:(!countryArts.length)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,opacity:!countryArts.length?0.4:1,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background=brief?"none":"#fdecea"}>
          {briefLoading[briefKey] ? <><Dots/> generating…</> : brief ? "↺ refresh brief" : "✦ generate country brief"}
        </button>
      </div>
      {brief && (
        <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em",marginBottom:2}}>AI INVESTMENT BRIEF · {countryArts.length} articles analysed{briefData?.generatedAt ? ` · generated ${new Date(briefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
          <BriefRenderer text={brief} articles={briefArts}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {visibleSources.map((src, idx)=>{
          const arts = canonical.filter(a=>a.sourceId===src.id||a.originalSourceId===src.id);
          const rank = rankOrder.indexOf(src.id);
          const rankLabel = rank >= 0 ? `#${rank+1}` : null;
          return (
            <div key={src.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"14px 16px",borderTop:`3px solid ${rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#ddd"}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #f0ece4"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  {rankLabel&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#999",fontWeight:700,background:rank<3?"#fafafa":"none",padding:"1px 5px",borderRadius:3,border:"1px solid #eee"}}>{rankLabel}</span>}
                  <div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#c0392b",fontWeight:600,letterSpacing:"0.04em"}}>{src.flag} {src.name}</span>
                    {src.desc&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",marginTop:2,lineHeight:1.4,maxWidth:460}}>{src.desc}</div>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  {lastFetch[src.id]&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#aaa"}}>{timeAgo(lastFetch[src.id])}</span>}
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f5f5f5",padding:"2px 7px",borderRadius:10}}>{arts.length}</span>
                </div>
              </div>
              {arts.length===0?<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#bbb",padding:"12px 0",textAlign:"center"}}>no recent articles</div>:(
                <>
                  {src.paywall&&arts.some(a=>a.originalSourceId===src.id)&&(
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",background:"#f9f6f0",border:"1px solid #e8e0d0",borderRadius:4,padding:"5px 10px",marginBottom:8}}>
                      ✦ includes free versions of {src.name} stories from other outlets
                    </div>
                  )}
                  {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS BRIEFS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function NewsBriefsTab({canonical, briefs, setBriefs}) {
  const [briefLoading, setBriefLoading] = useState({});
  const mono = { fontFamily:"'DM Mono',monospace" };

  // Compute articles for each market group
  const groupArts = (group) =>
    canonical.filter(a => group.sources.includes(a.sourceId) || group.sources.includes(a.originalSourceId));

  const allBriefArts = NEWS_BRIEF_GROUPS.flatMap(g => groupArts(g));
  const masterBriefKey = "newsbriefs_master";

  const generateGroupBrief = async (group) => {
    const key = `newsbriefs_${group.market}`;
    setBriefLoading(p=>({...p,[key]:true}));
    const arts = groupArts(group);
    if (!arts.length) { setBriefLoading(p=>({...p,[key]:false})); return; }
    const b = await generateBriefUnlimited(arts, `${group.flag} ${group.market} Company News`);
    setBriefs(p=>{const n={...p,[key]:b};sSet(SK.summaries,n);return n;});
    setBriefLoading(p=>({...p,[key]:false}));
  };

  const generateMasterBrief = async () => {
    setBriefLoading(p=>({...p,[masterBriefKey]:true}));
    if (!allBriefArts.length) { setBriefLoading(p=>({...p,[masterBriefKey]:false})); return; }
    const b = await generateBriefUnlimited(allBriefArts, "Global Company News Briefs");
    setBriefs(p=>{const n={...p,[masterBriefKey]:b};sSet(SK.summaries,n);return n;});
    setBriefLoading(p=>({...p,[masterBriefKey]:false}));
  };

  const masterBriefData = briefs[masterBriefKey];
  const masterBrief = masterBriefData?.text ?? (typeof masterBriefData==="string" ? masterBriefData : null);

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Master brief card */}
      <div style={{background:"#fff",border:"1px solid #e8e2d6",borderRadius:10,padding:"16px 18px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:masterBrief?10:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📰</span>
            <div>
              <div style={{...mono,fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>GLOBAL NEWS BRIEFS · {allBriefArts.length} articles{masterBriefData?.generatedAt ? ` · generated ${new Date(masterBriefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Company News Intelligence</div>
            </div>
          </div>
          <button onClick={generateMasterBrief} disabled={briefLoading[masterBriefKey]||!allBriefArts.length}
            style={{...mono,fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",
              cursor:briefLoading[masterBriefKey]||!allBriefArts.length?"not-allowed":"pointer",opacity:!allBriefArts.length?0.4:1}}
            onMouseOver={e=>{ if(!briefLoading[masterBriefKey]) e.currentTarget.style.background="#fdecea"; }}
            onMouseOut={e=>e.currentTarget.style.background="none"}>
            {briefLoading[masterBriefKey]?<Dots color="#c0392b"/>:"✦ brief all"}
          </button>
        </div>
        {masterBrief&&<div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}><BriefRenderer text={masterBrief} articles={masterBriefData?.articles||allBriefArts}/></div>}
      </div>

      {/* Per-market group columns */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
        {NEWS_BRIEF_GROUPS.map(group => {
          const arts = groupArts(group);
          const key = `newsbriefs_${group.market}`;
          const briefData = briefs[key];
          const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);

          // Group articles by source
          const bySource = {};
          arts.forEach(a => {
            const sid = a.sourceId;
            if (!bySource[sid]) bySource[sid] = { source: SOURCES.find(s=>s.id===sid), arts: [] };
            bySource[sid].arts.push(a);
          });

          // Signal summary counts
          const signalCounts = { SP2:0, SP1:0, SN1:0, SN2:0 };
          arts.forEach(a => { if (a.signal && a.signal !== "N") signalCounts[a.signal]++; });
          const hasSignals = Object.values(signalCounts).some(v=>v>0);

          return (
            <div key={group.market} style={{background:"#fff",border:`1px solid ${group.color}22`,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${group.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{...mono,fontSize:9,color:group.color,letterSpacing:"0.08em",fontWeight:600}}>{group.flag} {group.market.toUpperCase()} · {arts.length} articles{briefData?.generatedAt ? ` · generated ${new Date(briefData.generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                  <div style={{...mono,fontSize:8,color:"#aaa",marginTop:2}}>{group.desc}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {hasSignals && (
                    <div style={{display:"flex",gap:3}}>
                      {signalCounts.SP2>0&&<span style={{...mono,fontSize:8,background:"#1b7a3e",color:"#fff",padding:"1px 5px",borderRadius:2}}>▲▲{signalCounts.SP2}</span>}
                      {signalCounts.SP1>0&&<span style={{...mono,fontSize:8,background:"#e6f4ec",color:"#1b7a3e",padding:"1px 5px",borderRadius:2}}>▲{signalCounts.SP1}</span>}
                      {signalCounts.SN1>0&&<span style={{...mono,fontSize:8,background:"#fff3ee",color:"#b84a00",padding:"1px 5px",borderRadius:2}}>▽{signalCounts.SN1}</span>}
                      {signalCounts.SN2>0&&<span style={{...mono,fontSize:8,background:"#c0392b",color:"#fff",padding:"1px 5px",borderRadius:2}}>▽▽{signalCounts.SN2}</span>}
                    </div>
                  )}
                  <button onClick={()=>generateGroupBrief(group)} disabled={briefLoading[key]||!arts.length}
                    style={{...mono,fontSize:8,padding:"3px 8px",border:`1px solid ${group.color}44`,borderRadius:3,background:"none",color:group.color,cursor:briefLoading[key]||!arts.length?"not-allowed":"pointer",opacity:!arts.length?0.4:1}}
                    onMouseOver={e=>e.currentTarget.style.background=`${group.color}11`}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[key]?<Dots color={group.color}/>:"✦ brief"}
                  </button>
                </div>
              </div>

              {brief && <div style={{borderBottom:"1px solid #e8e2d6",paddingBottom:10,marginBottom:10}}><BriefRenderer text={brief} articles={briefData?.articles||arts}/></div>}

              {arts.length===0 ? (
                <div style={{...mono,fontSize:10,color:"#bbb",padding:"16px 0",textAlign:"center"}}>no articles — refresh feeds</div>
              ) : (
                Object.entries(bySource).map(([sid, {source: src, arts: srcArts}]) => (
                  <div key={sid} style={{marginBottom:8}}>
                    <div style={{...mono,fontSize:9,color:"#c0392b",fontWeight:600,padding:"4px 0",borderBottom:"1px solid #f0ece4",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{src?.flag} {src?.name || sid}</span>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        {src?.paywall && <span style={{fontSize:7,color:"#aaa"}}>🔒</span>}
                        <span style={{color:"#bbb",fontSize:8}}>{srcArts.length}</span>
                      </div>
                    </div>
                    {srcArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const STALE_MS = 45*60*1000;

export default function App() {
  const [mainTab,       setMainTab]       = useState("region");
  const [activeCountry, setActiveCountry] = useState("ALL");
  const [activeSector,  setActiveSector]  = useState("ALL");
  const [allArticles,   setAllArticles]   = useState([]);
  const [loading,       setLoading]       = useState({});
  const [lastFetch,     setLastFetch]     = useState({});
  const [briefs,        setBriefs]        = useState({});
  const [briefLoading,  setBriefLoading]  = useState({});
  const [statusMsg,     setStatusMsg]     = useState("Loading…");
  const [enriching,     setEnriching]     = useState(false);
  const [showDupes,     setShowDupes]     = useState(false);
  const [storageReady,  setStorageReady]  = useState(false);

  useEffect(()=>{
    (async()=>{
      const [arts,bfs,lf]=await Promise.all([sGet(SK.articles),sGet(SK.summaries),sGet(SK.lastFetch)]);
      if(arts?.length) setAllArticles(arts);
      if(bfs) setBriefs(bfs);
      if(lf)  setLastFetch(lf);
      setStatusMsg(""); setStorageReady(true);
    })();
  },[]);

  useEffect(()=>{
    if(!storageReady) return;
    const stale=SOURCES.filter(s=>!lastFetch[s.id]||(Date.now()-lastFetch[s.id])>STALE_MS);
    if(stale.length) fetchSources(stale);
    else setStatusMsg("");
  },[storageReady]);

  const fetchSources = useCallback(async(sources)=>{
    setStatusMsg(`Fetching ${sources.length} feeds…`);
    sources.forEach(s=>setLoading(p=>({...p,[s.id]:true})));
    const results=await Promise.all(sources.map(async s=>{
      const items=await fetchFeed(s);
      setLoading(p=>({...p,[s.id]:false}));
      return {sourceId:s.id,items};
    }));
    const now=Date.now();
    setLastFetch(p=>{const u={...p,...Object.fromEntries(results.map(r=>[r.sourceId,now]))};sSet(SK.lastFetch,u);return u;});
    const fresh=results.flatMap(r=>r.items);
    setStatusMsg(`Fetched ${fresh.length} items. Deduplicating…`);
    setAllArticles(prev=>{
      const kept=prev.filter(a=>!results.some(r=>r.sourceId===a.sourceId));
      const merged=localDedup([...kept,...fresh]);
      sSet(SK.articles,merged);
      const toTranslate=fresh.filter(a=>a.lang!=="en"&&!a.translatedTitle);
      if(toTranslate.length) runAutoTranslate(merged,toTranslate);
      else setStatusMsg("");
      return merged;
    });
  },[]);

  const runAutoTranslate=useCallback(async(currentArticles,toTranslate)=>{
    setStatusMsg(`Translating ${toTranslate.length} non-English titles…`);
    const translated = await Promise.all(toTranslate.map(async a => {
      const lang = a.lang === "zh" ? "zh-CN" : a.lang;
      const t = await googleTranslate(a.title, lang);
      return { ...a, translatedTitle: t };
    }));
    setAllArticles(prev => {
      const updated = prev.map(a => { const t=translated.find(x=>x.id===a.id); return t?{...a,translatedTitle:t.translatedTitle}:a; });
      sSet(SK.articles, updated); return updated;
    });
    setStatusMsg("");
  },[]);

  const runEnrichment=useCallback(async(currentArticles,toEnrich)=>{
    setEnriching(true);
    const BATCH=15;
    let working=[...currentArticles];
    for(let i=0;i<toEnrich.length;i+=BATCH){
      const batch=toEnrich.slice(i,i+BATCH);
      setStatusMsg(`Enriching ${i+1}–${Math.min(i+BATCH,toEnrich.length)} of ${toEnrich.length}…`);
      const results=await enrichBatch(batch);
      working=working.map(a=>{
        const idx=batch.findIndex(b=>b.id===a.id);
        if(idx===-1||!results[idx]) return a;
        const r=results[idx];
        const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.2;
        const translationOk = a.lang !== "en" && r.translated && !isCJK(r.translated);
        const shouldStore = translationOk ? r.translated : a.lang === "en" && r.translated && r.translated !== a.title ? r.translated : null;
        let resolvedSignal = r.signal || a.signal || "N";
        const cat = r.signalCategory || a.signalCategory || "OTHER";
        const isWeakness = r.weaknessContext === true || a.weaknessContext;
        const catMeta = SIGNAL_CATEGORIES[cat];
        if (catMeta?.mgmt && isWeakness) {
          const upgrade = { SP1:"SP2", N:"SN1", SN1:"SN2" };
          resolvedSignal = upgrade[resolvedSignal] || resolvedSignal;
        }
        return {...a, translatedTitle:shouldStore||a.translatedTitle, insight:r.insight||a.insight, sector:r.sector||a.sector, signal:resolvedSignal, signalCategory:cat, weaknessContext:isWeakness};
      });
      setAllArticles(working);
    }
    setStatusMsg("Cross-language dedup…");
    working=localDedup(working);
    const afterClaude=await claudeDedup(working);
    setAllArticles(afterClaude); sSet(SK.articles,afterClaude);
    setEnriching(false); setStatusMsg("");
  },[]);

  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const sortByDate = arts => [...arts].sort((a,b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    const db = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
    return db - da;
  });
  const isRecent = a => {
    const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    return t === 0 || (Date.now() - t) < FIVE_DAYS_MS;
  };
  const canonical = sortByDate(allArticles.filter(a => (showDupes||!a.duplicateOf) && isRecent(a)));
  const forCountry=c=>c==="ALL"?canonical:canonical.filter(a=>a.country===c);
  const forSector=s=>s==="ALL"?canonical:canonical.filter(a=>a.sector===s);
  const countryArts=forCountry(activeCountry);
  const sectorArts=forSector(activeSector);
  const sourcesInView=SOURCES.filter(s=>activeCountry==="ALL"||s.country===activeCountry);
  const sourceGroups=sourcesInView.map(s=>({s,arts:canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id)})).filter(g=>g.arts.length);
  const sectorGroups=MSCI_SECTORS.map(sec=>({sec,arts:canonical.filter(a=>a.sector===sec.code)})).filter(g=>g.arts.length).sort((a,b)=>b.arts.length-a.arts.length);
  const unenrichedArts=canonical.filter(a=>!a.sector);
  const sectorForActive=SECTOR_MAP[activeSector];
  const isLoading=Object.values(loading).some(Boolean);
  const dupeCount=allArticles.filter(a=>a.duplicateOf).length;
  const enrichedCount=allArticles.filter(a=>a.insight).length;
  const sectorCountsForCountry={};
  countryArts.forEach(a=>{if(a.sector)sectorCountsForCountry[a.sector]=(sectorCountsForCountry[a.sector]||0)+1;});
  const watchlistHits=canonical.filter(a=>a.watchMatches?.length>0).length;

  const WINDOW_OPTIONS = [
    { h:3, label:"3h" }, { h:6, label:"6h" }, { h:12, label:"12h" }, { h:24, label:"24h" }, { h:48, label:"48h" },
  ];
  const [windowHours, setWindowHours] = useState(12);
  const [signalFilter, setSignalFilter] = useState("ALL");
  const WINDOW_MS = windowHours * 60 * 60 * 1000;
  const breakingArts = (() => {
    const raw = canonical.filter(a => {
      const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
      return t > 0 && (Date.now() - t) < WINDOW_MS;
    }).sort((a,b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
      return tb - ta;
    });
    const countPerSource = {}, countPerCountry = {};
    const MAX_PER_SOURCE = 4, MAX_PER_COUNTRY = 18;
    return raw.filter(a => {
      const ns=(countPerSource[a.sourceId]||0), nc=(countPerCountry[a.country]||0);
      if(ns>=MAX_PER_SOURCE||nc>=MAX_PER_COUNTRY) return false;
      countPerSource[a.sourceId]=ns+1; countPerCountry[a.country]=nc+1; return true;
    });
  })();

  const briefsTabArts = NEWS_BRIEF_GROUPS.flatMap(g =>
    canonical.filter(a => g.sources.includes(a.sourceId) || g.sources.includes(a.originalSourceId))
  );
  const briefsTabCount = briefsTabArts.length;

  const MAIN_TABS=[
    {id:"breaking", label:`⚡ Breaking${breakingArts.length>0?` (${breakingArts.length})`:""}`},
    {id:"newsbriefs",label:`📰 News Briefs${briefsTabCount>0?` (${briefsTabCount})`:""}`},
    {id:"region",   label:"⊕ Regions"},
    {id:"sector",   label:"▦ Sectors"},
    {id:"sources",  label:"◫ Sources"},
    {id:"watchlist",label:`◎ Watchlist${watchlistHits>0?` (${watchlistHits})`:""}`},
    {id:"filings",  label:"📋 Filings"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f5f0e8",color:"#1a1a1a",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        input{outline:none}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      <header style={{background:"#fff",borderBottom:"2px solid #1a1a1a",position:"sticky",top:0,zIndex:200}}>
        {/* Row 1: logo + controls */}
        <div style={{maxWidth:1500,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,padding:"0 24px"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:"#1a1a1a",fontWeight:700,letterSpacing:"-0.03em",lineHeight:1,flexShrink:0}}>
            GLOBAL MARKETS
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:"0.25em",marginLeft:8,fontWeight:400,verticalAlign:"middle"}}>WIRE</span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            {/* Status indicator — always visible */}
            {(isLoading||enriching||statusMsg)&&(
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",display:"flex",alignItems:"center",gap:5}}>
                <Dots/><span style={{display:"none",["@media(min-width:600px)"]:{display:"inline"}}}>{statusMsg||"…"}</span>
              </span>
            )}

            {/* Refresh — always visible, primary action */}
            <button onClick={()=>fetchSources(SOURCES)} disabled={isLoading||enriching}
              style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"1px solid #bbb",
                color:"#333",padding:"5px 11px",borderRadius:5,cursor:(isLoading||enriching)?"not-allowed":"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:11,opacity:(isLoading||enriching)?0.5:1,flexShrink:0}}
              onMouseOver={e=>e.currentTarget.style.background="#f5f5f5"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              <span style={{display:"inline-block",animation:isLoading?"spin 1s linear infinite":"none"}}>⟳</span>
              <span>{isLoading?"refreshing…":"refresh"}</span>
            </button>

            {/* ··· overflow menu */}
            <OverflowMenu
              allArticles={allArticles}
              enrichedCount={enrichedCount}
              dupeCount={dupeCount}
              showDupes={showDupes}
              setShowDupes={setShowDupes}
              isLoading={isLoading}
              enriching={enriching}
              runEnrichment={runEnrichment}
              setAllArticles={setAllArticles}
              setBriefs={setBriefs}
              setLastFetch={setLastFetch}
              setStatusMsg={setStatusMsg}
              SK={SK}
            />
          </div>
        </div>

        {/* Row 2: scrollable tab bar */}
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderTop:"1px solid #f0ece4",
          scrollbarWidth:"none",msOverflowStyle:"none"}}
          // hide scrollbar visually but keep scroll behaviour
        >
          <style>{`::-webkit-scrollbar{display:none}`}</style>
          <div style={{display:"flex",padding:"0 16px",width:"max-content",minWidth:"100%"}}>
            {MAIN_TABS.map(({id,label})=>(
              <button key={id} onClick={()=>setMainTab(id)}
                style={{padding:"7px 12px",border:"none",background:"none",
                  color:mainTab===id?"#c0392b":"#555",
                  borderBottom:mainTab===id?"2px solid #c0392b":"2px solid transparent",
                  fontWeight:mainTab===id?600:400,
                  cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,
                  whiteSpace:"nowrap",transition:"all 0.15s",flexShrink:0}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* SUB-NAV */}
      {mainTab!=="watchlist"&&mainTab!=="sources"&&mainTab!=="breaking"&&mainTab!=="newsbriefs"&&mainTab!=="filings"&&(
        <div style={{background:"#fff",borderBottom:"1px solid #ddd",position:"sticky",top:88,zIndex:199,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px",display:"flex",width:"max-content",minWidth:"100%"}}>
            {mainTab==="region"?(
              COUNTRIES.map(c=>{
                const cnt=c.code==="ALL"?canonical.length:canonical.filter(a=>a.country===c.code).length;
                const active=activeCountry===c.code;
                return (
                  <button key={c.code} onClick={()=>setActiveCountry(c.code)}
                    style={{padding:"11px 14px",border:"none",background:"none",color:active?"#c0392b":"#8aa8bc",
                      borderBottom:active?"2px solid #c9a84c":"2px solid transparent",cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#333"}}>
                    {c.flag} {c.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?"#fdecea":"#f0f0f0",color:active?"#c0392b":"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })
            ):(
              [{code:"ALL",label:"All Sectors",icon:"▤",color:"#c0392b"},...MSCI_SECTORS].map(sec=>{
                const cnt=sec.code==="ALL"?canonical.length:canonical.filter(a=>a.sector===sec.code).length;
                const active=activeSector===sec.code;
                const col=sec.color||"#c0392b";
                return (
                  <button key={sec.code} onClick={()=>setActiveSector(sec.code)}
                    style={{padding:"11px 13px",border:"none",background:"none",color:active?col:"#333",
                      borderBottom:active?`2px solid ${col}`:"2px solid transparent",cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:12,whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
                    onMouseOver={e=>{if(!active)e.currentTarget.style.color="#c0392b"}}
                    onMouseOut={e=>{if(!active)e.currentTarget.style.color="#333"}}>
                    <span>{sec.icon||"▤"}</span> {sec.label}
                    {cnt>0&&<span style={{fontSize:8,background:active?`${col}18`:"#f0f0f0",color:active?col:"#666",padding:"1px 5px",borderRadius:8}}>{cnt}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{maxWidth:1500,margin:"0 auto",padding:"22px 24px"}}>

        {mainTab==="watchlist"&&<WatchlistTab allArticles={allArticles} setAllArticles={setAllArticles}/>}
        {mainTab==="filings"&&<FilingsTab />}
        {mainTab==="newsbriefs"&&<NewsBriefsTab canonical={canonical} briefs={briefs} setBriefs={setBriefs}/>}

        {/* REGION */}
        {mainTab==="region"&&(
          <>
            {activeCountry!=="ALL"&&(
              <>
                <BriefBox label={`${COUNTRIES.find(c=>c.code===activeCountry)?.flag} ${COUNTRIES.find(c=>c.code===activeCountry)?.label} Market Overview`}
                  icon={COUNTRIES.find(c=>c.code===activeCountry)?.flag}
                  briefKey={`country_${activeCountry}`} briefs={briefs} setBriefs={setBriefs} articles={countryArts}
                  loading={briefLoading} setLoading={setBriefLoading}/>
                {Object.keys(sectorCountsForCountry).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
                    {MSCI_SECTORS.filter(s=>sectorCountsForCountry[s.code]).map(sec=>(
                      <button key={sec.code} onClick={()=>{setMainTab("sector");setActiveSector(sec.code);}}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:5,border:`1px solid ${sec.color}44`,background:`${sec.color}0d`,color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}
                        onMouseOver={e=>e.currentTarget.style.background=`${sec.color}22`}
                        onMouseOut={e=>e.currentTarget.style.background=`${sec.color}0d`}>
                        {sec.icon} {sec.label} ({sectorCountsForCountry[sec.code]})
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {countryArts.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",fontFamily:"'DM Mono',monospace",color:"#1a2a38",fontSize:13}}>
                {isLoading?<><Dots/> fetching feeds…</>:"no articles — hit refresh"}
              </div>
            ):activeCountry==="ALL"?(
              <div style={{maxWidth:860,margin:"0 auto"}}>{countryArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}</div>
            ):(
              <div style={{columns:"2 520px",columnGap:24}}>
                {sourceGroups.map(({s,arts})=>(
                  <div key={s.id} style={{breakInside:"avoid",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:"1px solid #e8e2d6",marginBottom:1}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.06em"}}>{s.flag} {s.name.toUpperCase()}</span>
                      <span style={{fontSize:9,color:"#888",fontFamily:"'DM Mono',monospace"}}>{arts.length}</span>
                      {lastFetch[s.id]&&<span style={{fontSize:8,color:"#aaa",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{timeAgo(lastFetch[s.id])}</span>}
                    </div>
                    {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* BREAKING NEWS */}
        {mainTab==="breaking"&&(()=>{
          const briefKey="breaking";
          return (
            <div>
              <div style={{background:"#fff",border:"1px solid #e8e2d6",borderRadius:10,padding:"16px 18px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:20}}>⚡</span>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>BREAKING · {breakingArts.length} stories · last {windowHours}h{briefs[briefKey]?.generatedAt ? ` · generated ${new Date(briefs[briefKey].generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Breaking News Intelligence</div>
                    </div>
                    <div style={{display:"flex",gap:4,marginLeft:8}}>
                      {WINDOW_OPTIONS.map(o=>(
                        <button key={o.h} onClick={()=>setWindowHours(o.h)}
                          style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"2px 7px",borderRadius:3,cursor:"pointer",
                            border:windowHours===o.h?"1px solid #c0392b":"1px solid #ddd",
                            background:windowHours===o.h?"#c0392b":"#fff",color:windowHours===o.h?"#fff":"#888"}}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={async()=>{
                      setBriefLoading(p=>({...p,[briefKey]:true}));
                      const BRIEF_COUNTRY_ORDER = ["US","CN","DE","HK","KR","TW","IN","AU","IL","ME","IR","SG","CA"];
                      const prioritisedArts = [...breakingArts].sort((a,b)=>{
                        const ra=BRIEF_COUNTRY_ORDER.indexOf(a.country), rb=BRIEF_COUNTRY_ORDER.indexOf(b.country);
                        const sa=ra===-1?999:ra, sb=rb===-1?999:rb;
                        return sa!==sb?sa-sb:0;
                      });
                      const b=await generateBriefUnlimited(prioritisedArts,"Breaking News");
                      setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                      setBriefLoading(p=>({...p,[briefKey]:false}));
                    }}
                    disabled={briefLoading[briefKey]||breakingArts.length===0}
                    style={{fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",cursor:briefLoading[briefKey]||breakingArts.length===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:breakingArts.length===0?0.4:1}}
                    onMouseOver={e=>{if(!briefLoading[briefKey])e.currentTarget.style.background="#fdecea";}}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[briefKey]?<Dots color="#c0392b"/>:"✦ brief"}
                  </button>
                </div>
                {briefs[briefKey]&&(
                  <div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}>
                    <BriefRenderer
                      text={typeof briefs[briefKey]==="string"?briefs[briefKey]:briefs[briefKey]?.text}
                      articles={(() => { const stored=typeof briefs[briefKey]==="string"?null:briefs[briefKey]?.articles; return (stored&&stored.length>0)?stored:breakingArts; })()}
                    />
                  </div>
                )}
              </div>

              {breakingArts.length===0?(
                <div style={{textAlign:"center",color:"#888",fontFamily:"'DM Mono',monospace",fontSize:11,padding:40}}>no articles in the last {windowHours}h — try refreshing</div>
              ):(()=>{
                const signalFiltered = signalFilter==="ALL" ? breakingArts
                  : signalFilter==="MGMT" ? breakingArts.filter(a=>SIGNAL_CATEGORIES[a.signalCategory]?.mgmt)
                  : breakingArts.filter(a=>a.signal===signalFilter);
                const enrichedAny = breakingArts.some(a=>a.signal);
                return (
                  <div>
                    {enrichedAny && (
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12,padding:"8px 0",borderBottom:"1px solid #e8e2d6",alignItems:"center"}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",letterSpacing:"0.08em",marginRight:2}}>SIGNAL</span>
                        {[{id:"ALL",label:"All"},{id:"SP2",label:"▲▲ Strong +"},{id:"SP1",label:"▲ Positive"},{id:"SN1",label:"▽ Negative"},{id:"SN2",label:"▽▽ Strong −"},{id:"MGMT",label:"⚑ Management"}].map(f=>(
                          <button key={f.id} onClick={()=>setSignalFilter(f.id)}
                            style={{fontFamily:"'DM Mono',monospace",fontSize:9,padding:"3px 9px",borderRadius:3,cursor:"pointer",transition:"all 0.15s",
                              border:signalFilter===f.id?`1px solid ${f.id==="SP2"?"#1b7a3e":f.id==="SP1"?"#2e7d32":f.id==="SN1"?"#b84a00":f.id==="SN2"?"#c0392b":f.id==="MGMT"?"#c9a84c":"#888"}`:"1px solid #ddd",
                              background:signalFilter===f.id?(f.id==="SP2"?"#1b7a3e":f.id==="SP1"?"#e6f4ec":f.id==="SN1"?"#fff3ee":f.id==="SN2"?"#c0392b":f.id==="MGMT"?"#fdf6e3":"#555"):"#fff",
                              color:signalFilter===f.id?(f.id==="SP2"||f.id==="SN2"||f.id==="ALL"?"#fff":f.id==="SP1"?"#1b7a3e":f.id==="SN1"?"#b84a00":f.id==="MGMT"?"#7a5c00":"#fff"):"#888"}}>
                            {f.label}
                          </button>
                        ))}
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#aaa",marginLeft:4}}>{signalFiltered.length} articles</span>
                      </div>
                    )}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,padding:"6px 0",borderBottom:"1px solid #e8e2d6"}}>
                      {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                        const n=signalFiltered.filter(a=>a.country===c.code).length;
                        return n?<span key={c.code} style={{fontSize:10,color:"#3a6080",fontFamily:"'DM Mono',monospace",background:"#f0f4f8",padding:"2px 6px",borderRadius:3}}>{c.flag} {n}</span>:null;
                      })}
                    </div>
                    {signalFiltered.length===0?(
                      <div style={{textAlign:"center",color:"#aaa",fontFamily:"'DM Mono',monospace",fontSize:11,padding:32}}>no {signalFilter!=="ALL"?signalFilter+" ":""}signals — enrich articles first</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {signalFiltered.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* SECTOR */}
        {mainTab==="sector"&&(
          <>
            {activeSector==="ALL"?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))",gap:16}}>
                {sectorGroups.map(({sec,arts})=>{
                  const briefKey=`sector_${sec.code}`;
                  return (
                    <div key={sec.code} style={{background:"#ffffff",border:`1px solid ${sec.color}22`,borderRadius:10,padding:"16px 18px",animation:"fadeIn 0.4s ease"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20,color:sec.color}}>{sec.icon}</span>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sec.color,letterSpacing:"0.1em",fontWeight:600}}>{sec.code} · {arts.length} stories{briefs[briefKey]?.generatedAt ? ` · generated ${new Date(briefs[briefKey].generatedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}` : ""}</div>
                            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>{sec.label}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>setActiveSector(sec.code)}
                            style={{fontSize:9,padding:"3px 9px",border:`1px solid ${sec.color}33`,borderRadius:4,background:"none",color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}
                            onMouseOver={e=>e.currentTarget.style.background=`${sec.color}11`}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>view all →</button>
                          <button onClick={async()=>{
                              setBriefLoading(p=>({...p,[briefKey]:true}));
                              const b=await generateBriefUnlimited(arts,sec.label);
                              setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                              setBriefLoading(p=>({...p,[briefKey]:false}));
                            }}
                            disabled={briefLoading[briefKey]}
                            style={{fontSize:9,padding:"3px 9px",border:`1px solid ${sec.color}44`,borderRadius:4,background:"none",color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}
                            onMouseOver={e=>e.currentTarget.style.background=`${sec.color}11`}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>
                            {briefLoading[briefKey]?<Dots color={sec.color}/>:"✦ brief"}
                          </button>
                        </div>
                      </div>
                      {briefs[briefKey]&&<div style={{marginBottom:10,borderBottom:"1px solid #e8e2d6",paddingBottom:10}}><BriefRenderer text={typeof briefs[briefKey]==="string"?briefs[briefKey]:briefs[briefKey]?.text} articles={typeof briefs[briefKey]==="string"?arts:briefs[briefKey]?.articles||arts}/></div>}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                        {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{const n=arts.filter(a=>a.country===c.code).length;return n?<span key={c.code} style={{fontSize:9,color:"#3a6080",fontFamily:"'DM Mono',monospace"}}>{c.flag}{n}</span>:null;})}
                      </div>
                      {arts.slice(0,4).map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      {arts.length>4&&<button onClick={()=>setActiveSector(sec.code)} style={{fontSize:10,color:"#2a5a7a",background:"none",border:"none",cursor:"pointer",paddingTop:8,fontFamily:"'DM Mono',monospace"}}>+{arts.length-4} more →</button>}
                    </div>
                  );
                })}
              </div>
            ):(
              <>
                <BriefBox label={`${sectorForActive?.icon} ${sectorForActive?.label} — Global Sector View`} icon={sectorForActive?.icon}
                  briefKey={`sector_${activeSector}`} briefs={briefs} setBriefs={setBriefs} articles={sectorArts}
                  loading={briefLoading} setLoading={setBriefLoading}/>
                <div style={{columns:"2 520px",columnGap:24}}>
                  {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                    const arts=sectorArts.filter(a=>a.country===c.code);
                    if(!arts.length) return null;
                    const col=sectorForActive?.color||"#c0392b";
                    return (
                      <div key={c.code} style={{breakInside:"avoid",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:`1px solid ${col}22`,marginBottom:1}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:col,fontWeight:600}}>{c.flag} {c.label.toUpperCase()}</span>
                          <span style={{fontSize:9,color:"#1e2e3e",fontFamily:"'DM Mono',monospace"}}>{arts.length}</span>
                        </div>
                        {arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* SOURCES — rendered outside padding div so it spans full width */}
      {mainTab==="sources"&&(
        <div style={{maxWidth:1500,margin:"0 auto",padding:"22px 24px"}}>
          <SourcesTab canonical={canonical} lastFetch={lastFetch} briefs={briefs} setBriefs={setBriefs}/>
        </div>
      )}

      <footer style={{borderTop:"1px solid #ddd",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>{SOURCES.length} sources · {COUNTRIES.length-1} markets · {MSCI_SECTORS.length} GICS sectors</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>persisted locally · stale threshold 45 min</span>
      </footer>
    </div>
  );
}
