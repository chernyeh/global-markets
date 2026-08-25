// Some publishers answer 403 to the generic aggregator User-Agent and only serve
// their RSS to what looks like a browser. Matched on hostname suffix so we keep
// identifying ourselves honestly everywhere else (and to SEC EDGAR, which
// requires the opposite).
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// hostname suffix → any extra request headers that host needs alongside the
// browser User-Agent. CTEE (工商時報) serves /rss_web/... only with a same-site
// Referer and a Traditional Chinese Accept-Language.
const BROWSER_HEADER_HOSTS = {
  "ctee.com.tw": {
    "Referer": "https://www.ctee.com.tw/",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  },
};

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function matchHost(url) {
  const host = hostOf(url);
  if (!host) return null;
  return Object.keys(BROWSER_HEADER_HOSTS).find(
    h => host === h || host.endsWith(`.${h}`)
  ) || null;
}

function needsBrowserHeaders(url) {
  return matchHost(url) !== null;
}

function extraHeadersFor(url) {
  const match = matchHost(url);
  return match ? BROWSER_HEADER_HOSTS[match] : {};
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const url = req.query.url;

  if (!url) {
    res.status(400).json({ error: "No URL", xml: null });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // SEC EDGAR requires a declared User-Agent per their fair-access policy:
    // https://www.sec.gov/os/accessing-edgar-data
    // Format must identify the tool and provide contact info
    const isSEC = url.includes("sec.gov");
    const userAgent = isSEC
      ? "GlobalMarketsWire/1.0 (investment-research-aggregator; contact@globalmarketswire.com)"
      : needsBrowserHeaders(url)
        ? BROWSER_UA
        : "Mozilla/5.0 (compatible; NewsAggregator/1.0)";

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/atom+xml, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        ...extraHeadersFor(url),
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const xml = await response.text();
    res.status(200).send(xml);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
