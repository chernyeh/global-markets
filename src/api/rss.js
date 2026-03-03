export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { url } = req.body;
  if (!url) { res.status(400).json({ error: "No URL" }); return; }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSS Reader/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      res.status(200).json({ error: "HTTP " + response.status, xml: null });
      return;
    }
    const xml = await response.text();
    res.status(200).json({ xml });
  } catch (error) {
    res.status(200).json({ error: error.message, xml: null });
  }
}
