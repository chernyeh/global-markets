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
      : "Mozilla/5.0 (compatible; NewsAggregator/1.0)";

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/atom+xml, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
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
