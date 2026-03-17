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
// SOURCES
// ═══════════════════════════════════════════════════════════════════════════════
const GN = (q,hl="en-US",gl="US",ceid="US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const SOURCES = [
  // ── United States ──────────────────────────────────────────────────────────
  // Reuters: not paywalled, Google News works well
  {id:"reuters",    country:"US",name:"Reuters Business",       lang:"en",flag:"🇺🇸",url:GN("site:reuters.com business finance")},
  // MarketWatch: not paywalled, GN fine
  {id:"marketwatch",desc:"Dow Jones-owned; strong on US equities, earnings, and retail investor flow.",country:"US",name:"MarketWatch",            lang:"en",flag:"🇺🇸",url:GN("site:marketwatch.com markets stocks")},
  // WSJ: paywalled — direct Dow Jones RSS feed
  {id:"wsj",        country:"US",name:"WSJ Markets",            lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",paywall:true},
  {id:"wsj2",       country:"US",name:"WSJ Business",           lang:"en",flag:"🇺🇸",url:"https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness",paywall:true},
  // Bloomberg: direct RSS — headlines are public even if articles paywalled
  {id:"bloomberg",  country:"US",name:"Bloomberg Markets",      lang:"en",flag:"🇺🇸",url:"https://feeds.bloomberg.com/markets/news.rss",paywall:true},
  {id:"bloomberg2", country:"US",name:"Bloomberg Business",     lang:"en",flag:"🇺🇸",url:"https://feeds.bloomberg.com/business/news.rss",paywall:true},
  // FT: direct RSS (already switched)
  {id:"ft",         country:"US",name:"Financial Times",        lang:"en",flag:"🇺🇸",url:GN("site:ft.com markets economy business"),paywall:true},
  {id:"nyt",        country:"US",name:"NY Times Business",      lang:"en",flag:"🇺🇸",url:"https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",paywall:true},
  {id:"axios_biz",  desc:"Axios — smart brevity format; fast, context-rich on tech, policy, and market-moving Washington news.",country:"US",name:"Axios Business",         lang:"en",flag:"🇺🇸",url:GN("site:axios.com business economy markets finance")},
  {id:"wapo",       desc:"Washington Post — authoritative on US politics, policy, and national security; essential for Washington-driven market moves.",country:"US",name:"Washington Post",        lang:"en",flag:"🇺🇸",url:GN("site:washingtonpost.com business economy policy"),paywall:true},
  {id:"barrons",    desc:"Barron's — Dow Jones's premier investment weekly; stock-specific analysis, ratings, earnings previews, and buy/sell calls. Highly actionable for fundamental investors.",country:"US",name:"Barron's",              lang:"en",flag:"🇺🇸",url:GN("site:barrons.com stocks earnings analysis"),paywall:true},
  {id:"seekalpha",  desc:"Seeking Alpha Earnings — earnings beats/misses, dividend announcements, and analyst rating changes. Filtered to high-signal corporate events only.",country:"US",name:"Seeking Alpha Earnings",  lang:"en",flag:"🇺🇸",url:GN("site:seekingalpha.com earnings beat miss dividend CEO acquires merger")},
  {id:"prnewswire", desc:"PR Newswire — filtered to primary corporate events: earnings results, M&A, dividend changes, and CEO/CFO appointments only.",country:"US",name:"PR Newswire",            lang:"en",flag:"🇺🇸",url:GN("site:prnewswire.com quarterly results OR earnings per share OR acquires OR merger agreement OR dividend OR appoints CEO OR names CFO")},
  {id:"semafor",    desc:"Semafor Business — sharp, independently sourced business and finance journalism; well-connected on Wall Street, Washington policy, and global capital flows.",country:"US",name:"Semafor Business",       lang:"en",flag:"🇺🇸",url:GN("site:semafor.com business finance economy markets")},
  {id:"politico",   desc:"Politico Economy — authoritative on US fiscal policy, Fed regulation, trade, and Washington's influence on markets. Essential for policy-driven investment themes.",country:"US",name:"Politico Economy",       lang:"en",flag:"🇺🇸",url:GN("site:politico.com economy finance tax trade regulation")},
  // ── Germany ────────────────────────────────────────────────────────────────
  {id:"handelsblatt",  desc:"Handelsblatt — Germany's leading financial daily; required reading for DAX, German industry and European monetary policy.",               country:"DE",name:"Handelsblatt",        lang:"de",flag:"🇩🇪",url:"https://www.handelsblatt.com/contentexport/feed/schlagzeilen",paywall:true},
  {id:"handelsblatt_en",desc:"Handelsblatt English — curated English-language coverage of German business and European economic news.",                                 country:"DE",name:"Handelsblatt (EN)",    lang:"en",flag:"🇩🇪",url:GN("site:handelsblatt.com english economy business"),paywall:true},
  {id:"faz",           desc:"FAZ (Frankfurter Allgemeine) — Germany's newspaper of record; authoritative on politics, economics and ECB.",                             country:"DE",name:"FAZ",                  lang:"de",flag:"🇩🇪",url:"https://www.faz.net/rss/aktuell",paywall:true},
  {id:"faz_finance",   desc:"FAZ Finance — financial markets, banking and investment coverage from Germany's most authoritative broadsheet.",                          country:"DE",name:"FAZ Finance",          lang:"de",flag:"🇩🇪",url:GN("site:faz.net Wirtschaft Finanzen","de","DE","DE:de")},
  {id:"spiegel_de",    desc:"Der Spiegel (International) — Germany's top news magazine; investigative, with strong European and geopolitical depth in English.",        country:"DE",name:"Der Spiegel",          lang:"en",flag:"🇩🇪",url:"https://www.spiegel.de/international/index.rss"},
  {id:"sz_de",         desc:"Süddeutsche Zeitung — centrist German broadsheet; strong on investigative journalism and European affairs.",                               country:"DE",name:"Süddeutsche Zeitung",  lang:"de",flag:"🇩🇪",url:GN("site:sueddeutsche.de Wirtschaft Finanzen","de","DE","DE:de")},
  {id:"dw_de",         desc:"Deutsche Welle Business — Germany's international broadcaster; English-language coverage of German and European economic news.",           country:"DE",name:"Deutsche Welle",       lang:"en",flag:"🇩🇪",url:"https://rss.dw.com/xml/rss-en-bus"},
  {id:"reuters_de",    desc:"Reuters Germany — wire coverage of German markets, DAX companies and European economic policy.",                                          country:"DE",name:"Reuters Germany",      lang:"en",flag:"🇩🇪",url:GN("site:reuters.com Germany economy business finance DAX")},
  {id:"bloom_de",      desc:"Bloomberg Germany — markets and corporate coverage with a Germany/DACH focus.",                                                           country:"DE",name:"Bloomberg Germany",    lang:"en",flag:"🇩🇪",url:GN("site:bloomberg.com Germany economy business"),paywall:true},
  // ── Canada ─────────────────────────────────────────────────────────────────
  // Globe & Mail: paywalled — broader GN query gets more headlines
  {id:"globe_mail",desc:"Canada's newspaper of record; best source for Bay Street and TSX corporate news.", country:"CA",name:"Globe and Mail",         lang:"en",flag:"🇨🇦",url:"https://www.theglobeandmail.com/arc/outboundfeeds/rss/?outputType=xml&_website=the-globe-and-mail",paywall:true},
  {id:"fin_post",desc:"Canada's leading dedicated financial daily; covers TSX, commodities, and energy.",   country:"CA",name:"Financial Post",         lang:"en",flag:"🇨🇦",url:GN("site:financialpost.com"),paywall:true},
  // BNN: not paywalled
  {id:"bnn",desc:"BNN Bloomberg's Canadian TV wire; fast-moving market updates and Bay Street commentary.",        country:"CA",name:"BNN Bloomberg Canada",   lang:"en",flag:"🇨🇦",url:GN("site:bnnbloomberg.ca")},
  {id:"globemail_rob",  desc:"Globe and Mail Report on Business — Canada's most read business section; TSX company earnings, Bay Street M&A, and corporate actions.",   country:"CA",name:"Globe: Report on Business",lang:"en",flag:"🇨🇦",url:"https://www.theglobeandmail.com/arc/outboundfeeds/rss/section/report-on-business/?outputType=xml",paywall:true},
  {id:"fp_companies",   desc:"Financial Post Companies — company-specific feed; TSX earnings, executive moves, and resource sector corporate actions.",                  country:"CA",name:"FP Companies",         lang:"en",flag:"🇨🇦",url:GN("site:financialpost.com company earnings acquisition TSX"),paywall:true},
  {id:"reuters_ca",desc:"Reuters' Canada-focused feed; strong on energy, mining, and macro.", country:"CA",name:"Reuters Canada",         lang:"en",flag:"🇨🇦",url:GN("site:reuters.com Canada economy business")},
  {id:"bloom_ca",desc:"Bloomberg's Canada feed; authoritative on oil sands, housing, and BoC policy.",   country:"CA",name:"Bloomberg Canada",       lang:"en",flag:"🇨🇦",url:GN("site:bloomberg.com Canada economy markets"),paywall:true},
  // ── Nikkei Asia (pan-Asian; covers JP, KR, TW, IN, SG, SE Asia corporate news) ──────
  {id:"nikkei_asia",   desc:"Nikkei Asia — premier English-language source for Asian corporate news; essential for Japan, Korea, SEA company-level coverage.",          country:"JP",name:"Nikkei Asia",          lang:"en",flag:"🇯🇵",url:"https://asia.nikkei.com/rss/feed/nar",paywall:true},
  // ── Singapore ──────────────────────────────────────────────────────────────
  // Business Times SG: paywalled — broader query
  {id:"bt_sg",desc:"SGX's go-to daily; essential for listed companies, REITs, and MAS policy.",      country:"SG",name:"Business Times SG",      lang:"en",flag:"🇸🇬",url:GN("Business Times Singapore markets economy"),paywall:true},
  // Straits Times: paywalled — broader query
  // CNA: free — GN fine
  {id:"cna_sg",desc:"Singapore's public broadcaster; reliable on government policy and Southeast Asian macro.",     country:"SG",name:"CNA Business",           lang:"en",flag:"🇸🇬",url:GN("site:channelnewsasia.com business")},
  {id:"edge_sg",desc:"In-depth weekly; known for contrarian analysis on SGX stocks and property.",    country:"SG",name:"The Edge Singapore",     lang:"en",flag:"🇸🇬",url:GN("site:theedgesingapore.com"),paywall:true},
  {id:"reuters_sg",desc:"Reuters' Singapore hub; covers regional trade flows and Southeast Asian markets.", country:"SG",name:"Reuters Singapore",       lang:"en",flag:"🇸🇬",url:GN("site:reuters.com Singapore economy business")},
  {id:"bloom_sg",desc:"Bloomberg Singapore; strong on central bank, tech, and broader ASEAN.",   country:"SG",name:"Bloomberg Singapore",     lang:"en",flag:"🇸🇬",url:GN("site:bloomberg.com Singapore markets economy"),paywall:true},
  {id:"sgx_annc",      desc:"SGX company announcements — earnings, dividends, rights issues, M&A and corporate actions from SGX-listed companies. Most actionable micro feed for SGX investors.",country:"SG",name:"SGX Announcements",    lang:"en",flag:"🇸🇬",url:GN("SGX company earnings dividend rights issue acquisition Singapore announcement")},
  {id:"sg_biz_review", desc:"Singapore Business Review — company-specific news on SGX listings, deal flow, and corporate actions.",                                      country:"SG",name:"SG Business Review",   lang:"en",flag:"🇸🇬",url:GN("site:sbr.com.sg")},
  // ── Hong Kong ──────────────────────────────────────────────────────────────
  {id:"scmp",desc:"Hong Kong's English paper of record; best English-language lens on China policy and HKEX.",       country:"HK",name:"South China Morning Post",lang:"en",flag:"🇭🇰",url:GN("site:scmp.com business finance"),paywall:true},
  {id:"mingtiandi",desc:"Specialist in China and Asia real estate; essential for REIT and property investors.", country:"HK",name:"Mingtiandi",             lang:"en",flag:"🇭🇰",url:GN("site:mingtiandi.com")},
  {id:"hket",desc:"Hong Kong Economic Times — HK's top Chinese financial daily, auto-translated.",       country:"HK",name:"香港經濟日報 HKET",        lang:"zh",flag:"🇭🇰",url:GN("site:hket.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"mingpao",desc:"Ming Pao Finance — respected HK Chinese daily; strong on local markets and Mainland flows.",    country:"HK",name:"明報財經 Ming Pao",       lang:"zh",flag:"🇭🇰",url:GN("site:mingpao.com 財經","zh-HK","HK","HK:zh-Hant")},
  {id:"reuters_hk",desc:"Reuters' Hong Kong desk; key for Hang Seng, IPOs, and China-HK market mechanics.", country:"HK",name:"Reuters Hong Kong",       lang:"en",flag:"🇭🇰",url:GN("site:reuters.com \"Hong Kong\" economy business finance")},
  {id:"bloom_hk",desc:"Bloomberg HK; covers Hang Seng constituents, H-shares, and property sector.",   country:"HK",name:"Bloomberg Hong Kong",     lang:"en",flag:"🇭🇰",url:GN("site:bloomberg.com \"Hong Kong\" markets economy"),paywall:true},
  // ── Korea ──────────────────────────────────────────────────────────────────
  {id:"ked",desc:"Korea Economic Daily's English arm; first-mover on Samsung, SK, and Korean chaebol.",        country:"KR",name:"KED Global",             lang:"en",flag:"🇰🇷",url:GN("site:kedglobal.com"),paywall:true},
  {id:"ktimes",desc:"Korea Times Business — broad English coverage of Korean economy and trade policy.",      country:"KR",name:"Korea Times Business",    lang:"en",flag:"🇰🇷",url:"https://feed.koreatimes.co.kr/k/business.xml",paywall:true},
  {id:"kr_herald",desc:"Korea Herald Economy — accessible English daily; good for foreign investor context.",  country:"KR",name:"Korea Herald Business",  lang:"en",flag:"🇰🇷",url:"https://www.koreaherald.com/rss/kh_Business",paywall:true},
  {id:"yonhap",desc:"Korea's official wire agency; authoritative on government policy, trade, and North Korea risk.",     country:"KR",name:"Yonhap Economy",         lang:"en",flag:"🇰🇷",url:"https://en.yna.co.kr/RSS/economy.xml"},
  {id:"yonhap2",desc:"Yonhap financial sub-feed; focused on markets, earnings, and corporate actions.",     country:"KR",name:"Yonhap Finance",          lang:"en",flag:"🇰🇷",url:"https://en.yna.co.kr/RSS/industry.xml"},
  {id:"hankyung",desc:"Hankyung (Korean Economic Daily) — the Bloomberg of Korea, auto-translated; most read by fund managers.",   country:"KR",name:"한국경제 Hankyung",        lang:"ko",flag:"🇰🇷",url:"https://www.hankyung.com/feed/economy"},
  {id:"maeil",desc:"Maeil Business Newspaper — Korea's oldest financial daily, auto-translated; strong on industry.",      country:"KR",name:"매일경제 Maeil",           lang:"ko",flag:"🇰🇷",url:"https://www.mk.co.kr/rss/30100041/"},
  {id:"chosunbiz",desc:"Chosun's business arm — widely read by Korean executives; covers strategy and M&A.",  country:"KR",name:"조선비즈 Chosunbiz",      lang:"ko",flag:"🇰🇷",url:"https://biz.chosun.com/arc/outboundfeeds/rss/"},
  {id:"reuters_kr",desc:"Reuters Korea; covers Samsung, semiconductors, and BoK monetary policy in English.", country:"KR",name:"Reuters Korea",           lang:"en",flag:"🇰🇷",url:GN("site:reuters.com \"South Korea\" economy business")},
  {id:"bloom_kr",desc:"Bloomberg Korea; strong on Korean equities, currency, and export data.",   country:"KR",name:"Bloomberg Korea",         lang:"en",flag:"🇰🇷",url:GN("site:bloomberg.com \"South Korea\" markets economy"),paywall:true},
  // ── Taiwan ─────────────────────────────────────────────────────────────────
  {id:"taipei_t",desc:"Taiwan's main English daily; useful for government policy, cross-strait tension, and macro.",   country:"TW",name:"Taipei Times Business",  lang:"en",flag:"🇹🇼",url:GN("site:taipeitimes.com business"),paywall:true},
  {id:"focus_tw",desc:"CNA's English Taiwan feed; official wire — fast on policy announcements and corporate filings.",   country:"TW",name:"Focus Taiwan CNA",       lang:"en",flag:"🇹🇼",url:GN("site:focustaiwan.tw business"),paywall:true},
  {id:"udn_money",desc:"UDN Money — Taiwan's major Mandarin financial portal, auto-translated; strong on TSMC and tech supply chain.",  country:"TW",name:"經濟日報 UDN Money",       lang:"zh",flag:"🇹🇼",url:GN("site:money.udn.com","zh-TW","TW","TW:zh-Hant")},
  {id:"ctee",desc:"China Times Economy — influential Mandarin business paper, auto-translated; covers Taiwan equities and property.",       country:"TW",name:"工商時報 CTEE",            lang:"zh",flag:"🇹🇼",url:GN("site:ctee.com.tw","zh-TW","TW","TW:zh-Hant")},
  {id:"digitimes",desc:"The definitive English source for Taiwan semiconductor, electronics, and supply chain intelligence.",  country:"TW",name:"DigiTimes",              lang:"en",flag:"🇹🇼",url:GN("site:digitimes.com Taiwan semiconductor technology supply chain"),paywall:true},
  {id:"reuters_tw",desc:"Reuters Taiwan; essential for TSMC, semiconductors, and US-China tech trade.", country:"TW",name:"Reuters Taiwan",          lang:"en",flag:"🇹🇼",url:GN("site:reuters.com Taiwan economy business")},
  {id:"bloom_tw",desc:"Bloomberg Taiwan; covers TWD, TAIEX, and chip sector in depth.",   country:"TW",name:"Bloomberg Taiwan",        lang:"en",flag:"🇹🇼",url:GN("site:bloomberg.com Taiwan markets economy"),paywall:true},
  // ── India ──────────────────────────────────────────────────────────────────
  // Economic Times: direct RSS (free publication)
  {id:"econ_times",desc:"India's most-read financial daily; essential for NSE/BSE, RBI policy, and conglomerates.", country:"IN",name:"Economic Times",         lang:"en",flag:"🇮🇳",url:"https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",paywall:true},
  // Business Standard: direct RSS
  {id:"biz_std",desc:"Business Standard — analyst-favourite for macroeconomic depth and policy commentary.",    country:"IN",name:"Business Standard",      lang:"en",flag:"🇮🇳",url:"https://www.business-standard.com/rss/markets-106.rss",paywall:true},
  // Mint: direct RSS
  {id:"mint",desc:"Mint/Livemint — HT-owned; strong on startups, fintech, and technology investments.",       country:"IN",name:"Mint Markets",           lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/markets",paywall:true},
  {id:"mint2",desc:"Mint markets sub-feed; focused on Sensex, Nifty, and equity-specific news.",      country:"IN",name:"Mint Companies",         lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/companies",paywall:true},
  {id:"mint3",desc:"Mint companies sub-feed; earnings, M&A, and corporate strategy.",      country:"IN",name:"Mint Economy",            lang:"en",flag:"🇮🇳",url:"https://www.livemint.com/rss/economy",paywall:true},
  {id:"hindubiz",desc:"The Hindu BusinessLine — rigorous, less breathless than peers; good for agriculture and rural economy.",   country:"IN",name:"Hindu BusinessLine",     lang:"en",flag:"🇮🇳",url:"https://www.thehindubusinessline.com/?service=rss",paywall:true},
  {id:"fin_exp",desc:"Financial Express — Indian Express Group's financial arm; strong on banking and government schemes.",    country:"IN",name:"Financial Express",       lang:"en",flag:"🇮🇳",url:"https://www.financialexpress.com/feed/",paywall:true},
  // Moneycontrol: direct RSS
  {id:"moneyctrl",desc:"Moneycontrol — India's highest-traffic financial site; fastest on markets and breaking corporate news.",  country:"IN",name:"Moneycontrol Markets",   lang:"en",flag:"🇮🇳",url:"https://www.moneycontrol.com/rss/business.xml",paywall:true},
  {id:"cnbctv18",desc:"CNBC TV18 — real-time Indian market television wire; good for intraday flow and broker commentary.",   country:"IN",name:"CNBC-TV18 Markets",      lang:"en",flag:"🇮🇳",url:"https://www.cnbctv18.com/commonfeeds/v1/eng/rss/market.xml"},
  {id:"forbes_in",desc:"Forbes India — features-driven; valuable for billionaire moves, startup funding, and deals.",  country:"IN",name:"Forbes India",           lang:"en",flag:"🇮🇳",url:GN("site:forbesindia.com economy business markets"),paywall:true},
  {id:"reuters_in",desc:"Reuters India; authoritative on RBI, macro data, and large-cap corporates in English.", country:"IN",name:"Reuters India",           lang:"en",flag:"🇮🇳",url:GN("site:reuters.com India economy business markets")},
  {id:"bloom_in",desc:"Bloomberg India; covers Sensex, rupee, and major conglomerates like Reliance and Adani.",   country:"IN",name:"Bloomberg India",         lang:"en",flag:"🇮🇳",url:GN("site:bloomberg.com India markets economy"),paywall:true},
  // ── Australia ──────────────────────────────────────────────────────────────
  // AFR: heavily paywalled — broader query without site: filter
  {id:"afr",desc:"Australia's Financial Review — the AFR; essential for ASX, RBA policy, and mining.",        country:"AU",name:"Australian Fin. Review", lang:"en",flag:"🇦🇺",url:GN("Australian Financial Review markets economy business"),paywall:true},
  // The Australian: paywalled — broader query
  {id:"guardian_au",desc:"The Guardian Australia Business — quality long-form; good for ESG, regulation, and macro critique.",country:"AU",name:"Guardian Australia Business",lang:"en",flag:"🇦🇺",url:"https://www.theguardian.com/australia-news/rss"},
  {id:"the_aus",desc:"The Australian Business — Murdoch flagship; strong on resources, infrastructure, and government.",    country:"AU",name:"The Australian Business",lang:"en",flag:"🇦🇺",url:GN("The Australian newspaper business economy finance"),paywall:true},
  // ABC: free public broadcaster — GN fine
  {id:"abc_au",desc:"ABC News Australia Business — public broadcaster; balanced and strong on commodities and rural economy.",     country:"AU",name:"ABC Business",           lang:"en",flag:"🇦🇺",url:"https://www.abc.net.au/news/feed/51120/rss.xml"},
  // SMH: soft paywall — direct RSS
  {id:"smh",desc:"Sydney Morning Herald Business — one of Australia's oldest mastheads; good for property and finance.",        country:"AU",name:"Sydney Morning Herald",  lang:"en",flag:"🇦🇺",url:"https://www.smh.com.au/rss/feed.xml"},
  {id:"reuters_au",desc:"Reuters Australia; covers RBA, iron ore, LNG, and major ASX corporates.", country:"AU",name:"Reuters Australia",       lang:"en",flag:"🇦🇺",url:GN("site:reuters.com Australia economy business")},
  {id:"bloom_au",desc:"Bloomberg Australia; strong on RBA rate decisions, mining majors, and AUD moves.",   country:"AU",name:"Bloomberg Australia",     lang:"en",flag:"🇦🇺",url:GN("site:bloomberg.com Australia markets economy"),paywall:true},
  // ── China ──────────────────────────────────────────────────────────────────
  {id:"kr36",desc:"36Kr — China's leading tech and startup news site, auto-translated; essential for VC deals and unicorns.",        country:"CN",name:"36Kr 快讯",              lang:"zh",flag:"🇨🇳",url:GN("36氪 融资 科技 独角兽","zh-CN","CN","CN:zh-Hans")},
  {id:"caixin",desc:"Caixin Global — China's most credible independent financial journalism; known for breaking regulatory news.",     country:"CN",name:"Caixin Global",          lang:"en",flag:"🇨🇳",url:GN("site:caixinglobal.com economy finance"),paywall:true},
  {id:"xinhua",desc:"Xinhua — China's state wire; first with official announcements, policy signals, and economic data releases.",      country:"CN",name:"Xinhua Finance",           lang:"en",flag:"🇨🇳",url:GN("site:english.news.cn OR site:xinhuanet.com economy finance")},
  {id:"cgtn",desc:"CGTN Business — state broadcaster's English arm; reflects official Chinese economic narrative.",        country:"CN",name:"CGTN Business",             lang:"en",flag:"🇨🇳",url:"https://www.cgtn.com/subscribe/rss/section/business.xml"},
  {id:"chinadaily",desc:"China Daily Business — state-owned English daily; useful for understanding Beijing's policy framing.",  country:"CN",name:"China Daily Business",     lang:"en",flag:"🇨🇳",url:GN("site:chinadaily.com.cn business economy")},
  {id:"yicai",desc:"Yicai Global — respected Shanghai-based financial outlet; strong on Chinese equities and corporate moves.",       country:"CN",name:"Yicai Global",            lang:"en",flag:"🇨🇳",url:GN("site:yicaiglobal.com")},
  {id:"globaltimes",desc:"Global Times Economy — nationalistic state tabloid; tracks how Beijing wants economic news framed.", country:"CN",name:"Global Times Economy",     lang:"en",flag:"🇨🇳",url:GN("site:globaltimes.cn economy")},
  {id:"peoples_d",desc:"People's Daily Economy — the CCP organ; essential for reading between the lines on official policy.",   country:"CN",name:"People's Daily",          lang:"en",flag:"🇨🇳",url:"https://en.people.cn/rss/economy.xml"},
  {id:"reuters_cn",desc:"Reuters China; independent and fast on PBOC moves, trade data, and major corporate events.", country:"CN",name:"Reuters China",            lang:"en",flag:"🇨🇳",url:GN("site:reuters.com China economy business finance")},
  {id:"bloom_cn",desc:"Bloomberg China; authoritative on yuan, PBOC policy, and major index constituents.",   country:"CN",name:"Bloomberg China",          lang:"en",flag:"🇨🇳",url:GN("site:bloomberg.com China markets economy"),paywall:true},
  // ── Israel ─────────────────────────────────────────────────────────────────
  {id:"globes_il",desc:"Globes — Israel's financial daily of record; essential for TASE, Israeli tech IPOs, and shekel.",  country:"IL",name:"Globes Israel",            lang:"en",flag:"🇮🇱",url:GN("site:en.globes.co.il")},
  {id:"jpost_il",desc:"Jerusalem Post Business — Israel's most-read English paper; covers Israeli economy, startups, and US-Israel trade.",   country:"IL",name:"Jerusalem Post Business",  lang:"en",flag:"🇮🇱",url:GN("site:jpost.com business innovation technology")},
  {id:"toi_il",desc:"Times of Israel — well-sourced English outlet; strong on Israeli politics, tech sector, and regional conflict impact.",     country:"IL",name:"Times of Israel",          lang:"en",flag:"🇮🇱",url:GN("site:timesofisrael.com")},
  {id:"haaretz_il",desc:"Haaretz — Israel's liberal paper of record; strong investigative coverage of business, policy, and governance.", country:"IL",name:"Haaretz Israel",           lang:"en",flag:"🇮🇱",url:GN("site:haaretz.com Israel economy business technology"),paywall:true},
  {id:"ctech_il",desc:"CTech (Calcalist) — Israel's top English-language tech and VC publication; best for Israeli startup ecosystem.",   country:"IL",name:"Calcalist CTech",          lang:"en",flag:"🇮🇱",url:GN("site:calcalistech.com")},
  {id:"calcalist",desc:"כלכליסט — Israel's dedicated Hebrew financial daily, auto-translated; first-mover on TASE and corporate news.",  country:"IL",name:"כלכליסט Calcalist",        lang:"he",flag:"🇮🇱",url:GN("site:calcalist.co.il","iw","IL","IL:he")},
  {id:"reuters_il",desc:"Reuters Israel; covers Israeli equities, defence sector, and economic fallout from regional conflict.", country:"IL",name:"Reuters Israel",           lang:"en",flag:"🇮🇱",url:GN("site:reuters.com Israel")},
  {id:"bloom_il",desc:"Bloomberg Israel; strong on shekel, TASE index, and Israeli tech M&A.",   country:"IL",name:"Bloomberg Israel",         lang:"en",flag:"🇮🇱",url:GN("site:bloomberg.com Israel economy markets shekel"),paywall:true},
  // ── Middle East / Gulf ─────────────────────────────────────────────────────
  {id:"arabnews",desc:"Arab News — Saudi Arabia's flagship English daily; first on Vision 2030 projects and Saudi policy.",    country:"ME",name:"Arab News",               lang:"en",flag:"🌍",url:GN("site:arabnews.com")},
  {id:"arabnews_biz",desc:"Arab News Economy — dedicated business feed; covers Gulf M&A, energy deals, and giga-projects.",country:"ME",name:"Arab News Economy",       lang:"en",flag:"🌍",url:GN("site:arabnews.com economy energy")},
  {id:"national_ae",desc:"The National — Abu Dhabi's quality English broadsheet; best for UAE sovereign wealth and ADNOC news.", country:"ME",name:"The National UAE",        lang:"en",flag:"🌍",url:GN("site:thenationalnews.com business economy energy")},
  {id:"gulfnews",desc:"Gulf News — Dubai-based; wide regional coverage of UAE, Saudi, and Gulf corporate news.",    country:"ME",name:"Gulf News Business",      lang:"en",flag:"🌍",url:GN("site:gulfnews.com business economy")},
  {id:"arabianbiz",desc:"Arabian Business — pan-Gulf English magazine; strong on real estate, construction, and billionaire profiles.",  country:"ME",name:"Arabian Business",        lang:"en",flag:"🌍",url:"https://www.arabianbusiness.com/feed"},
  {id:"agbi",desc:"AGBI — Gulf Business Intelligence; specialist in GCC investment, trade, and financial regulation.",        country:"ME",name:"AGBI Gulf Business",      lang:"en",flag:"🌍",url:"https://www.agbi.com/feed"},
  {id:"tradearabia",desc:"Asharq Al-Awsat Business — pan-Arab broadsheet's business arm; credible on Gulf macro and oil.", country:"ME",name:"Asharq Al-Awsat Business",             lang:"en",flag:"🌍",url:GN("site:english.aawsat.com business economy Gulf")},
  {id:"gulftimes",desc:"Gulf Times — Qatar's main English daily; essential for QIA, LNG, and Qatari economic developments.",   country:"ME",name:"Gulf Times Qatar",        lang:"en",flag:"🌍",url:GN("site:gulf-times.com business economy")},
  {id:"khaleej",desc:"Khaleej Times — UAE's oldest English daily; broad business coverage of Dubai and wider UAE economy.",     country:"ME",name:"Khaleej Times UAE",       lang:"en",flag:"🌍",url:GN("site:khaleejtimes.com business economy")},
  {id:"alarabiya",desc:"Al Arabiya Business — MBC-owned; fast English news on Gulf markets and geopolitical risk.",   country:"ME",name:"Al Arabiya Business",     lang:"en",flag:"🌍",url:GN("site:english.alarabiya.net business economy")},
  {id:"saudigazette",desc:"Saudi Gazette — English daily in Riyadh; covers Saudi government, Aramco, and Vision 2030 projects.",country:"ME",name:"Saudi Gazette",           lang:"en",flag:"🌍",url:"https://www.saudigazette.com.sa/feed"},
  {id:"zawya",desc:"Zawya — LSEG-owned MENA business intelligence platform; strong on GCC corporate filings and deals.",       country:"ME",name:"Zawya MENA",              lang:"en",flag:"🌍",url:"https://www.zawya.com/sitemaps/en/rss"},
  {id:"gulfbiz",desc:"Gulf Business — Dubai-based English magazine; covers C-suite news, rankings, and Gulf conglomerates.",     country:"ME",name:"Gulf Business",           lang:"en",flag:"🌍",url:"https://gulfbusiness.com/feed/"},
  // MENAFN: regional financial wire with per-GCC-country RSS
  {id:"menafn_sa",desc:"MENAFN Saudi — press release wire for Saudi corporates; useful for earnings and regulatory filings.",   country:"ME",name:"MENAFN Saudi",            lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=SaudiArabia"},
  {id:"menafn_uae",desc:"MENAFN UAE — press release wire for UAE corporates; useful for earnings and regulatory filings.",  country:"ME",name:"MENAFN UAE",              lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=UAE"},
  {id:"menafn_qa",desc:"MENAFN Qatar — press release wire for Qatari corporates; useful for QIA-linked announcements.",   country:"ME",name:"MENAFN Qatar",            lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Qatar"},
  {id:"menafn_kw",desc:"MENAFN Kuwait — press release wire covering KSE-listed companies and Kuwaiti government initiatives.",   country:"ME",name:"MENAFN Kuwait",           lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Kuwait"},
  {id:"menafn_bh",desc:"MENAFN Bahrain — covers Bahrain Bourse and the island's financial services and fintech sector.",   country:"ME",name:"MENAFN Bahrain",          lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Bahrain"},
  {id:"menafn_om",desc:"MENAFN Oman — covers MSM (Muscat Stock Exchange) and Omani energy and logistics projects.",   country:"ME",name:"MENAFN Oman",             lang:"en",flag:"🌍",url:"https://menafn.com/Rss/RssFeeds.aspx?section=Oman"},
  {id:"reuters_me",desc:"Reuters Gulf; covers oil prices, OPEC+ decisions, and major Gulf sovereign moves in English.",  country:"ME",name:"Reuters Gulf",            lang:"en",flag:"🌍",url:GN("site:reuters.com Saudi Arabia UAE Qatar Kuwait Oman Bahrain economy")},
  {id:"bloom_me",desc:"Bloomberg Gulf; strong on Saudi Aramco, UAE banks, and Gulf currency pegs.",    country:"ME",name:"Bloomberg Gulf",          lang:"en",flag:"🌍",url:GN("site:bloomberg.com Saudi Arabia UAE Qatar Kuwait Gulf economy"),paywall:true},
  {id:"alarabiya_ar",desc:"العربية — leading pan-Arab TV network's business feed, auto-translated; fast on Gulf market sentiment.",country:"ME",name:"العربية أعمال",           lang:"ar",flag:"🌍",url:GN("site:alarabiya.net اقتصاد أعمال","ar","SA","SA:ar")},

  // ── Iran ──────────────────────────────────────────────────────────────────
  // Iran International: London-based, critical of regime, English + Farsi; best external coverage
  {id:"iranintl",desc:"Iran International — London-based, independent; most trusted external source on Iran's economy and crisis.",    country:"IR",name:"Iran International",     lang:"en",flag:"🇮🇷",url:GN("\"Iran International\" Iran politics military economy Hormuz")},
  // Tehran Times: state-adjacent English daily, useful for official Iran perspective
  {id:"tehrantimes",desc:"Tehran Times — state-adjacent English daily; reflects official Iranian government economic narrative.", country:"IR",name:"Tehran Times",           lang:"en",flag:"🇮🇷",url:GN("Tehran Times Iran economy politics")},
  // Financial Tribune: only non-govt Iranian English business paper (may be offline during conflict)
  {id:"fin_trib",desc:"Financial Tribune — Iran's only non-government English business paper; covers Iranian equities and trade.",    country:"IR",name:"Financial Tribune",      lang:"en",flag:"🇮🇷",url:GN("Financial Tribune Iran business economy markets")},
  // IRNA: official Islamic Republic News Agency, English feed
  {id:"irna_en",desc:"IRNA — Islamic Republic's official wire; first with government statements, sanctions responses, and data.",     country:"IR",name:"IRNA English",           lang:"en",flag:"🇮🇷",url:GN("IRNA Iran official government economy")},
  // Tasnim News: semi-official Iranian wire agency, English RSS
  {id:"tasnim",desc:"Tasnim News — semi-official Iranian agency; covers IRGC-linked industries, energy, and trade.",      country:"IR",name:"Tasnim News",            lang:"en",flag:"🇮🇷",url:GN("Tasnim News Iran IRGC energy")},
  // Mehr News: state-owned Iranian news agency, English
  {id:"mehrnews",desc:"Mehr News — state-owned Iranian agency; strong on industry, infrastructure, and domestic economy.",    country:"IR",name:"Mehr News Agency",       lang:"en",flag:"🇮🇷",url:GN("Mehr News Iran industry infrastructure")},
  // IFP News: Independent (covers wide Iran topics), English RSS
  {id:"ifpnews",desc:"IFP News — aggregates and translates from leading Persian sources; useful cross-section of Iranian press.",     country:"IR",name:"IFP News",               lang:"en",flag:"🇮🇷",url:GN("IFP News Iran politics economy")},
  // Entekhab: major Persian-language news site, auto-translated
  {id:"entekhab",desc:"انتخاب — one of Iran's most-read Persian news portals, auto-translated; broad economic and political coverage.",    country:"IR",name:"انتخاب Entekhab",        lang:"fa",flag:"🇮🇷",url:GN("site:entekhab.ir","fa","IR","IR:fa")},
  // Tabnak: Persian news site covering economy/politics, auto-translated
  {id:"tabnak",desc:"تابناک — Persian outlet with close ties to Iranian political factions, auto-translated; useful for policy signals.",      country:"IR",name:"تابناک Tabnak",          lang:"fa",flag:"🇮🇷",url:GN("site:tabnak.ir اقتصاد","fa","IR","IR:fa")},
  // Reuters & Bloomberg Iran-specific feeds
  {id:"reuters_ir",desc:"Reuters Iran; independent English coverage of sanctions, nuclear talks, and Iranian economic conditions.",  country:"IR",name:"Reuters Iran",           lang:"en",flag:"🇮🇷",url:GN("site:reuters.com Iran economy nuclear sanctions")},
  {id:"bloom_ir",desc:"Bloomberg Iran; covers oil output, rial, and impact of sanctions and conflict on Iranian markets.",    country:"IR",name:"Bloomberg Iran",         lang:"en",flag:"🇮🇷",url:GN("site:bloomberg.com Iran economy nuclear sanctions"),paywall:true},
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
      // Strip Google News source suffix e.g. "Headline - Source Name"
      // and datestamp garbage e.g. "20260303 - 即時財經新聞 - 明報財經網"
      title = title
        .replace(/\s*[-–]\s*\d{8}\s*[-–].*$/,"")   // remove date suffix
        .replace(/\s*[-–]\s*[^-–]{3,50}$/, "")       // remove source suffix
        .trim();
      if (!title) return null;
      // Filter bot-challenge / captcha junk titles that some sites return via proxy
      const JUNK_PATTERNS = [
        // Promotional / non-essential corporate PR noise
        /\\b(award[s]?|recogni[sz]|certif|named one of|best place|top \\d+ company|proud to announce|thrilled to|excited to|sponsorship|celebrate[s]?|anniversary)\\b/i,
        // Seeking Alpha opinion/income-investing noise
        /\\b(why i (bought|sold|own|like)|my top pick|portfolio update|buy the dip|passive income|monthly dividend|drip investing|high yield|income investor|deep dive into|a closer look at|dividend king|dividend aristocrat)\\b/i,
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
        translatedTitle: null, insight: null, sector: null, duplicateOf: null, isMicro: classifyMicro(title),
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
// Company/micro news classifier — keywords indicating company-specific, actionable news
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
// Resolve a duplicate group: prefer free article; track original paywalled source
function resolveGroup(arts) {
  // arts = array of articles that are duplicates of each other
  const src = id => SOURCES.find(s=>s.id===id);
  // Separate free vs paywalled
  const free    = arts.filter(a=>!src(a.sourceId)?.paywall);
  const paywalled = arts.filter(a=> src(a.sourceId)?.paywall);
  // Pick best canonical: free first (most recent free), else most recent overall
  const byDate = a => a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
  const pool   = free.length ? free : paywalled;
  const canon  = pool.slice().sort((a,b)=>byDate(b)-byDate(a))[0];
  // If canon is free but there are paywalled originals, record original source for attribution
  // We pick the highest-ranked paywalled source as the "original"
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
// Publisher families: same outlet, different feed IDs — deduplicate more aggressively
const PUBLISHER_FAMILIES = [
  ["bloomberg","bloomberg2"],
  ["wsj","wsj2"],
];
function sameFamily(idA, idB) {
  return PUBLISHER_FAMILIES.some(fam=>fam.includes(idA)&&fam.includes(idB));
}
function localDedup(articles) {
  // Step 1: exact-ID dedup — same title hash = same article, keep only the first occurrence
  const seenIds = new Set();
  const uniqueArts = [];
  const exactDupes = [];
  for (const art of articles) {
    if (seenIds.has(art.id)) exactDupes.push({...art, duplicateOf: art.id});
    else { seenIds.add(art.id); uniqueArts.push(art); }
  }

  // Step 2: fuzzy Jaccard dedup — track by index to avoid same-ID collisions
  const seen = [];        // [{fp, idx}]
  const groupMap = {};    // canonIdx -> [art, ...]
  const posToGroup = {};  // artIdx -> canonIdx (for null slots)

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

  // Pre-resolve each group once; build a map: original art position → resolved art
  const resolvedAtPos = {}; // artIdx → resolved article
  Object.entries(groupMap).forEach(([canonIdxStr, grpArts]) => {
    const canonIdx = Number(canonIdxStr);
    const resolved = resolveGroup(grpArts);
    // resolved[0] is the new canonical; rest are marked duplicateOf
    grpArts.forEach((origArt, j) => {
      // find the matching resolved article (matched by original id+sourceId)
      const match = resolved.find(r => r.sourceId === origArt.sourceId && r.id === origArt.id)
                 || resolved[j];
      // find the position in uniqueArts
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
// Haiku: fast + cheap — used for translation, enrichment, summaries
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

// All Claude calls use Haiku — fast and cost-effective

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHMENT — translate + insight + sector
// ═══════════════════════════════════════════════════════════════════════════════
// Translate a single non-English title using Google Translate free endpoint
async function googleTranslate(text, sourceLang) {
  // Try up to 2 language variants
  const langs = sourceLang === "zh" ? ["zh-CN", "zh-TW"] : [sourceLang];
  for (const lang of langs) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translated = data?.[0]?.map(x=>x?.[0]||"").join("") || "";
      // Check result is actually English (not CJK)
      const cjkRatio = (translated.match(/[\u4e00-\u9fff\uac00-\ud7ff]/g)||[]).length / (translated.length||1);
      if (translated && cjkRatio < 0.1) return translated;
    } catch {}
  }
  return text; // return original if all attempts fail
}

async function enrichBatch(articles) {
  if(!articles.length) return [];

  // Step 1: Pre-translate all non-English titles via Google Translate
  const withTranslations = await Promise.all(articles.map(async a => {
    if (a.lang === "en") return { ...a, _preTranslated: a.title };
    const translated = await googleTranslate(a.title, a.lang === "zh" ? "zh-CN" : a.lang);
    return { ...a, _preTranslated: translated };
  }));

  // Step 2: Enrich with Claude using pre-translated titles
  const prompt=`Financial analyst. For each headline return a JSON array (one object per item).
Each item: {"translated":"<English title>","insight":"<one sentence investor takeaway>","sector":"<code>"}
Use EXACTLY the pre-translated title provided — do not re-translate.
Sector codes: FIN=banks/insurance/capital markets, IT=software/hardware/semis, IND=manufacturing/transport/conglomerates, CD=autos/retail/luxury/leisure, CS=food/beverages/household, HC=pharma/biotech/hospitals, EN=oil/gas/renewables, MAT=mining/chemicals/steel, COM=media/telecom/internet platforms, RE=property/REITs, UTL=power/water, MAC=central bank/rates/GDP/trade/FX/fiscal/elections/tariffs, UNK=unclear.
Return ONLY a valid JSON array. ${withTranslations.length} items:
${withTranslations.map((a,i)=>`${i}. ${a._preTranslated}`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 2000);
    const cleaned = text.replace(/```json|```/g,"").trim();
    return JSON.parse(cleaned);
  } catch { 
    // Fallback: return pre-translations without insight
    return withTranslations.map(a=>({translated:a._preTranslated, insight:"", sector:"UNK"}));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNLIMITED SUMMARY — splits into chunks, summarises each, then synthesises
// ═══════════════════════════════════════════════════════════════════════════════
async function generateBriefUnlimited(articles, label) {
  if (!articles.length) return {text:"", articles:[]};
  const sourceArticles = articles; // keep reference for link matching

  // Split into chunks of 25 and summarise ALL in parallel — no sequential steps
  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < articles.length; i += CHUNK) chunks.push(articles.slice(i, i + CHUNK));

  if (chunks.length === 1) {
    const prompt = `You are a senior financial analyst writing a detailed investment briefing for ${label}.

Use this exact format:

## [Descriptive title summarising the main theme, e.g. "Korea Markets: Tech Sell-off Amid Fed Uncertainty"]

[2-3 sentence executive summary of the most important developments and overall market tone]

## [Section heading for first major theme, e.g. "Energy & Commodities"]
- [Specific development with context and investor implication. Be precise — name companies, figures, percentages where available. Explain WHY it matters to investors.]
- [Next bullet — same level of detail]

## [Section heading for second major theme]
- [Detailed bullet with company names and implications]
- [Next bullet]

(Add as many sections and bullets as needed to cover all significant stories)

## Risks & Outlook
- [Specific risk with context]
- [Opportunity or thing to watch]

Rules:
- Each bullet must be 1-2 sentences with real detail and investor perspective
- Name EVERY company mentioned in the headlines
- End each bullet with [REF:N] citing the article number(s) that support it (e.g. [REF:2] or [REF:0,4])
- Group related stories under thematic section headers
- Do not use vague language — be specific about what happened and why it matters
- COVERAGE PRIORITY: Cover US and China stories first and most thoroughly. Then HK, Korea, Taiwan, India, Australia, Israel, Middle East, Iran. Then Singapore and Canada. Ensure at least one bullet for each market with stories.
- MICRO/COMPANY BALANCE: At least 40% of bullets must be company-specific. For each company story, state: (1) company name and ticker if known, (2) the specific event (earnings beat/miss by how much, M&A size, dividend change %, CEO name change, rating change with new target), (3) the investment implication or peer read-across. NEVER let macro crowd out company news entirely.
- MICRO PRIORITY: Earnings results, M&A, dividend changes, CEO appointments, analyst upgrades/downgrades, and guidance changes are HIGHEST PRIORITY — always include these even if it means dropping a secondary macro story.
- INDUSTRY TRENDS: When multiple company stories exist in the same sector or region, explicitly call out the industry-level pattern (e.g. "Three Hong Kong developers reported margin compression this quarter, suggesting sector-wide cost pressure"). Use company news to surface cross-company trends.
- MARKET WEIGHTS: Prioritise company-specific news from US, Hong Kong, Taiwan, Canada, Singapore, Germany/Europe, and Australia. These markets have the most investment-relevant micro coverage in these sources.

Articles (cite using [REF:N] at end of each bullet, N = article number, can cite multiple e.g. [REF:0,3]):
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} — ${a.source}`).join("\n")}`;
    const text = await callClaude(prompt, 6000);
    return {text, articles: sourceArticles};
  }

  // Multiple chunks — ALL summarised in parallel, then one fast synthesis
  const summaries = await Promise.all(chunks.map((chunk, ci) => {
    const offset = ci * CHUNK;
    const prompt = `Summarise these headlines for ${label}. For each story, name the company, what happened, and the investor implication in 1 sentence. Include the article number in parentheses at the end of each sentence so it can be cited, e.g. "(article 3)".
${chunk.map((a,i)=>`${offset+i}. ${a.translatedTitle||a.title} [${a.source}]`).join("\n")}`;
    return callClaude(prompt, 800);
  }));

  // Build a flat article index so the synthesis can emit [REF:N] links
  const articleIndex = articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} — ${a.source}`).join("\n");

  const synthPrompt = `You are a senior financial analyst. Synthesise these summaries into a detailed investment briefing for ${label}.

Format:
## [Descriptive title capturing the main theme]

[2-3 sentence executive summary of the key developments]

## [Thematic section heading]
- [Detailed bullet: company name + what happened + investor implication, 1-2 sentences. End with [REF:N] citing the article number.]
- [Next bullet — same detail and citation]

## [Next thematic section]
- [Detailed bullet with [REF:N] citation]

## Risks & Outlook
- [Specific risk or opportunity with [REF:N] citation]

Rules:
- Name every company, be specific with figures/percentages, explain investor implications, group by theme.
- EVERY bullet must end with [REF:N] or [REF:N,M] citing the article number(s) from the index below that support it.
- Use the article index to find the correct N for each claim.
- The summaries include "(article N)" references — convert these to [REF:N] in the format above.
- COVERAGE PRIORITY: When this is a Breaking News brief, lead with US and China stories, then HK/Korea/Taiwan/India/Australia/Israel/Middle East/Iran, then Singapore/Canada. Ensure every market with articles gets at least one bullet.
- MICRO/COMPANY BALANCE: Dedicate at least one full section to company-specific developments (earnings, M&A, analyst rating changes, dividends, executive changes). Name every company explicitly.

Article index (use N in [REF:N]):
${articleIndex}

Summaries to synthesise:
${summaries.map((s,i)=>`[Chunk ${i+1}]: ${s}`).join("\n")}`;
  const text = await callClaude(synthPrompt, 6000);
  return {text, articles: sourceArticles};
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Fast local check: does article directly mention keyword?
function directMatch(art, keyword) {
  const kw = keyword.toLowerCase();
  const text = `${art.translatedTitle||art.title} ${art.description||""} ${art.insight||""}`.toLowerCase();
  return text.includes(kw);
}

// Claude: intelligent batch relevance check for a keyword across all articles
async function intelligentMatch(keyword, articles) {
  if (!articles.length) return [];
  // Send all articles at once — Claude decides which are relevant and why
  const prompt=`You are an investment research analyst monitoring news for relevance to a specific subject.

Subject being tracked: "${keyword}"

Your job: For EACH headline below, decide if it is relevant to "${keyword}" — either DIRECTLY (mentions it) or INDIRECTLY (affects it, involves competitors/peers/suppliers/customers/regulators/macro factors that impact it).

Think broadly: if tracking "Samsung", flag news about TSMC, SK Hynix, Apple, Qualcomm, memory chip demand, Korean Won, Korean economy, semiconductor regulations, etc.
If tracking "Fed" or "interest rates", flag inflation data, bond markets, bank earnings, housing data, etc.
If tracking a sector like "semiconductors", flag any company, policy, or macro event that affects the supply chain.

Return ONLY a JSON array. Include ONLY relevant articles (skip irrelevant ones):
[{"idx": <number>, "matchType": "direct"|"related", "reason": "brief explanation of why relevant (1 sentence)"}]

${articles.length} headlines:
${articles.map((a,i)=>`${i}. ${a.translatedTitle||a.title} [${a.source}, ${a.country}]`).join("\n")}`;

  try {
    const text = await callClaude(prompt, 3000);
    const clean = text.replace(/```json|```/g,"").trim();
    // Find the JSON array in the response
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch { return []; }
}

// Run full watchlist analysis across all canonical articles
async function runWatchlistAnalysis(keywords, articles, onProgress) {
  // Reset all watchMatches
  let working = articles.map(a => ({ ...a, watchMatches: [] }));

  for (let ki = 0; ki < keywords.length; ki++) {
    const kw = keywords[ki].trim();
    if (!kw) continue;
    onProgress(`Analysing keyword ${ki+1}/${keywords.length}: "${kw}"…`);

    // Split into batches of 50 for Claude (context efficiency)
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
        // Avoid duplicate match entries for same keyword
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

// Generate a keyword intelligence brief
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
  const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.25;
  const rawTitle = art.translatedTitle || art.title;
  const displayTitle = isCJK(rawTitle) && art.lang !== "en"
    ? (art.translatedTitle && !isCJK(art.translatedTitle) ? art.translatedTitle : "[Translation pending…] " + rawTitle)
    : rawTitle;

  // Watchlist match info
  const directMatches = (art.watchMatches||[]).filter(m=>m.matchType==="direct");
  const relatedMatches = (art.watchMatches||[]).filter(m=>m.matchType==="related");
  const isHighlighted = art.watchMatches?.length > 0;

  // If we're in watchlist view filtering by a keyword, show that match's reason
  const focusMatch = highlightKeyword
    ? art.watchMatches?.find(m=>m.keyword===highlightKeyword)
    : null;

  return (
    <div style={{
      padding:"13px 0",
      borderBottom:"1px solid #e8e2d6",
      animation:"fadeIn 0.3s ease",
      background: isHighlighted ? "linear-gradient(90deg,#c9a84c04 0%,transparent 100%)" : "transparent",
      borderLeft: isHighlighted ? `2px solid ${directMatches.length?"#c0392b":"#4a9eff"}` : "2px solid transparent",
      paddingLeft: isHighlighted ? 10 : 0,
    }}>
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
              background:"#f5f0e8",padding:"1px 6px",borderRadius:3,
              border:"1px solid #e0d8cc"}}>
              {label}
            </span>
          );
        })()}
        {art.lang!=="en" && <Tag color="#7a8fa6">{art.lang.toUpperCase()}→EN</Tag>}
        {sec && sec.code!=="UNK" && <Tag color={sec.color}>{sec.icon} {sec.label}</Tag>}
        {/* Watchlist match badges */}
        {directMatches.map(m=>(
          <Tag key={m.keyword} color="#c0392b">⦿ {m.keyword}</Tag>
        ))}
        {relatedMatches.map(m=>(
          <Tag key={m.keyword} color="#4a9eff">◎ {m.keyword}</Tag>
        ))}
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

      {/* Focus match reason in watchlist view */}
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

// Find articles relevant to a bullet line by keyword overlap
function findLinksForBullet(bulletText, articles) {
  if (!articles?.length || !bulletText) return [];
  // Extract [REF:N,M,...] markers Claude inserts
  const refMatch = bulletText.match(/\[REF:([\d,\s]+)\]/);
  if (refMatch) {
    const indices = refMatch[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    return indices.map(i=>articles[i]).filter(Boolean);
  }
  // Fallback: keyword matching
  const words = bulletText.toLowerCase()
    .replace(/[^a-z0-9\s]/g," ").split(/\s+/)
    .filter(w => w.length > 4);
  return articles
    .map(a => {
      const haystack = ((a.translatedTitle||a.title)+" "+(a.source||"")).toLowerCase();
      const hits = words.filter(w => haystack.includes(w)).length;
      return {art: a, score: hits};
    })
    .filter(x => x.score >= 2)
    .sort((a,b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.art);
}

// Renders brief text with headers (##) and bullets (-) and LINK badges
function BriefRenderer({text, articles=[]}) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:14,marginTop:4}}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{height:6}}/>;
        // ## Section header
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
        // # Title header
        if (trimmed.startsWith("# ")) {
          return (
            <div key={i} style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:16,
              fontWeight:700,color:"#1a1a1a",margin:"4px 0 14px",lineHeight:1.3}}>
              {trimmed.replace(/^# /,"")}
            </div>
          );
        }
        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const txt = trimmed.replace(/^[-*] /,"");
          // Strip [REF:...] from display, use for links
          const cleanTxt = txt.replace(/\[REF:[\d,\s]+\]/g, "").trim();
          const boldMatch = cleanTxt.match(/^\*\*(.+?)\*\*:?\s*(.*)/s);
          const links = findLinksForBullet(txt, articles);
          return (
            <div key={i} style={{display:"flex",gap:8,margin:"8px 0",
              paddingLeft:8,alignItems:"flex-start"}}>
              <span style={{color:"#c0392b",fontWeight:700,marginTop:2,flexShrink:0,fontSize:16}}>•</span>
              <span style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:14,
                color:"#1a1a1a",lineHeight:1.7}}>
                {boldMatch
                  ? <><strong style={{color:"#1a1a1a"}}>{boldMatch[1]}</strong>{boldMatch[2] ? ": "+boldMatch[2] : ""}</>
                  : cleanTxt}
                {links.map((a,li) => {
                  const src = SOURCES.find(s=>s.id===a.sourceId);
                  const isPaywall = src?.paywall;
                  // Abbreviate source name: first 2 words, max 12 chars
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
        // Plain paragraph — executive summary box
        return (
          <p key={i} style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:14,
            color:"#1a1a1a",lineHeight:1.7,margin:"10px 0",
            background:"#f0ece4",padding:"14px 18px",borderRadius:4}}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function BriefBox({label, icon, briefKey, briefs, setBriefs, articles, loading, setLoading}) {
  const briefData=briefs[briefKey]; // {text, articles} or legacy string
  const brief = briefData?.text ?? (typeof briefData==="string" ? briefData : null);
  const briefArts = briefData?.articles ?? articles;
  const isLoading=loading[briefKey];
  const run=async()=>{
    setLoading(p=>({...p,[briefKey]:true}));
    const b=await generateBriefUnlimited(articles,label);
    setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
    setLoading(p=>({...p,[briefKey]:false}));
  };
  return (
    <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
      padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>{icon}</span>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.12em"}}>
              AI INVESTMENT BRIEF · {articles.length} articles analysed
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
// REGULATORY FILINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
const FILING_EXCHANGES = [
  { code:"US",  label:"🇺🇸 SEC (US)",       flag:"🇺🇸" },
  { code:"SG",  label:"🇸🇬 SGX",            flag:"🇸🇬" },
  { code:"HK",  label:"🇭🇰 HKEX",           flag:"🇭🇰" },
  { code:"AU",  label:"🇦🇺 ASX",            flag:"🇦🇺" },
  { code:"CA",  label:"🇨🇦 SEDAR+ (CA)",    flag:"🇨🇦" },
  { code:"DE",  label:"🇩🇪 BaFin / EUR",    flag:"🇩🇪" },
  { code:"TW",  label:"🇹🇼 TWSE",           flag:"🇹🇼" },
];

const SEC_FORM_TYPES = [
  { id:"8-K",  label:"8-K  Material Events",  desc:"Earnings, M&A, leadership changes, guidance" },
  { id:"10-Q", label:"10-Q Quarterly Results", desc:"Full quarterly financial statements" },
  { id:"10-K", label:"10-K Annual Report",     desc:"Full annual financial statements" },
  { id:"SC 13D",label:"13D  Large Stake",      desc:">5% ownership disclosures" },
  { id:"DEF 14A",label:"Proxy",               desc:"Shareholder votes, executive comp" },
];

// Fetch recent SEC EDGAR filings via public Atom feed — no API key required
// EDGAR Atom feed: each <entry> contains company-name, filing-type, filing-date, filing-href
async function fetchSecFilings(formType, count=30) {
  try {
    const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=${count}&search_text=&output=atom`;
    const res = await fetch(`/api/rss?url=${encodeURIComponent(edgarUrl)}`);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML parse error");
    const entries = [...doc.querySelectorAll("entry")];
    return entries.map(e => {
      const getText = tag => e.getElementsByTagNameNS("*", tag)[0]?.textContent?.trim() || "";
      const company = getText("company-name") || e.querySelector("title")?.textContent?.split(" - ")?.[0] || "";
      const ftype   = getText("filing-type") || formType;
      const filed   = getText("filing-date") || e.querySelector("updated")?.textContent?.slice(0,10) || "";
      const href    = getText("filing-href") || e.querySelector("link")?.getAttribute("href") || "";
      const title   = e.querySelector("title")?.textContent?.trim() || company;
      const accNum  = getText("accession-number") || "";
      return {
        id: accNum || (company + filed + ftype).replace(/\s/g,""),
        title, company, formType: ftype, filed, link: href,
        accNum, summary: null, summaryLoading: false,
      };
    }).filter(f => f.company || f.title);
  } catch(e) {
    console.warn("SEC EDGAR fetch error:", e.message);
    return [];
  }
}

// For non-US exchanges use Google News queries targeting official announcement language
async function fetchExchangeFilings(exchangeCode) {
  const queries = {
    SG: "SGX company earnings results dividend rights issue acquisition announcement site:sgx.com OR site:sginvestors.io",
    HK: "HKEX announcement earnings results dividend acquisition listing site:hkexnews.hk OR site:hkex.com.hk",
    AU: "ASX announcement earnings results dividend acquisition site:asx.com.au OR site:marketindex.com.au",
    CA: "SEDAR TSX company earnings results dividend acquisition announcement",
    DE: "BaFin DAX announcement earnings results dividend acquisition Bundesanzeiger",
    TW: "TWSE TPEX earnings announcement dividend acquisition Taiwan listed company",
  };
  const q = queries[exchangeCode];
  if (!q) return [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
    const text = await r.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    const items = [...doc.querySelectorAll("item")];
    return items.slice(0, 30).map(item => ({
      id: item.querySelector("guid")?.textContent || Math.random().toString(36),
      title: item.querySelector("title")?.textContent || "",
      company: item.querySelector("title")?.textContent?.split(":")?.[0] || "",
      formType: "Announcement",
      filed: item.querySelector("pubDate")?.textContent?.slice(0,16) || "",
      link: item.querySelector("link")?.textContent || "",
      summary: null,
      summaryLoading: false,
    }));
  } catch(e) {
    return [];
  }
}

function FilingsTab() {
  const [exchange,      setExchange]      = useState("US");
  const [secForm,       setSecForm]       = useState("8-K");
  const [filings,       setFilings]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [summaries,     setSummaries]     = useState({}); // id -> {text, loading}
  const [searchFilter,  setSearchFilter]  = useState("");
  const [batchLoading,  setBatchLoading]  = useState(false);

  const load = async () => {
    setLoading(true);
    setFilings([]);
    setSummaries({});
    // Tag exchange onto each filing for the summarise prompt
    const results = (exchange === "US"
      ? await fetchSecFilings(secForm, 30)
      : await fetchExchangeFilings(exchange)
    ).map(f => ({ ...f, exchange }));
    setFilings(results);
    setLoading(false);
  };

  // Summarise all visible filings sequentially (rate-limit friendly)
  const summariseAll = async () => {
    setBatchLoading(true);
    for (const f of filtered) {
      if (!summaries[f.id]?.text) {
        await summariseFiling(f);
        await new Promise(r => setTimeout(r, 300)); // small delay between calls
      }
    }
    setBatchLoading(false);
  };

  useEffect(() => { load(); }, [exchange, secForm]);

  const summariseFiling = async (filing) => {
    setSummaries(p => ({ ...p, [filing.id]: { text: null, loading: true } }));
    try {
      // Try to fetch the filing index page for more context
    let filingContext = "";
    if (filing.link) {
      try {
        const r = await fetch(`/api/rss?url=${encodeURIComponent(filing.link)}`);
        const txt = await r.text();
        // Extract plain text: strip HTML, truncate to ~800 chars for context
        filingContext = txt.replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,800);
      } catch(e) { /* ignore — use title only */ }
    }
    const prompt = `You are a buy-side analyst reviewing a regulatory filing. Provide a concise investment-focused summary.

Exchange: ${filing.exchange || "SEC"}
Form type: ${filing.formType}
Company: ${filing.company || "(unknown)"}
Filed: ${filing.filed}
Filing title: ${filing.title}
${filingContext ? `\nAdditional context (from filing index):\n${filingContext}` : ""}

Provide 3-5 bullet points covering:
• The material fact — what specifically happened
• Financial impact or key numbers (quantify if possible — beat/miss by how much, deal size, % change)
• Investment implication — is this positive/negative/neutral for the stock? Any sector read-across?
• Peer/industry trend signal if applicable
• Key risk or watch item

If you only have the title and no context, make reasonable inferences based on the form type and company name, but flag uncertainty. Be direct and specific — no hedging language.`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Summary unavailable.";
      setSummaries(p => ({ ...p, [filing.id]: { text, loading: false } }));
    } catch(e) {
      setSummaries(p => ({ ...p, [filing.id]: { text: "Error generating summary.", loading: false } }));
    }
  };

  const filtered = filings.filter(f =>
    !searchFilter || f.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    f.company.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const mono = { fontFamily:"'DM Mono',monospace" };

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {/* Header controls */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:20}}>
        <div style={{display:"flex",gap:6}}>
          {FILING_EXCHANGES.map(ex => (
            <button key={ex.code} onClick={()=>setExchange(ex.code)}
              style={{...mono,fontSize:11,padding:"4px 10px",borderRadius:4,cursor:"pointer",
                border: exchange===ex.code ? "2px solid #1a1a1a" : "1px solid #ccc",
                background: exchange===ex.code ? "#1a1a1a" : "#fff",
                color: exchange===ex.code ? "#fff" : "#333"}}>
              {ex.flag} {ex.code}
            </button>
          ))}
        </div>
        {exchange==="US" && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {SEC_FORM_TYPES.map(ft => (
              <button key={ft.id} onClick={()=>setSecForm(ft.id)}
                title={ft.desc}
                style={{...mono,fontSize:10,padding:"3px 8px",borderRadius:4,cursor:"pointer",
                  border: secForm===ft.id ? "2px solid #c0392b" : "1px solid #ccc",
                  background: secForm===ft.id ? "#c0392b" : "#fff",
                  color: secForm===ft.id ? "#fff" : "#555"}}>
                {ft.id}
              </button>
            ))}
          </div>
        )}
        <input value={searchFilter} onChange={e=>setSearchFilter(e.target.value)}
          placeholder="Filter by company or keyword…"
          style={{...mono,fontSize:11,padding:"4px 10px",border:"1px solid #ccc",borderRadius:4,
            background:"#fff",flex:1,minWidth:180}} />
        <button onClick={load} style={{...mono,fontSize:11,padding:"4px 10px",borderRadius:4,
          border:"1px solid #888",background:"#fff",cursor:"pointer"}}>
          ↺ Refresh
        </button>
        <button onClick={summariseAll} disabled={batchLoading||loading||filtered.length===0}
          style={{...mono,fontSize:11,padding:"4px 10px",borderRadius:4,cursor:"pointer",
            border:"1px solid #c0392b",background:"#fff5f5",color:"#c0392b",
            opacity:(batchLoading||loading||filtered.length===0)?0.4:1}}>
          {batchLoading ? "⊕ Summarising…" : `⊕ Summarise All (${filtered.length})`}
        </button>
      </div>

      {/* Description bar */}
      <div style={{...mono,fontSize:10,color:"#888",marginBottom:16,padding:"6px 10px",
        background:"#f9f5ed",borderRadius:4,border:"1px solid #e8e2d6"}}>
        {exchange==="US"
          ? `SEC EDGAR — ${SEC_FORM_TYPES.find(f=>f.id===secForm)?.label}: ${SEC_FORM_TYPES.find(f=>f.id===secForm)?.desc}. Filed in the last 48 hours. Click "Summarise" for AI analysis.`
          : `${FILING_EXCHANGES.find(e=>e.code===exchange)?.label} — Company announcements and regulatory disclosures. Click "Summarise" for AI analysis.`
        }
      </div>

      {loading && (
        <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>
          Loading filings…
        </div>
      )}

      {!loading && filtered.length===0 && (
        <div style={{textAlign:"center",padding:40,color:"#888",...mono,fontSize:12}}>
          No filings found. Try refreshing or changing the filter.
        </div>
      )}

      {/* Filing cards */}
      {filtered.map(filing => {
        const sum = summaries[filing.id];
        return (
          <div key={filing.id} style={{borderBottom:"1px solid #e8e2d6",padding:"14px 0"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{...mono,fontSize:9,background:"#1a1a1a",color:"#fff",
                    padding:"2px 6px",borderRadius:3}}>
                    {filing.formType}
                  </span>
                  <span style={{...mono,fontSize:9,color:"#888"}}>
                    {filing.filed ? new Date(filing.filed).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : ""}
                  </span>
                  {classifyMicro(filing.title) && (
                    <span style={{...mono,fontSize:9,background:"#2e7d32",color:"#fff",
                      padding:"2px 6px",borderRadius:3}}>◈ MATERIAL</span>
                  )}
                </div>
                <a href={filing.link} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:14,fontWeight:500,color:"#1a1a1a",textDecoration:"none",
                    lineHeight:1.4,display:"block",marginBottom:4}}>
                  {filing.title}
                </a>
              </div>
              <button onClick={()=>summariseFiling(filing)}
                disabled={sum?.loading}
                style={{...mono,fontSize:10,padding:"4px 10px",borderRadius:4,cursor:"pointer",
                  border:"1px solid #c0392b",background: sum?.text ? "#fff5f5" : "#fff",
                  color:"#c0392b",whiteSpace:"nowrap",flexShrink:0,
                  opacity: sum?.loading ? 0.5 : 1}}>
                {sum?.loading ? "…" : sum?.text ? "✓ Summarised" : "⊕ Summarise"}
              </button>
            </div>
            {sum?.text && (
              <div style={{marginTop:10,padding:"10px 14px",background:"#fdf6e3",
                borderRadius:4,border:"1px solid #e8d9a0",fontSize:12,lineHeight:1.65,
                whiteSpace:"pre-wrap"}}>
                {sum.text}
              </div>
            )}
          </div>
        );
      })}

      <div style={{...mono,fontSize:9,color:"#aaa",textAlign:"center",marginTop:24,paddingBottom:8}}>
        {exchange==="US" ? "Source: SEC EDGAR public API · Free · No API key required" : "Source: Google News · Exchange announcement feeds"}
        {" · "}{filtered.length} filings shown
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
  const [activeKw,     setActiveKw]     = useState(null); // which keyword to view
  const [kwBriefs,     setKwBriefs]     = useState({});
  const [kwBriefLoad,  setKwBriefLoad]  = useState({});
  const [lastAnalysed, setLastAnalysed] = useState(null);

  // Load from storage
  useEffect(()=>{
    sGet(SK.watchlist).then(kws=>{ if(kws) setKeywords(kws); });
    sGet(SK.watchHits).then(hits=>{
      // hits are stored as { articleId: [{keyword, matchType, reason}] }
      if(!hits) return;
      setAllArticles(prev=>prev.map(a=>({
        ...a,
        watchMatches: hits[a.id] || a.watchMatches || []
      })));
    });
  },[]);

  const canonical = allArticles.filter(a=>!a.duplicateOf);

  const addKeyword = () => {
    const kw = inputVal.trim();
    if (!kw || keywords.includes(kw)) { setInputVal(""); return; }
    const updated = [...keywords, kw];
    setKeywords(updated);
    sSet(SK.watchlist, updated);
    setInputVal("");
  };

  const removeKeyword = (kw) => {
    const updated = keywords.filter(k=>k!==kw);
    setKeywords(updated);
    sSet(SK.watchlist, updated);
    if (activeKw===kw) setActiveKw(null);
    // Clear matches for this keyword
    setAllArticles(prev=>prev.map(a=>({
      ...a,
      watchMatches:(a.watchMatches||[]).filter(m=>m.keyword!==kw)
    })));
  };

  const runAnalysis = async () => {
    if (!keywords.length) return;
    setAnalysing(true);
    const updated = await runWatchlistAnalysis(keywords, canonical, setStatusMsg);
    // Merge back into allArticles (including dupes)
    setAllArticles(prev=>{
      const result = prev.map(a=>{
        const upd = updated.find(u=>u.id===a.id);
        return upd ? {...a, watchMatches: upd.watchMatches} : a;
      });
      // Persist hit map
      const hitMap = {};
      result.forEach(a=>{ if(a.watchMatches?.length) hitMap[a.id]=a.watchMatches; });
      sSet(SK.watchHits, hitMap);
      return result;
    });
    setLastAnalysed(Date.now());
    setStatusMsg("");
    setAnalysing(false);
    if (!activeKw && keywords.length) setActiveKw(keywords[0]);
  };

  // Articles matching active keyword
  const kwArticles = activeKw
    ? canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw))
    : [];
  const directArts  = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="direct"));
  const relatedArts = kwArticles.filter(a=>a.watchMatches?.find(m=>m.keyword===activeKw&&m.matchType==="related"));

  // Summary counts per keyword
  const kwCounts = {};
  keywords.forEach(kw=>{
    kwCounts[kw] = {
      direct:  canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="direct")).length,
      related: canonical.filter(a=>a.watchMatches?.find(m=>m.keyword===kw&&m.matchType==="related")).length,
    };
  });

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>
      {/* Input area */}
      <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
        padding:"20px 24px",marginBottom:20}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",
          letterSpacing:"0.12em",marginBottom:4}}>WATCHLIST TRACKER</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",
          fontWeight:600,marginBottom:14}}>
          Intelligent Keyword Monitoring
        </div>
        <p style={{fontSize:12,color:"#4a6a8a",fontFamily:"'DM Sans',sans-serif",
          lineHeight:1.7,margin:"0 0 16px"}}>
          Add companies, people, sectors, or themes to track. Claude will flag both direct mentions and related stories — competitors, suppliers, regulators, macro factors — giving you a complete picture around each subject.
        </p>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input
            value={inputVal}
            onChange={e=>setInputVal(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addKeyword()}
            placeholder="e.g. Samsung, Fed rate cut, TSMC, Reliance Industries…"
            style={{flex:1,background:"#fff",border:"1px solid #ddd",borderRadius:6,
              padding:"9px 14px",color:"#1a1a1a",fontFamily:"'DM Sans',sans-serif",fontSize:13,
              outline:"none"}}
          />
          <button onClick={addKeyword}
            style={{padding:"9px 18px",background:"#c0392b11",border:"1px solid #c0392b66",
              color:"#c0392b",borderRadius:6,cursor:"pointer",fontFamily:"'DM Mono',monospace",
              fontSize:11,transition:"all 0.15s"}}
            onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            + add
          </button>
        </div>

        {/* Keyword chips */}
        {keywords.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {keywords.map(kw=>(
              <div key={kw}
                onClick={()=>setActiveKw(kw)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:activeKw===kw?"#fdecea":"#fff",
                  border:`1px solid ${activeKw===kw?"#c0392b":"#ddd"}`,
                  borderRadius:20,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                  color:activeKw===kw?"#c0392b":"#333"}}>
                  {kw}
                </span>
                {kwCounts[kw]&&(kwCounts[kw].direct||kwCounts[kw].related)>0&&(
                  <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"#3a6080"}}>
                    <span style={{color:"#c0392b"}}>{kwCounts[kw].direct}</span>
                    {kwCounts[kw].related>0&&<span style={{color:"#2980b9"}}> +{kwCounts[kw].related}</span>}
                  </span>
                )}
                <span onClick={e=>{e.stopPropagation();removeKeyword(kw);}}
                  style={{fontSize:12,color:"#2a4050",cursor:"pointer",lineHeight:1,
                    transition:"color 0.15s"}}
                  onMouseOver={e=>e.target.style.color="#f87171"}
                  onMouseOut={e=>e.target.style.color="#2a4050"}>×</span>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={runAnalysis} disabled={analysing||!keywords.length||!canonical.length}
            style={{padding:"9px 20px",
              background:(!keywords.length||!canonical.length)?"#f5f5f5":"#fdecea",
              border:"1px solid #bbb",color:"#333",borderRadius:6,
              cursor:(!keywords.length||!canonical.length)?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",
              opacity:(!keywords.length||!canonical.length)?0.4:1}}
            onMouseOver={e=>{if(!analysing)e.currentTarget.style.background="#c9a84c22"}}
            onMouseOut={e=>e.currentTarget.style.background="#c9a84c11"}>
            {analysing?<><Dots/> {statusMsg}</>:`⟳ run analysis (${canonical.length} articles × ${keywords.length} keywords)`}
          </button>
          {lastAnalysed&&(
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
              last run {timeAgo(lastAnalysed)}
            </span>
          )}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto",
            fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2a4050"}}>
            <span style={{color:"#c0392b"}}>⦿ direct mention</span>
            <span style={{color:"#2980b9"}}>◎ related / indirect</span>
          </div>
        </div>
      </div>

      {/* Active keyword view */}
      {activeKw && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          {/* Keyword intel brief */}
          <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",borderRadius:10,
            padding:"18px 22px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              marginBottom:kwBriefs[activeKw]?12:0}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",
                  letterSpacing:"0.12em"}}>INTELLIGENCE BRIEF · {kwArticles.length} relevant articles</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#1a1a1a",fontWeight:600}}>
                  "{activeKw}" — Full Picture
                </div>
              </div>
              <button onClick={async()=>{
                  setKwBriefLoad(p=>({...p,[activeKw]:true}));
                  const b=await generateKeywordBrief(activeKw,kwArticles);
                  setKwBriefs(p=>({...p,[activeKw]:b}));
                  setKwBriefLoad(p=>({...p,[activeKw]:false}));
                }}
                disabled={kwBriefLoad[activeKw]||!kwArticles.length}
                style={{background:"none",border:"1px solid #bbb",color:"#333",
                  padding:"6px 14px",borderRadius:5,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:11,transition:"all 0.2s",
                  opacity:!kwArticles.length?0.4:1}}
                onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
                onMouseOut={e=>e.currentTarget.style.background="none"}>
                {kwBriefLoad[activeKw]?<><Dots/> generating…</>:kwBriefs[activeKw]?"↺ refresh brief":"✦ generate intelligence brief"}
              </button>
            </div>
            {kwBriefs[activeKw]&&(
              <BriefRenderer text={kwBriefs[activeKw]} articles={kwArticles}/>
            )}
          </div>

          {kwArticles.length===0 ? (
            <div style={{textAlign:"center",padding:"40px",fontFamily:"'DM Mono',monospace",
              color:"#1e2a38",fontSize:12}}>
              No matches yet — run analysis first
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {/* Direct mentions */}
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>⦿ DIRECT MENTIONS</span>
                  <span style={{background:"#c0392b18",color:"#c0392b",padding:"1px 7px",
                    borderRadius:10,fontSize:9}}>{directArts.length}</span>
                </div>
                {directArts.length===0?(
                  <div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",
                    padding:"20px 0"}}>No direct mentions found</div>
                ):(
                  directArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)
                )}
              </div>

              {/* Related / indirect */}
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#2980b9",
                  fontWeight:600,letterSpacing:"0.08em",marginBottom:10,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span>◎ RELATED / INDIRECT</span>
                  <span style={{background:"#4a9eff22",color:"#2980b9",padding:"1px 7px",
                    borderRadius:10,fontSize:9}}>{relatedArts.length}</span>
                </div>
                {relatedArts.length===0?(
                  <div style={{fontSize:12,color:"#1e2a38",fontFamily:"'DM Mono',monospace",
                    padding:"20px 0"}}>No related stories found</div>
                ):(
                  relatedArts.map((art,i)=><ArticleCard key={art.id||i} art={art} highlightKeyword={activeKw}/>)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* If no active keyword, show overview grid */}
      {!activeKw && keywords.length>0 && (
        <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",
          color:"#2a4050",fontSize:12}}>
          Select a keyword above to view its matches, or run analysis first
        </div>
      )}
      {keywords.length===0&&(
        <div style={{textAlign:"center",padding:"60px",fontFamily:"'DM Mono',monospace",
          color:"#1e2a38",fontSize:12}}>
          Add keywords above to start tracking
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES TAB
// ═══════════════════════════════════════════════════════════════════════════════
// Source ranking by influence/circulation per country
const SOURCE_RANK = {
  US: ["reuters","bloomberg","bloomberg2","wsj","wsj2","ft","wapo","nyt","barrons","marketwatch","axios_biz","semafor","politico","seekalpha","prnewswire"],
  DE: ["reuters_de","bloom_de","handelsblatt","handelsblatt_en","faz","faz_finance","spiegel_de","sz_de","dw_de"],
  CA: ["reuters_ca","bloom_ca","globe_mail","globemail_rob","fin_post","fp_companies","bnn"],
  SG: ["reuters_sg","bloom_sg","bt_sg","edge_sg","cna_sg","sgx_annc","sg_biz_review"],
  HK: ["reuters_hk","bloom_hk","scmp","hkex_news","mingtiandi","aastocks_hk","etnet_hk","hket","mingpao"],
  KR: ["reuters_kr","bloom_kr","kr_herald","yonhap","yonhap2","ktimes","ked","pulse_kr","thebell_kr","businesskorea","hankyung","maeil","chosunbiz"],
  TW: ["reuters_tw","bloom_tw","focus_tw","taipei_t","digitimes","udn_money","ctee"],
  IN: ["reuters_in","bloom_in","econ_times","mint","mint2","mint3","biz_std","hindubiz","fin_exp","cnbctv18","moneyctrl","forbes_in"],
  AU: ["reuters_au","bloom_au","afr","market_herald","smh","abc_au","stockhead_au","guardian_au","the_aus"],
  CN: ["reuters_cn","bloom_cn","xinhua","cgtn","chinadaily","caixin","kr36","globaltimes","yicai","peoples_d"],
  IL: ["globes_il","reuters_il","bloom_il","jpost_il","toi_il","haaretz_il","ctech_il","calcalist"],
  ME: ["arabnews","arabnews_biz","national_ae","gulfnews","arabianbiz","reuters_me","bloom_me","agbi","tradearabia","alarabiya","zawya","gulfbiz","gulftimes","khaleej","saudigazette","menafn_sa","menafn_uae","menafn_qa","menafn_kw","menafn_bh","menafn_om","alarabiya_ar"],
  IR: ["iranintl","reuters_ir","bloom_ir","tehrantimes","fin_trib","irna_en","tasnim","ifpnews","mehrnews","entekhab","tabnak"],
};

function SourcesTab({canonical, lastFetch, briefs, setBriefs}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[1].code);
  const [selectedSource,  setSelectedSource]  = useState("ALL");
  const [briefLoading,    setBriefLoading]    = useState({});

  const countryObj   = COUNTRIES.find(c => c.code === selectedCountry);
  const rankOrder    = SOURCE_RANK[selectedCountry] || [];
  // Sort sources by rank, unranked go last
  const allCountrySources = SOURCES.filter(s => s.country === selectedCountry);
  const rankedSources = [
    ...rankOrder.map(id => allCountrySources.find(s => s.id === id)).filter(Boolean),
    ...allCountrySources.filter(s => !rankOrder.includes(s.id)),
  ];
  const visibleSources = selectedSource === "ALL"
    ? rankedSources
    : rankedSources.filter(s => s.id === selectedSource);

  const countryArts = canonical.filter(a => a.country === selectedCountry);
  const briefKey = `sources_country_${selectedCountry}`;
  const briefData = briefs[briefKey];
  const brief = briefData?.text ?? (typeof briefData === "string" ? briefData : null);
  const briefArts = briefData?.articles ?? countryArts;

  return (
    <div style={{animation:"fadeIn 0.3s ease"}}>

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,
        background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"12px 18px",
        flexWrap:"wrap"}}>

        {/* Country dropdown */}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",
          letterSpacing:"0.08em",whiteSpace:"nowrap"}}>COUNTRY</span>
        <div style={{position:"relative"}}>
          <select value={selectedCountry}
            onChange={e=>{setSelectedCountry(e.target.value);setSelectedSource("ALL");}}
            style={{appearance:"none",background:"#fff",border:"1px solid #c0392b",
              borderRadius:6,padding:"7px 32px 7px 12px",
              fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",
              cursor:"pointer",outline:"none",minWidth:180}}>
            {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>(
              <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
            ))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",
            pointerEvents:"none",color:"#c0392b",fontSize:10}}>▼</span>
        </div>

        {/* Source dropdown */}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",
          letterSpacing:"0.08em",whiteSpace:"nowrap",marginLeft:8}}>SOURCE</span>
        <div style={{position:"relative"}}>
          <select value={selectedSource}
            onChange={e=>setSelectedSource(e.target.value)}
            style={{appearance:"none",background:"#fff",border:"1px solid #bbb",
              borderRadius:6,padding:"7px 32px 7px 12px",
              fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",
              cursor:"pointer",outline:"none",minWidth:200}}>
            <option value="ALL">All sources ({rankedSources.length})</option>
            {rankedSources.map((s,i)=>(
              <option key={s.id} value={s.id}>
                #{i+1} {s.name} ({canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id).length})
              </option>
            ))}
          </select>
          <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",
            pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
        </div>

        {/* Stats */}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",marginLeft:4}}>
          <span style={{color:"#c0392b",fontWeight:600}}>{countryArts.length}</span> articles
        </span>

        {/* Generate brief button */}
        <button
          onClick={async()=>{
            setBriefLoading(p=>({...p,[briefKey]:true}));
            const b = await generateBriefUnlimited(countryArts, `${countryObj?.flag} ${countryObj?.label} Markets`);
            setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
            setBriefLoading(p=>({...p,[briefKey]:false}));
          }}
          disabled={briefLoading[briefKey]||!countryArts.length}
          style={{marginLeft:"auto",padding:"7px 16px",
            background:brief?"none":"#fdecea",
            border:"1px solid #c0392b",color:"#c0392b",borderRadius:6,
            cursor:(!countryArts.length)?"not-allowed":"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,
            opacity:!countryArts.length?0.4:1,transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
          onMouseOut={e=>e.currentTarget.style.background=brief?"none":"#fdecea"}>
          {briefLoading[briefKey]
            ? <><Dots/> generating…</>
            : brief ? "↺ refresh brief" : "✦ generate country brief"}
        </button>
      </div>

      {/* ── Country brief (if generated) ──────────────────────────────────── */}
      {brief && (
        <div style={{background:"#fff",borderLeft:"3px solid #c0392b",border:"1px solid #e0e0e0",
          borderRadius:10,padding:"18px 22px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",
            letterSpacing:"0.12em",marginBottom:2}}>
            AI INVESTMENT BRIEF · {countryArts.length} articles analysed
          </div>
          <BriefRenderer text={brief} articles={briefArts}/>
        </div>
      )}

      {/* ── Source cards grid ─────────────────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {visibleSources.map((src, idx)=>{
          const arts = canonical.filter(a=>a.sourceId===src.id||a.originalSourceId===src.id);
          const rank = rankOrder.indexOf(src.id);
          const rankLabel = rank >= 0 ? `#${rank+1}` : null;
          return (
            <div key={src.id} style={{background:"#fff",border:"1px solid #e0e0e0",
              borderRadius:8,padding:"14px 16px",
              borderTop:`3px solid ${rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#ddd"}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                marginBottom:10,paddingBottom:8,borderBottom:"1px solid #f0ece4"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  {rankLabel&&(
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,
                      color:rank===0?"#c0392b":rank===1?"#c9a84c":rank===2?"#2980b9":"#999",
                      fontWeight:700,background:rank<3?"#fafafa":"none",
                      padding:"1px 5px",borderRadius:3,border:"1px solid #eee"}}>
                      {rankLabel}
                    </span>
                  )}
                  <div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                      color:"#c0392b",fontWeight:600,letterSpacing:"0.04em"}}>
                      {src.flag} {src.name}
                    </span>
                    {src.desc&&(
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,
                        color:"#888",marginTop:2,lineHeight:1.4,maxWidth:460}}>
                        {src.desc}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  {lastFetch[src.id]&&(
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#aaa"}}>
                      {timeAgo(lastFetch[src.id])}
                    </span>
                  )}
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,
                    color:"#888",background:"#f5f5f5",padding:"2px 7px",borderRadius:10}}>
                    {arts.length}
                  </span>
                </div>
              </div>
              {arts.length===0?(
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,
                  color:"#bbb",padding:"12px 0",textAlign:"center"}}>
                  no recent articles
                </div>
              ):(
                <>
                  {src.paywall&&arts.some(a=>a.originalSourceId===src.id)&&(
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888",
                      background:"#f9f6f0",border:"1px solid #e8e0d0",borderRadius:4,
                      padding:"5px 10px",marginBottom:8}}>
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

  // Boot
  useEffect(()=>{
    (async()=>{
      const [arts,bfs,lf]=await Promise.all([sGet(SK.articles),sGet(SK.summaries),sGet(SK.lastFetch)]);
      if(arts?.length) setAllArticles(arts);
      if(bfs) setBriefs(bfs);
      if(lf)  setLastFetch(lf);
      setStatusMsg("");
      setStorageReady(true);
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
      // Auto-translate non-English titles (free, no API cost) but skip Claude enrichment
      const toTranslate=fresh.filter(a=>a.lang!=="en"&&!a.translatedTitle);
      if(toTranslate.length) runAutoTranslate(merged,toTranslate);
      else setStatusMsg("");
      return merged;
    });
  },[]);

  // Auto-translate only (no Claude cost) — runs on every refresh for non-English titles
  const runAutoTranslate=useCallback(async(currentArticles,toTranslate)=>{
    setStatusMsg(`Translating ${toTranslate.length} non-English titles…`);
    const translated = await Promise.all(toTranslate.map(async a => {
      const lang = a.lang === "zh" ? "zh-CN" : a.lang;
      const t = await googleTranslate(a.title, lang);
      return { ...a, translatedTitle: t };
    }));
    setAllArticles(prev => {
      const updated = prev.map(a => {
        const t = translated.find(x => x.id === a.id);
        return t ? { ...a, translatedTitle: t.translatedTitle } : a;
      });
      sSet(SK.articles, updated);
      return updated;
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
        // For non-English: store translation only if it looks like real English (not CJK chars)
        const isCJK = s => s && (s.match(/[\u4e00-\u9fff\uac00-\ud7ff\u3040-\u309f]/g)||[]).length / s.length > 0.2;
        const translationOk = a.lang !== "en" && r.translated && !isCJK(r.translated);
        const shouldStore = translationOk ? r.translated
          : a.lang === "en" && r.translated && r.translated !== a.title ? r.translated
          : null;
        return {...a,
          translatedTitle: shouldStore || a.translatedTitle,
          insight:r.insight||a.insight,sector:r.sector||a.sector};
      });
      setAllArticles(working);
    }
    setStatusMsg("Cross-language dedup…");
    working=localDedup(working);
    const afterClaude=await claudeDedup(working);
    setAllArticles(afterClaude);
    sSet(SK.articles,afterClaude);
    setEnriching(false);
    setStatusMsg("");
  },[]);

  // Computed
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const sortByDate = arts => [...arts].sort((a,b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    const db = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
    return db - da; // newest first
  });
  const isRecent = a => {
    const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
    return t === 0 || (Date.now() - t) < FIVE_DAYS_MS;
  };
  const canonical = sortByDate(
    allArticles.filter(a => (showDupes||!a.duplicateOf) && isRecent(a))
  );
  const forCountry=c=>c==="ALL"?canonical:canonical.filter(a=>a.country===c);
  const forSector=s=>s==="ALL"?canonical:canonical.filter(a=>a.sector===s);
  const countryArts=forCountry(activeCountry);
  const sectorArts=forSector(activeSector);
  const sourcesInView=SOURCES.filter(s=>activeCountry==="ALL"||s.country===activeCountry);
  const sourceGroups=sourcesInView.map(s=>({s,arts:canonical.filter(a=>a.sourceId===s.id||a.originalSourceId===s.id)})).filter(g=>g.arts.length);
  const sectorGroups=MSCI_SECTORS.map(sec=>({sec,arts:canonical.filter(a=>a.sector===sec.code)})).filter(g=>g.arts.length).sort((a,b)=>b.arts.length-a.arts.length);
  // Also show unenriched articles under a pending group if sectors tab is empty
  const unenrichedArts=canonical.filter(a=>!a.sector);
  const sectorForActive=SECTOR_MAP[activeSector];
  const isLoading=Object.values(loading).some(Boolean);
  const dupeCount=allArticles.filter(a=>a.duplicateOf).length;
  const enrichedCount=allArticles.filter(a=>a.insight).length;
  const sectorCountsForCountry={};
  countryArts.forEach(a=>{if(a.sector)sectorCountsForCountry[a.sector]=(sectorCountsForCountry[a.sector]||0)+1;});
  const watchlistHits=canonical.filter(a=>a.watchMatches?.length>0).length;

  const SIX_HOURS_MS = 12 * 60 * 60 * 1000;
  const breakingArts = (() => {
    // Filter to last 12 hours
    const raw = canonical.filter(a => {
      const t = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
      return t > 0 && (Date.now() - t) < SIX_HOURS_MS;
    }).sort((a,b) => {
      // Sort newest first so caps keep freshest articles
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : (a.fetchedAt||0);
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : (b.fetchedAt||0);
      return tb - ta;
    });
    // Cap 1: max 3 articles per source (prevent single high-volume feeds dominating)
    const countPerSource = {};
    // Cap 2: max 12 articles per country (balance across markets)
    const countPerCountry = {};
    const MAX_PER_SOURCE = 4;
    const MAX_PER_COUNTRY = 18;
    return raw.filter(a => {
      const ns = (countPerSource[a.sourceId] || 0);
      const nc = (countPerCountry[a.country] || 0);
      if (ns >= MAX_PER_SOURCE || nc >= MAX_PER_COUNTRY) return false;
      countPerSource[a.sourceId] = ns + 1;
      countPerCountry[a.country] = nc + 1;
      return true;
    });
  })();

  const MAIN_TABS=[
    {id:"breaking", label:`⚡ Breaking${breakingArts.length>0?` (${breakingArts.length})`:""}`},
    {id:"region",  label:"⊕ Regions"},
    {id:"sector",  label:"▦ Sectors"},
    {id:"sources", label:"◫ Sources"},
    {id:"watchlist", label:`◎ Watchlist${watchlistHits>0?` (${watchlistHits})`:""}` },
    {id:"filings", label:"📋 Filings"},
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

      {/* HEADER */}
      <header style={{background:"#fff",borderBottom:"2px solid #1a1a1a",padding:"0 24px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1500,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:23,color:"#1a1a1a",fontWeight:700,letterSpacing:"-0.03em",lineHeight:1}}>GLOBAL MARKETS</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",letterSpacing:"0.3em",marginTop:2}}>INTELLIGENCE WIRE</div>
            </div>
            <div style={{display:"flex",gap:2,background:"none",borderRadius:0,padding:"2px 0",border:"none"}}>
              {MAIN_TABS.map(({id,label})=>(
                <button key={id} onClick={()=>setMainTab(id)}
                  style={{padding:"5px 13px",borderRadius:4,border:"none",
                    background:"none",
                    color:mainTab===id?"#c0392b":"#333",
                    borderBottom:mainTab===id?"2px solid #c0392b":"2px solid transparent",
                    fontWeight:mainTab===id?600:400,
                    borderRadius:0,
                    cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {(isLoading||enriching||statusMsg)&&(
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888",display:"flex",alignItems:"center",gap:6}}>
                <Dots/>{statusMsg||"processing…"}
              </span>
            )}
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,display:"flex",gap:10,color:"#888"}}>
              <span style={{color:"#2a4a6a"}}>{allArticles.length} fetched</span>
              <span style={{color:"#1a3a2a"}}>−{dupeCount} dupes</span>
              <span style={{color:"#2a3a1a"}}>{enrichedCount} enriched</span>
            </div>
            <button onClick={()=>setShowDupes(p=>!p)}
              style={{fontSize:9,padding:"4px 9px",border:"1px solid #ccc",borderRadius:4,
                background:showDupes?"#f0f0f0":"none",color:showDupes?"#333":"#888",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.15s"}}>
              {showDupes?"∙ hide dupes":"∙ show dupes"}
            </button>
            <button onClick={()=>{
                if(!window.confirm("Clear all cached headlines and summaries? The app will re-fetch and re-enrich everything from scratch.")) return;
                Object.values(SK).forEach(k=>localStorage.removeItem(k));
                setAllArticles([]);
                setBriefs({});
                setLastFetch({});
                setStatusMsg("Cache cleared — reloading…");
                setTimeout(()=>window.location.reload(), 800);
              }}
              style={{fontSize:9,padding:"4px 9px",border:"1px solid #e0b0b0",borderRadius:4,
                background:"none",color:"#c0392b",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.15s"}}
              onMouseOver={e=>e.currentTarget.style.background="#fdecea"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              ✕ clear cache
            </button>
            <button onClick={()=>fetchSources(SOURCES)} disabled={isLoading||enriching}
              style={{display:"flex",alignItems:"center",gap:5,background:"none",
                border:"1px solid #bbb",color:"#333",padding:"6px 14px",borderRadius:5,
                cursor:(isLoading||enriching)?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",
                fontSize:11,opacity:(isLoading||enriching)?0.5:1,transition:"all 0.2s"}}
              onMouseOver={e=>e.currentTarget.style.background="#f5f5f5"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              <span style={{display:"inline-block",animation:isLoading?"spin 1s linear infinite":"none"}}>⟳</span>
              {isLoading?"refreshing…":"refresh all"}
            </button>
            <button
              onClick={()=>{
                const toEnrich=allArticles.filter(a=>!a.insight);
                if(toEnrich.length) runEnrichment(allArticles,toEnrich);
              }}
              disabled={isLoading||enriching||allArticles.filter(a=>!a.insight).length===0}
              title="Add investor insights + sector tags to all headlines (uses Claude API)"
              style={{display:"flex",alignItems:"center",gap:5,background:"none",
                border:"1px solid #7b68ee",color:"#7b68ee",padding:"6px 14px",borderRadius:5,
                cursor:(isLoading||enriching||allArticles.filter(a=>!a.insight).length===0)?"not-allowed":"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:11,
                opacity:(isLoading||enriching||allArticles.filter(a=>!a.insight).length===0)?0.4:1,
                transition:"all 0.2s"}}
              onMouseOver={e=>{ if(!enriching&&!isLoading) e.currentTarget.style.background="#f0eeff"; }}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              <span style={{animation:enriching?"spin 1s linear infinite":"none",display:"inline-block"}}>✦</span>
              {enriching?"enriching…":`enrich (${allArticles.filter(a=>!a.insight).length})`}
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAV (only for region/sector) */}
      {mainTab!=="watchlist"&&mainTab!=="sources"&&mainTab!=="breaking"&&(
        <div style={{background:"#fff",borderBottom:"1px solid #ddd",position:"sticky",top:58,zIndex:199,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{maxWidth:1500,margin:"0 auto",padding:"0 24px",display:"flex",width:"max-content",minWidth:"100%"}}>
            {mainTab==="region"?(
              COUNTRIES.map(c=>{
                const cnt=c.code==="ALL"?canonical.length:canonical.filter(a=>a.country===c.code).length;
                const active=activeCountry===c.code;
                return (
                  <button key={c.code} onClick={()=>setActiveCountry(c.code)}
                    style={{padding:"11px 14px",border:"none",background:"none",
                      color:active?"#c0392b":"#8aa8bc",
                      borderBottom:active?"2px solid #c9a84c":"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
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
                    style={{padding:"11px 13px",border:"none",background:"none",
                      color:active?col:"#333",borderBottom:active?`2px solid ${col}`:"2px solid transparent",
                      cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12,
                      whiteSpace:"nowrap",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}
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

        {/* WATCHLIST */}
        {mainTab==="watchlist"&&(
          <WatchlistTab allArticles={allArticles} setAllArticles={setAllArticles}/>
        )}

        {/* FILINGS */}
        {mainTab==="filings"&&(
          <FilingsTab />
        )}

        {/* REGION */}
        {mainTab==="region"&&(
          <>
            {activeCountry!=="ALL"&&(
              <>
                <BriefBox
                  label={`${COUNTRIES.find(c=>c.code===activeCountry)?.flag} ${COUNTRIES.find(c=>c.code===activeCountry)?.label} Market Overview`}
                  icon={COUNTRIES.find(c=>c.code===activeCountry)?.flag}
                  briefKey={`country_${activeCountry}`}
                  briefs={briefs} setBriefs={setBriefs} articles={countryArts}
                  loading={briefLoading} setLoading={setBriefLoading}
                />
                {Object.keys(sectorCountsForCountry).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
                    {MSCI_SECTORS.filter(s=>sectorCountsForCountry[s.code]).map(sec=>(
                      <button key={sec.code} onClick={()=>{setMainTab("sector");setActiveSector(sec.code);}}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",
                          borderRadius:5,border:`1px solid ${sec.color}44`,background:`${sec.color}0d`,
                          color:sec.color,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,transition:"all 0.15s"}}
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
              // All Markets: flat chronological list, newest first
              <div style={{maxWidth:860,margin:"0 auto"}}>
                {countryArts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
              </div>
            ):(
              // Individual country: grouped by source
              <div style={{columns:"2 520px",columnGap:24}}>
                {sourceGroups.map(({s,arts})=>(
                  <div key={s.id} style={{breakInside:"avoid",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 0 7px",borderBottom:"1px solid #e8e2d6",marginBottom:1}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.06em"}}>
                        {s.flag} {s.name.toUpperCase()}
                      </span>
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
          const TWO_HOURS_MS  = 2 * 60 * 60 * 1000;
          const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
          const SIX_H_MS      = 6 * 60 * 60 * 1000;
          const buckets = [
            { label:"Last 2 hours",  arts: breakingArts.filter(a=>{ const t=a.pubDate?new Date(a.pubDate).getTime():(a.fetchedAt||0); return (Date.now()-t)<TWO_HOURS_MS; }) },
            { label:"2 – 4 hours",   arts: breakingArts.filter(a=>{ const t=a.pubDate?new Date(a.pubDate).getTime():(a.fetchedAt||0); const age=Date.now()-t; return age>=TWO_HOURS_MS&&age<FOUR_HOURS_MS; }) },
            { label:"4 – 6 hours",   arts: breakingArts.filter(a=>{ const t=a.pubDate?new Date(a.pubDate).getTime():(a.fetchedAt||0); const age=Date.now()-t; return age>=FOUR_HOURS_MS&&age<SIX_H_MS; }) },
            { label:"6 – 12 hours",   arts: breakingArts.filter(a=>{ const t=a.pubDate?new Date(a.pubDate).getTime():(a.fetchedAt||0); const age=Date.now()-t; return age>=SIX_H_MS; }) },
          ].filter(b=>b.arts.length>0);
          return (
            <div>
              {/* Brief card */}
              <div style={{background:"#fff",border:"1px solid #e8e2d6",borderRadius:10,padding:"16px 18px",marginBottom:20,animation:"fadeIn 0.4s ease"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>⚡</span>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#c0392b",letterSpacing:"0.1em",fontWeight:600}}>BREAKING · {breakingArts.length} stories · last 9h</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#1a1a1a",fontWeight:600}}>Breaking News Intelligence</div>
                    </div>
                  </div>
                  <button onClick={async()=>{
                      setBriefLoading(p=>({...p,[briefKey]:true}));
                      const BRIEF_COUNTRY_ORDER = ["US","CN","DE","HK","KR","TW","IN","AU","IL","ME","IR","SG","CA"];
                        const prioritisedArts = [...breakingArts].sort((a,b)=>{
                          const ra = BRIEF_COUNTRY_ORDER.indexOf(a.country);
                          const rb = BRIEF_COUNTRY_ORDER.indexOf(b.country);
                          const sa = ra===-1?999:ra, sb = rb===-1?999:rb;
                          return sa !== sb ? sa - sb : 0; // stable within same country
                        });
                        const b=await generateBriefUnlimited(prioritisedArts,"Breaking News");
                      setBriefs(p=>{const n={...p,[briefKey]:b};sSet(SK.summaries,n);return n;});
                      setBriefLoading(p=>({...p,[briefKey]:false}));
                    }}
                    disabled={briefLoading[briefKey]||breakingArts.length===0}
                    style={{fontSize:9,padding:"4px 12px",border:"1px solid #c0392b44",borderRadius:4,background:"none",color:"#c0392b",cursor:briefLoading[briefKey]||breakingArts.length===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",opacity:breakingArts.length===0?0.4:1}}
                    onMouseOver={e=>{ if(!briefLoading[briefKey]) e.currentTarget.style.background="#fdecea"; }}
                    onMouseOut={e=>e.currentTarget.style.background="none"}>
                    {briefLoading[briefKey]?<Dots color="#c0392b"/>:"✦ brief"}
                  </button>
                </div>
                {briefs[briefKey]&&(
                  <div style={{borderTop:"1px solid #e8e2d6",paddingTop:12}}>
                    <BriefRenderer text={typeof briefs[briefKey]==="string"?briefs[briefKey]:briefs[briefKey]?.text} articles={typeof briefs[briefKey]==="string"?breakingArts:briefs[briefKey]?.articles||breakingArts}/>
                  </div>
                )}
              </div>

              {/* Time-bucketed articles */}
              {buckets.length===0?(
                <div style={{textAlign:"center",color:"#888",fontFamily:"'DM Mono',monospace",fontSize:11,padding:40}}>no articles in the last 12 hours — try refreshing</div>
              ):buckets.map(bucket=>(
                <div key={bucket.label} style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#c0392b",fontWeight:600,letterSpacing:"0.08em"}}>⚡ {bucket.label.toUpperCase()}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#aaa"}}>{bucket.arts.length} stories</span>
                    <div style={{flex:1,height:1,background:"#e8e2d6"}}/>
                    {/* Country breakdown pills */}
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{ const n=bucket.arts.filter(a=>a.country===c.code).length; return n?<span key={c.code} style={{fontSize:9,color:"#3a6080",fontFamily:"'DM Mono',monospace"}}>{c.flag}{n}</span>:null; })}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {bucket.arts.map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                  </div>
                </div>
              ))}
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
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:sec.color,letterSpacing:"0.1em",fontWeight:600}}>{sec.code} · {arts.length} stories</div>
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
                        {COUNTRIES.filter(c=>c.code!=="ALL").map(c=>{
                          const n=arts.filter(a=>a.country===c.code).length;
                          return n?<span key={c.code} style={{fontSize:9,color:"#3a6080",fontFamily:"'DM Mono',monospace"}}>{c.flag}{n}</span>:null;
                        })}
                      </div>
                      {arts.slice(0,4).map((art,i)=><ArticleCard key={art.id||i} art={art}/>)}
                      {arts.length>4&&<button onClick={()=>setActiveSector(sec.code)} style={{fontSize:10,color:"#2a5a7a",background:"none",border:"none",cursor:"pointer",paddingTop:8,fontFamily:"'DM Mono',monospace"}}>+{arts.length-4} more →</button>}
                    </div>
                  );
                })}
              </div>
            ):(
              <>
                <BriefBox
                  label={`${sectorForActive?.icon} ${sectorForActive?.label} — Global Sector View`}
                  icon={sectorForActive?.icon}
                  briefKey={`sector_${activeSector}`}
                  briefs={briefs} setBriefs={setBriefs} articles={sectorArts}
                  loading={briefLoading} setLoading={setBriefLoading}
                />
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

        {/* SOURCES */}
        {mainTab==="sources"&&(
          <SourcesTab canonical={canonical} lastFetch={lastFetch} briefs={briefs} setBriefs={setBriefs}/>
        )}

      <footer style={{borderTop:"1px solid #ddd",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>{SOURCES.length} sources · {COUNTRIES.length-1} markets · {MSCI_SECTORS.length} GICS sectors</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#182535"}}>persisted locally · stale threshold 45 min</span>
      </footer>
    </div>
  );
}
