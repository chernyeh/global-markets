export const config = {
  maxDuration: 60, // extend Vercel timeout to 60 seconds
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const { stream: wantsStream, ...anthropicBody } = req.body;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(wantsStream ? { ...anthropicBody, stream: true } : anthropicBody),
    });

    if (!wantsStream) {
      const data = await upstream.json();
      res.status(upstream.status).json(data);
      return;
    }

    // Non-200 upstream means an error JSON body, not a stream
    if (!upstream.ok) {
      const errData = await upstream.json();
      res.status(upstream.status).json(errData);
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.status(200);

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else res.end();
  }
}
