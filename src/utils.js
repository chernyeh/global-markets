const MICRO_KEYWORDS = /\b(earnings|revenue|profit|loss|EPS|guidance|dividend|buyback|repurchase|acquisition|merger|takeover|IPO|listing|delisting|CEO|CFO|CTO|appoint|resign|downgrade|upgrade|target price|analyst|price target|beat|miss|outlook|forecast|results|quarterly|annual report|rights issue|placement|disposal|stake|JV|joint venture|contract|deal|award|tender|lawsuit|settlement|fine|penalty|recall|bankruptcy|restructur|spinoff|spin-off|demerger|rights offer|AGM|EGM|shareholder|insider|buyout|LBO|PE fund|privatisation|privatization|delist|default|impairment|writedown|write-off|capex|guidance|raise|cut|lifted|lowered|reaffirm|initiat|reiterat)\b/i;

export function classifyMicro(title) {
  return MICRO_KEYWORDS.test(title);
}
