// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — lead central banks (the early movers)
// ═══════════════════════════════════════════════════════════════════════════════
// Banks that have tended to move before the Fed and the ECB, or that read a
// channel the big three don't (commodities, the Asian trade cycle, gilts).
// Secondary to the Fed/ECB/BoJ cards: they don't set the playbook's signals;
// they flag when the global cycle may be turning before the big three say so.
//
// Precedent dates are the banks' own decision dates (decision releases, public
// record); they could not be re-opened from the build sandbox, whose network
// blocks these sites, so re-check any you rely on in the bank's archive.
//
// Data:
//   rate     policy rate from the BIS (WS_CBPOL, PRIMARY, daily, updated weekly)
//   cbw      Central Bank Watch page with a futures-derived meeting table
//            (BoE, RBA, RBNZ, SNB only; SECONDARY-unverified)
//   fx       the currency against USD; inv = quoted as USD/xxx (so a fall = stronger)
//   news     Google News queries, local language where the bank's own press is
//   match    a headline (title + summary) must match this to be shown — Google
//            News returns off-topic items for short queries

const GN = (q, hl = "en-US", gl = "US", ceid = "US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

export const LEAD_BANKS = [
  { id: "bcb", name: "BCB", full: "Banco Central do Brasil (Copom)", ccy: "BRL", rate: "prBR", fx: { id: "usdbrl", inv: true },
    lead: "The most consistent early mover: began hiking on 17 Mar 2021, a year before the Fed; began cutting on 2 Aug 2023, about 13 months before the Fed; and turned back to hiking on 18 Sep 2024 — the day the Fed made its first cut.",
    caveat: "Brazil's fiscal risk and the real drive some moves, so read a BCB turn as a signal about inflation only when peers confirm it.",
    link: "https://www.bcb.gov.br/en", match: /Copom|Selic|Banco Central|\bBCB\b|Brazil(ian)? central bank/i, news: [GN("Copom Selic when:14d", "pt-BR", "BR", "BR:pt-419"), GN("\"Brazil central bank\" Selic when:14d")] },
  { id: "rbnz", name: "RBNZ", full: "Reserve Bank of New Zealand", ccy: "NZD", rate: "prNZ", cbw: "rbnz", fx: { id: "nzdusd" },
    lead: "Small, open, commodity-exporting economy and the first inflation targeter (1990). Hiked on 6 Oct 2021, five months before the Fed, and cut on 14 Aug 2024, five weeks before it.",
    caveat: "Housing and dairy prices weigh heavily; a move can be local.",
    link: "https://www.rbnz.govt.nz/monetary-policy", match: /RBNZ|Reserve Bank of New Zealand|Official Cash Rate|\bOCR\b|cash rate/i, news: [GN("(RBNZ OR \"Reserve Bank of New Zealand\") OCR when:14d", "en-NZ", "NZ", "NZ:en")] },
  { id: "boc", name: "BoC", full: "Bank of Canada", ccy: "CAD", rate: "prCA", fx: { id: "usdcad", inv: true },
    lead: "The economy most tied to the US: hiked on 2 Mar 2022, two weeks before the Fed, and was the first G7 bank to cut, on 5 Jun 2024 — about 3½ months before the Fed. The closest read on what the Fed is about to face.",
    caveat: "US tariffs on Canada can push it to ease for reasons the Fed doesn't share.",
    link: "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/", match: /Bank of Canada|\bBoC\b|overnight rate|Banque du Canada/i, news: [GN("\"Bank of Canada\" rate when:14d", "en-CA", "CA", "CA:en")] },
  { id: "boe", name: "BoE", full: "Bank of England (MPC)", ccy: "GBP", rate: "prGB", cbw: "boe", fx: { id: "gbpusd" },
    lead: "First G7 bank to hike, on 16 Dec 2021. Gilts are the market's fiscal canary (the Sep 2022 LDI crisis), which matters for the playbook's term-premium leg; UK services inflation and wages have been stickier than peers'.",
    caveat: "Split MPC votes are common, so the vote count often says more than the decision.",
    link: "https://www.bankofengland.co.uk/monetary-policy", match: /Bank of England|\bBoE\b|\bMPC\b|Bank Rate|\bgilts?\b/i, news: [GN("\"Bank of England\" (\"Bank Rate\" OR MPC OR gilts) when:14d", "en-GB", "GB", "GB:en")] },
  { id: "mas", name: "MAS", full: "Monetary Authority of Singapore", ccy: "SGD", rate: null, fx: { id: "usdsgd", inv: true },
    lead: "Sets policy through the trade-weighted Singapore dollar (S$NEER: slope, width and centre of a band), not a rate. Moved early both ways: tightened on 14 Oct 2021, again off-cycle on 25 Jan 2022, and made its first easing since 2020 on 24 Jan 2025. Reads imported inflation and the Asian trade cycle — and it is your base currency.",
    caveat: "No policy rate to chart: the decision is in the Monetary Policy Statement's words (slope, width, centre).",
    link: "https://www.mas.gov.sg/monetary-policy", match: /Monetary Authority of Singapore|\bMAS\b|S\$NEER|NEER|Singapore dollar/i, news: [GN("\"Monetary Authority of Singapore\" (\"monetary policy\" OR S$NEER OR slope) when:30d", "en-SG", "SG", "SG:en")] },
  { id: "rba", name: "RBA", full: "Reserve Bank of Australia", ccy: "AUD", rate: "prAU", cbw: "rba", fx: { id: "audusd" },
    lead: "Usually a laggard, not a leader: it began hiking on 3 May 2022, after the Fed, and began cutting on 18 Feb 2025, after most peers. Useful as confirmation and as the China and iron-ore channel; an early RBA move is the surprise worth noticing.",
    caveat: "Lags by design (it tolerated slower disinflation to protect employment).",
    link: "https://www.rba.gov.au/monetary-policy/", match: /Reserve Bank of Australia|\bRBA\b|cash rate/i, news: [GN("(RBA OR \"Reserve Bank of Australia\") \"cash rate\" when:14d", "en-AU", "AU", "AU:en")] },
  // Also early movers in the last cycle
  { id: "norges", name: "Norges", full: "Norges Bank", ccy: "NOK", rate: "prNO", fx: { id: "usdnok", inv: true }, minor: true,
    lead: "First G10 bank to hike after COVID, on 23 Sep 2021. Oil exporter: reads energy prices and the krone.",
    link: "https://www.norges-bank.no/en/", match: /Norges Bank|styringsrent|policy rate/i, news: [GN("\"Norges Bank\" styringsrenten when:14d", "no", "NO", "NO:no"), GN("\"Norges Bank\" rate when:14d")] },
  { id: "riks", name: "Riksbank", full: "Sveriges Riksbank", ccy: "SEK", rate: "prSE", fx: { id: "usdsek", inv: true }, minor: true,
    lead: "Cut on 8 May 2024, a month before the ECB. Most Swedish mortgages float, so policy passes through fast — an early read on European demand.",
    link: "https://www.riksbank.se/en-gb/", match: /Riksbank|styrränt|policy rate/i, news: [GN("Riksbanken styrräntan when:14d", "sv", "SE", "SE:sv"), GN("Riksbank rate when:14d")] },
  { id: "snb", name: "SNB", full: "Swiss National Bank", ccy: "CHF", rate: "prCH", cbw: "snb", fx: { id: "usdchf", inv: true }, minor: true,
    lead: "First major central bank to cut in the last cycle, on 21 Mar 2024. Low inflation and a strong franc make it an early read on European disinflation and safe-haven flows.",
    link: "https://www.snb.ch/en/", match: /\bSNB\b|Swiss National Bank|Nationalbank|Leitzins|Banque nationale suisse/i, news: [GN("SNB Leitzins when:14d", "de", "CH", "CH:de"), GN("\"Swiss National Bank\" rate when:14d")] },
  { id: "bok", name: "BoK", full: "Bank of Korea", ccy: "KRW", rate: "prKR", fx: { id: "usdkrw", inv: true }, minor: true,
    lead: "First major Asian central bank to hike, on 26 Aug 2021. A chip and auto exporter: reads the global tech and trade cycle, and household debt.",
    link: "https://www.bok.or.kr/eng/main/main.do", match: /Bank of Korea|\bBOK\b|한국은행|한은|기준금리/i, news: [GN("한국은행 기준금리 when:14d", "ko", "KR", "KR:ko"), GN("\"Bank of Korea\" rate when:14d")] },
];

export const LEAD_BANK_MAP = Object.fromEntries(LEAD_BANKS.map(b => [b.id, b]));

// Outlets shown without the "unverified" tag in the lead-bank headlines.
export const LEAD_OUTLETS = [
  "Reuters", "Bloomberg", "Financial Times", "Wall Street Journal", "CNBC", "MNI", "Associated Press", "AFP", "Dow Jones",
  "Valor", "Folha", "Estadão", "O Globo", "InfoMoney",                         // Brazil
  "NZ Herald", "Stuff", "RNZ", "interest.co.nz", "BusinessDesk",            // New Zealand
  "Globe and Mail", "Financial Post", "CBC", "Canadian Press",              // Canada
  "Guardian", "The Times", "Telegraph", "BBC", "Sky News", "City AM",        // UK
  "Straits Times", "Business Times", "CNA", "Channel NewsAsia",            // Singapore
  "Australian Financial Review", "AFR", "The Australian", "ABC", "Sydney Morning Herald",
  "E24", "Dagens Næringsliv", "DN", "Finansavisen", "NRK",                  // Norway
  "Dagens industri", "Svenska Dagbladet", "SvD", "SVT", "Sveriges Radio",   // Sweden
  "NZZ", "Neue Zürcher", "Handelszeitung", "SRF", "Finanz und Wirtschaft", "AWP", // Switzerland
  "Yonhap", "연합뉴스", "한국경제", "매일경제", "조선비즈", "Korea Herald", "Korea JoongAng", "Korea Times", // Korea
];
