export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Get URL from query string (most reliable on Vercel)
  const url = req.query.url;

  if (!url) {
    res.status(400).json({ error: "No URL", xml: null });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        "Accept": "*/*",
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
