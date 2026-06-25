export const COUNTRIES = [
  {code:"ALL",label:"All Markets",   flag:"🌐"},
  {code:"US", label:"United States", flag:"🇺🇸"},
  {code:"GB", label:"United Kingdom",flag:"🇬🇧"},
  {code:"DE", label:"Germany",       flag:"🇩🇪"},
  {code:"FR", label:"France",        flag:"🇫🇷"},
  {code:"IT", label:"Italy",         flag:"🇮🇹"},
  {code:"CH", label:"Switzerland",   flag:"🇨🇭"},
  {code:"EU", label:"Pan-European",  flag:"🇪🇺"},
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
// EMERGING MARKETS — countries, clusters, sources (lazy-loaded, not in SOURCES)
// ═══════════════════════════════════════════════════════════════════════════════
export const EM_COUNTRIES = [
  // LatAm
  {code:"BR",label:"Brazil",      flag:"🇧🇷",cluster:"LATAM"},
  {code:"MX",label:"Mexico",      flag:"🇲🇽",cluster:"LATAM"},
  {code:"AR",label:"Argentina",   flag:"🇦🇷",cluster:"LATAM"},
  {code:"CL",label:"Chile",       flag:"🇨🇱",cluster:"LATAM"},
  {code:"CO",label:"Colombia",    flag:"🇨🇴",cluster:"LATAM"},
  {code:"PE",label:"Peru",        flag:"🇵🇪",cluster:"LATAM"},
  // CEE
  {code:"PL",label:"Poland",      flag:"🇵🇱",cluster:"CEE"},
  {code:"TR",label:"Turkey",      flag:"🇹🇷",cluster:"CEE"},
  {code:"HU",label:"Hungary",     flag:"🇭🇺",cluster:"CEE"},
  {code:"CZ",label:"Czech Rep.",  flag:"🇨🇿",cluster:"CEE"},
  {code:"RO",label:"Romania",     flag:"🇷🇴",cluster:"CEE"},
  {code:"GR",label:"Greece",      flag:"🇬🇷",cluster:"CEE"},
  // Africa
  {code:"ZA",label:"South Africa",flag:"🇿🇦",cluster:"AFRICA"},
  {code:"NG",label:"Nigeria",     flag:"🇳🇬",cluster:"AFRICA"},
  {code:"KE",label:"Kenya",       flag:"🇰🇪",cluster:"AFRICA"},
  {code:"EG",label:"Egypt",       flag:"🇪🇬",cluster:"AFRICA"},
  {code:"MA",label:"Morocco",     flag:"🇲🇦",cluster:"AFRICA"},
  // EM Asia
  {code:"ID",label:"Indonesia",   flag:"🇮🇩",cluster:"EMASIA"},
  {code:"TH",label:"Thailand",    flag:"🇹🇭",cluster:"EMASIA"},
  {code:"MY",label:"Malaysia",    flag:"🇲🇾",cluster:"EMASIA"},
  {code:"PH",label:"Philippines", flag:"🇵🇭",cluster:"EMASIA"},
  {code:"VN",label:"Vietnam",     flag:"🇻🇳",cluster:"EMASIA"},
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED MARKETS — every market in one taxonomy, tagged by tier (MSCI-style
// Developed vs Emerging) and region. Drives the unified Markets tab filter so a
// user can view everything, or narrow by tier, region, or country.
// ─────────────────────────────────────────────────────────────────────────────
export const MARKET_REGIONS = ["North America","Europe","Asia-Pacific","Middle East","Latin America","Africa"];
export const MARKETS = [
  // North America
  {code:"US", label:"United States", flag:"🇺🇸", tier:"DM", region:"North America"},
  {code:"CA", label:"Canada",        flag:"🇨🇦", tier:"DM", region:"North America"},
  // Europe — Developed
  {code:"GB", label:"United Kingdom",flag:"🇬🇧", tier:"DM", region:"Europe"},
  {code:"DE", label:"Germany",       flag:"🇩🇪", tier:"DM", region:"Europe"},
  {code:"FR", label:"France",        flag:"🇫🇷", tier:"DM", region:"Europe"},
  {code:"IT", label:"Italy",         flag:"🇮🇹", tier:"DM", region:"Europe"},
  {code:"CH", label:"Switzerland",   flag:"🇨🇭", tier:"DM", region:"Europe"},
  {code:"EU", label:"Pan-European",  flag:"🇪🇺", tier:"DM", region:"Europe"},
  // Europe — Emerging (CEE)
  {code:"PL", label:"Poland",        flag:"🇵🇱", tier:"EM", region:"Europe"},
  {code:"TR", label:"Turkey",        flag:"🇹🇷", tier:"EM", region:"Europe"},
  {code:"HU", label:"Hungary",       flag:"🇭🇺", tier:"EM", region:"Europe"},
  {code:"CZ", label:"Czech Rep.",    flag:"🇨🇿", tier:"EM", region:"Europe"},
  {code:"RO", label:"Romania",       flag:"🇷🇴", tier:"EM", region:"Europe"},
  {code:"GR", label:"Greece",        flag:"🇬🇷", tier:"EM", region:"Europe"},
  // Asia-Pacific — Developed
  {code:"JP", label:"Japan",         flag:"🇯🇵", tier:"DM", region:"Asia-Pacific"},
  {code:"SG", label:"Singapore",     flag:"🇸🇬", tier:"DM", region:"Asia-Pacific"},
  {code:"HK", label:"Hong Kong",     flag:"🇭🇰", tier:"DM", region:"Asia-Pacific"},
  {code:"AU", label:"Australia",     flag:"🇦🇺", tier:"DM", region:"Asia-Pacific"},
  // Asia-Pacific — Emerging
  {code:"CN", label:"China",         flag:"🇨🇳", tier:"EM", region:"Asia-Pacific"},
  {code:"IN", label:"India",         flag:"🇮🇳", tier:"EM", region:"Asia-Pacific"},
  {code:"KR", label:"Korea",         flag:"🇰🇷", tier:"EM", region:"Asia-Pacific"},
  {code:"TW", label:"Taiwan",        flag:"🇹🇼", tier:"EM", region:"Asia-Pacific"},
  {code:"ID", label:"Indonesia",     flag:"🇮🇩", tier:"EM", region:"Asia-Pacific"},
  {code:"TH", label:"Thailand",      flag:"🇹🇭", tier:"EM", region:"Asia-Pacific"},
  {code:"MY", label:"Malaysia",      flag:"🇲🇾", tier:"EM", region:"Asia-Pacific"},
  {code:"PH", label:"Philippines",   flag:"🇵🇭", tier:"EM", region:"Asia-Pacific"},
  {code:"VN", label:"Vietnam",       flag:"🇻🇳", tier:"EM", region:"Asia-Pacific"},
  // Middle East
  {code:"IL", label:"Israel",        flag:"🇮🇱", tier:"DM", region:"Middle East"},
  {code:"ME", label:"Gulf / MENA",   flag:"🌍", tier:"EM", region:"Middle East"},
  {code:"IR", label:"Iran",          flag:"🇮🇷", tier:"EM", region:"Middle East"},
  // Latin America
  {code:"BR", label:"Brazil",        flag:"🇧🇷", tier:"EM", region:"Latin America"},
  {code:"MX", label:"Mexico",        flag:"🇲🇽", tier:"EM", region:"Latin America"},
  {code:"AR", label:"Argentina",     flag:"🇦🇷", tier:"EM", region:"Latin America"},
  {code:"CL", label:"Chile",         flag:"🇨🇱", tier:"EM", region:"Latin America"},
  {code:"CO", label:"Colombia",      flag:"🇨🇴", tier:"EM", region:"Latin America"},
  {code:"PE", label:"Peru",          flag:"🇵🇪", tier:"EM", region:"Latin America"},
  // Africa
  {code:"ZA", label:"South Africa",  flag:"🇿🇦", tier:"EM", region:"Africa"},
  {code:"NG", label:"Nigeria",       flag:"🇳🇬", tier:"EM", region:"Africa"},
  {code:"KE", label:"Kenya",         flag:"🇰🇪", tier:"EM", region:"Africa"},
  {code:"EG", label:"Egypt",         flag:"🇪🇬", tier:"EM", region:"Africa"},
  {code:"MA", label:"Morocco",       flag:"🇲🇦", tier:"EM", region:"Africa"},
];
export const MARKET_MAP = Object.fromEntries(MARKETS.map(m => [m.code, m]));
