// ─── Model tiers ───────────────────────────────────────────────────────────────
// Two task shapes cover every prompt in this app: short classification/extraction
// (tagging, grouping, one-line summaries, a single index pick) and long-form
// synthesis that needs real editorial judgment (the actual briefs a user reads).
// Haiku holds quality on the former at a fraction of the cost; the synthesis
// calls stay on Sonnet, which is also the stronger model of the two tiers.
// Call sites pass one of these explicitly via callClaude's `model` option —
// see each call site for why it's tagged the way it is.
export const MODEL_CLASSIFY = "claude-haiku-4-5";
export const MODEL_SYNTHESIZE = "claude-sonnet-5";

// ─── Shared async utilities ───────────────────────────────────────────────────
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Exponential backoff with jitter; honours a Retry-After header when present.
export function backoff(attempt, res) {
  const base = 600 * Math.pow(2, attempt);
  const jitter = Math.random() * 300;
  const ra = res && Number(res.headers?.get?.("retry-after"));
  return (ra ? ra * 1000 : 0) + base + jitter;
}

// Bounded-concurrency map that preserves input order in the result array.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// callClaude always returns a string on success. By default it swallows errors
// and returns "" (legacy callers JSON.parse the result and have their own
// fallbacks). Pass { throwOnError:true } to surface failures to the UI.
export async function callClaude(prompt, maxTokens=2000, opts={}) {
  const { timeoutMs=45000, retries=2, throwOnError=false, model=MODEL_SYNTHESIZE } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }]
        })
      });
      clearTimeout(timer);

      // Retryable upstream errors: rate limit, overload, 5xx (incl. Vercel 504).
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        lastErr = new Error(`api_${res.status}`);
        if (attempt < retries) { await sleep(backoff(attempt, res)); continue; }
        if (throwOnError) throw lastErr;
        return "";
      }

      const data = await res.json();
      if (data?.type === "error" || data?.error) {
        lastErr = new Error(data?.error?.message || "api_error");
        if (attempt < retries) { await sleep(backoff(attempt)); continue; }
        if (throwOnError) throw lastErr;
        return "";
      }

      const text = data.content?.[0]?.text;
      if (typeof text !== "string") {
        if (throwOnError) throw new Error("empty_response");
        return "";
      }
      return text;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // Timeouts (AbortError) have already consumed the budget — don't retry.
      if (attempt < retries && e.name !== "AbortError") { await sleep(backoff(attempt)); continue; }
      if (throwOnError) throw lastErr;
      return "";
    }
  }
  if (throwOnError) throw lastErr;
  return "";
}
