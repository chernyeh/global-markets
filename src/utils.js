const MICRO_KEYWORDS = /\b(earnings|revenue|profit|loss|EPS|guidance|dividend|buyback|repurchase|acquisition|merger|takeover|IPO|listing|delisting|CEO|CFO|CTO|appoint|resign|downgrade|upgrade|target price|analyst|price target|beat|miss|outlook|forecast|results|quarterly|annual report|rights issue|placement|disposal|stake|JV|joint venture|contract|deal|award|tender|lawsuit|settlement|fine|penalty|recall|bankruptcy|restructur|spinoff|spin-off|demerger|rights offer|AGM|EGM|shareholder|insider|buyout|LBO|PE fund|privatisation|privatization|delist|default|impairment|writedown|write-off|capex|guidance|raise|cut|lifted|lowered|reaffirm|initiat|reiterat)\b/i;

export function classifyMicro(title) {
  return MICRO_KEYWORDS.test(title);
}

// ─── Commerce / affiliate junk ────────────────────────────────────────────────
// Several publishers — WIRED most aggressively — push affiliate coupon and
// promo-code pages through the same RSS feed as their editorial. They carry no
// news value here, and because they read as "recommendations" the opinion
// classifier files them into the Opinions tab too. Dropped at ingest so they
// never reach any tab.
//
// Retail promo language overlaps with financial vocabulary — a bond has a
// coupon, a stock trades at a discount, an index sits 20% off its high — so
// every rule below either requires an unambiguous retail construction or pairs
// a commerce cue with an explicit anti-finance guard.

// "Coupon"/"discount" in their financial sense. Checked first; never junk.
const FINANCE_SENSE_RE = /\b(zero|high|low|fixed|floating|step-?up|semi-?annual)[-\s]coupon\b|\bcoupon\s+(rate|payment|bond|yield|clipping|stripping)|\bbonds?'?\s+coupon\b|\bdiscount\s+(rate|window|bond|to\s+(nav|book|peers|net\s+asset))/i;

const COMMERCE_TITLE_RES = [
  // "Promo Code", "Discount Codes", "Coupon Code" — retail-only construction.
  /\b(coupon|promo|promotional|discount|voucher)\s+codes?\b/i,
  // "40% Off", "Up to $100 Off" — but not "20% off its record high".
  /\b\d{1,3}\s?%\s*off\b(?!\s+(its|their|the|a|record|all-?time|52-?week|highs?|peaks?|lows?))/i,
  /\bup\s+to\s+\$\s?\d[\d,.]*\s*off\b/i,
  // Seasonal sale round-ups.
  /\b(black friday|cyber monday|prime day|boxing day|labor day|memorial day|presidents'? day|back[-\s]to[-\s]school)\b[\s\S]{0,40}\b(deals?|sales?|discounts?|offers?)\b/i,
  // "Deals & Coupons", "Savings and Promo Codes". "Offers" is left out — "deals
  // and offers" is ordinary dealmaking language.
  /\b(deals?|discounts?|savings?)\s*(&|and)\s*(coupons?|promo\s+codes?)\b/i,
];

// "Coupon" alone is only junk beside a retail savings cue.
const COUPON_RE = /\bcoupons?\b/i;
const SAVINGS_CUE_RE = /\b(save|saving|savings|score|grab|snag)\b[\s\S]{0,25}(\$\s?\d|\d{1,3}\s?%|free\s+trial|deal)|\b(free\s+trial|\d{1,3}\s?%\s*off|\$\s?\d[\d,.]*\s*off)\b/i;

// URL paths publishers reserve for their commerce desks. Deliberately narrow:
// "/deals/" is NOT here — Reuters and Bloomberg file M&A stories under it.
const COMMERCE_PATH_RE = /\/(coupons?|promo-?codes?|discount-?codes?|vouchers?|coupons?-and-deals|deals-and-coupons)(\/|$|\?|#)/i;

export function isCommerceJunk(title, link) {
  if (link && COMMERCE_PATH_RE.test(String(link))) return true;
  const t = title || "";
  if (!t) return false;
  if (FINANCE_SENSE_RE.test(t)) return false;
  if (COMMERCE_TITLE_RES.some(re => re.test(t))) return true;
  return COUPON_RE.test(t) && SAVINGS_CUE_RE.test(t);
}
