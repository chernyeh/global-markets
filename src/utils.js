const MICRO_KEYWORDS = /\b(earnings|revenue|profit|loss|EPS|guidance|dividend|buyback|repurchase|acquisition|merger|takeover|IPO|listing|delisting|CEO|CFO|CTO|appoint|resign|downgrade|upgrade|target price|analyst|price target|beat|miss|outlook|forecast|results|quarterly|annual report|rights issue|placement|disposal|stake|JV|joint venture|contract|deal|award|tender|lawsuit|settlement|fine|penalty|recall|bankruptcy|restructur|spinoff|spin-off|demerger|rights offer|AGM|EGM|shareholder|insider|buyout|LBO|PE fund|privatisation|privatization|delist|default|impairment|writedown|write-off|capex|guidance|raise|cut|lifted|lowered|reaffirm|initiat|reiterat)\b/i;

export function classifyMicro(title) {
  return MICRO_KEYWORDS.test(title);
}

// ─── Headline clean-up ────────────────────────────────────────────────────────
// Google News (and a few publishers) tag every headline with the outlet:
// "Fed holds rates - Reuters". We strip that tag, but ONLY when the text after
// the separator really is the outlet's name. Two rules keep real headlines whole:
//   1. The separator must have a space on both sides. An unspaced hyphen is part
//      of a word ("Late-Life", "U.S.-China", "Long-Term") and is never cut.
//   2. The tag must match the outlet — the Google News <source> name, the feed's
//      own name, or the site's domain. A spaced dash inside a headline
//      ("Stocks slide – and that's fine") is left alone.
const GENERIC_HOST_LABELS = new Set([
  "www","rss","feeds","feed","news","m","amp","edition","public","content",
  "com","net","org","co","uk","au","in","sg","hk","jp","kr","tw","cn","de","fr",
  "br","za","ca","my","ae","sa","tr","il","eu","io","biz","info","gov",
]);
const normTag = s => (s || "").toLowerCase()
  .replace(/^the\s+/, "")
  .replace(/[^\p{L}\p{N}]+/gu, "");

function hostLabels(url) {
  try {
    return new URL(url).hostname.toLowerCase().split(".")
      .filter(p => p.length >= 3 && !GENERIC_HOST_LABELS.has(p));
  } catch { return []; }
}

// outlets: names the tag may match (e.g. ["Reuters", "Reuters Business"]).
// urls:    URLs whose domains may match the tag (e.g. the <source url>, feed URL).
export function stripOutletSuffix(title, { outlets = [], urls = [] } = {}) {
  // Exact outlet name first — Google News appends its <source> text verbatim,
  // which may itself contain a hyphen or pipe ("Observer-Reporter").
  for (const name of outlets) {
    if (!name || name.length < 2) continue;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exact = (title || "").match(new RegExp(`^(.*\\S)\\s+[-–—|]\\s+${esc}$`, "i"));
    if (exact) return exact[1].trim();
  }
  const m = (title || "").match(/^(.*\S)\s+[-–—|]\s+([^-–—|]{2,60})$/);
  if (!m) return title;
  const tag = normTag(m[2]);
  if (tag.length < 3) return title;
  const cands = [
    ...outlets.map(normTag),
    ...urls.flatMap(hostLabels),
  ].filter(c => c && c.length >= 3);
  // Exact match, or the tag is a short form of the outlet ("WSJ" for "WSJ Opinion").
  const isOutlet = cands.some(c => tag === c || c.startsWith(tag));
  return isOutlet ? m[1].trim() : title;
}
