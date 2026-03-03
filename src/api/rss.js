export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Accept URL from either POST body or GET query param
  const url = (req.body && req.body.url) || req.query.url;

  if (!url) {
    res.status(400).json({ error: "No URL provided", xml: null });
    return;
  }

  const controllers = [];
  const TIMEOUT = 10000;

  try {
    const controller = new AbortController();
    controllers.push(controller);
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      res.status(200).json({ error: "HTTP " + response.status, xml: null });
      return;
    }

    const xml = await response.text();

    if (!xml || xml.length < 50) {
      res.status(200).json({ error: "Empty response", xml: null });
      return;
    }

    res.status(200).json({ xml });

  } catch (error) {
    res.status(200).json({ error: error.message, xml: null });
  }
}
