import { useState, useEffect, useContext } from "react";
import { FontScaleCtx } from "../context.js";
import { SOURCES } from "../data/sources.js";

// ─── REF-link resolver ────────────────────────────────────────────────────────
export function findLinksForBullet(bulletText, articles) {
  if (!articles?.length || !bulletText) return [];
  const refMatch = bulletText.match(/\[REF:([\d,\s]+)\]/);
  if (refMatch) {
    const indices = refMatch[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    return indices.map(i=>articles[i]).filter(Boolean);
  }
  const words = bulletText.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>4);
  return articles
    .map(a=>{
      const haystack=((a.translatedTitle||a.title)+" "+(a.source||"")).toLowerCase();
      const hits=words.filter(w=>haystack.includes(w)).length;
      return {art:a,score:hits};
    })
    .filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.art);
}

// ─── Stock quote helpers ──────────────────────────────────────────────────────
const QUOTE_CACHE = {};
const QUOTE_TTL = 5 * 60 * 1000;

const SKIP_TICKERS = new Set([
  "REF","US","EU","UK","HK","JP","CN","KR","TW","IN","AU","DE","SG","CA","IL","IR","ME",
  "USD","EUR","GBP","JPY","CNY","SGD","HKD","AUD","CAD","KRW","TWD","INR","SAR","AED",
  "GDP","CEO","CFO","CTO","IPO","ETF","ESG","AI","API","EPS","QOQ","YOY","MOM","PE",
  "FED","ECB","IMF","BOJ","RBI","MAS","PBOC","BOK","RBA","BOC","SNB","BOE",
  "NYSE","NASDAQ","HKEX","SGX","TSE","KSE","ASX","BSE","NSE","LSE",
  "OPEC","NATO","UN","WTO","BIS","SWIFT","G7","G20","ASEAN","GCC",
]);

export function extractTickers(text) {
  const re = /\(([A-Z0-9][A-Z0-9.-]{1,8})\)/g;
  const found = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[1];
    if (!SKIP_TICKERS.has(t)) found.add(t);
  }
  return [...found];
}

export async function fetchQuotes(tickers) {
  if (!tickers.length) return {};
  const now = Date.now();
  const needFetch = tickers.filter(t => !QUOTE_CACHE[t] || now - QUOTE_CACHE[t].ts > QUOTE_TTL);
  const fromCache = Object.fromEntries(
    tickers
      .filter(t => QUOTE_CACHE[t] && now - QUOTE_CACHE[t].ts <= QUOTE_TTL)
      .map(t => [t, QUOTE_CACHE[t].data])
  );
  if (!needFetch.length) return fromCache;
  try {
    const r = await fetch(`/api/quote?symbols=${encodeURIComponent(needFetch.join(","))}`);
    if (!r.ok) return fromCache;
    const data = await r.json();
    const results = data?.quoteResponse?.result ?? [];
    const fresh = {};
    for (const q of results) {
      const pct = q.regularMarketChangePercent;
      fresh[q.symbol] = { pct: typeof pct === "number" ? pct : null };
      QUOTE_CACHE[q.symbol] = { data: fresh[q.symbol], ts: now };
    }
    for (const t of needFetch) {
      if (!(t in fresh)) {
        fresh[t] = null;
        QUOTE_CACHE[t] = { data: null, ts: now };
      }
    }
    return { ...fromCache, ...fresh };
  } catch {
    return fromCache;
  }
}

// Wraps "Company Name (TICKER)" occurrences with a Yahoo Finance link + price badge
function renderTickers(text, quotes, baseKey = "") {
  if (!text || quotes === null) return text;
  const re = /([A-Z][A-Za-z0-9.,&'-]{0,}(?:\s+[A-Z][A-Za-z0-9.,&'-]*){0,4})\s+\(([A-Z0-9][A-Z0-9.-]{1,8})\)/g;
  const nodes = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    const [full, company, ticker] = m;
    if (SKIP_TICKERS.has(ticker)) continue;
    const quote = quotes[ticker];
    if (quote === undefined) continue;
    const pct = quote?.pct;
    const yahooUrl = `https://finance.yahoo.com/quote/${ticker}/`;
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span key={`${baseKey}-${m.index}`} style={{whiteSpace:"nowrap"}}>
        <a href={yahooUrl} target="_blank" rel="noopener noreferrer"
          style={{color:"inherit",textDecoration:"underline",textDecorationColor:"#b0b0b0",textUnderlineOffset:"2px"}}>
          {company}
        </a>
        {" "}
        <span style={{
          color: pct == null ? "#999" : pct >= 0 ? "#2e7d32" : "#c0392b",
          fontWeight: 700,
          fontSize: "0.85em",
        }}>
          ({pct == null ? ticker : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`})
        </span>
      </span>
    );
    last = m.index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

// Handles **bold** markers AND ticker links in inline text
function renderInline(text, quotes, baseKey = "") {
  if (!text || quotes === null) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  if (parts.length === 1) return renderTickers(text, quotes, baseKey);
  return parts.flatMap((part, pi) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={`${baseKey}-b${pi}`} style={{color:"#1a1a1a"}}>{renderTickers(part.slice(2,-2), quotes, `${baseKey}-b${pi}`)}</strong>];
    }
    return renderTickers(part, quotes, `${baseKey}-p${pi}`);
  });
}

// ─── BriefRenderer ────────────────────────────────────────────────────────────
export default function BriefRenderer({text, articles=[]}) {
  const fontScale = useContext(FontScaleCtx);
  const [quotes, setQuotes] = useState(null);
  useEffect(() => {
    if (!text) return;
    const tickers = extractTickers(text);
    if (!tickers.length) { setQuotes({}); return; }
    fetchQuotes(tickers).then(setQuotes);
  }, [text]);

  if (!text) return null;
  const rawLines = text.split("\n");
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t === "---" || t === "***" || t === "___") continue;
    if (/^\*\*[^*]+\*\*:?$/.test(t) && !t.startsWith("- ") && !t.startsWith("* ")) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j].trim()) j++;
      const next = rawLines[j]?.trim() || "";
      if (next && !next.startsWith("#") && !next.startsWith("- ") && !next.startsWith("* ") && !next.startsWith("**")) {
        lines.push(t + "\n" + next);
        i = j;
        continue;
      }
    }
    lines.push(rawLines[i]);
  }
  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:14,marginTop:4}}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{height:6}}/>;
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(13*fontScale),
              fontWeight:700,color:"#8B4513",margin:"22px 0 10px",
              textTransform:"uppercase",letterSpacing:"0.1em",
              borderBottom:"2px solid #e0d8cc",paddingBottom:6}}>
              {trimmed.replace(/^## /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <div key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(16*fontScale),
              fontWeight:700,color:"#1a1a1a",margin:"4px 0 14px",lineHeight:1.3}}>
              {trimmed.replace(/^# /,"")}
            </div>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const txt = trimmed.replace(/^[-*] /,"");
          const cleanTxt = txt.replace(/\[REF:[\d,\s]+\]/g, "").trim();
          const boldMatch = cleanTxt.match(/^\*\*(.+?)\*\*:?\s*(.*)/s);
          const links = findLinksForBullet(txt, articles);
          return (
            <div key={i} style={{display:"flex",gap:8,margin:"8px 0",paddingLeft:8,alignItems:"flex-start"}}>
              <span style={{color:"#c0392b",fontWeight:700,marginTop:2,flexShrink:0,fontSize:Math.round(16*fontScale)}}>•</span>
              <span style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(14*fontScale),color:"#1a1a1a",lineHeight:1.7}}>
                {boldMatch
                  ? <><strong style={{color:"#1a1a1a"}}>{renderTickers(boldMatch[1], quotes, `${i}-b`)}</strong>{boldMatch[2] ? <>{": "}{renderInline(boldMatch[2], quotes, `${i}-r`)}</> : ""}</>
                  : renderInline(cleanTxt, quotes, `${i}-t`)}
                {links.map((a,li) => {
                  const src = SOURCES.find(s=>s.id===a.sourceId);
                  const isPaywall = src?.paywall;
                  const rawName = src?.name || a.source || "LINK";
                  const shortName = rawName.split(" ").slice(0,2).join(" ").slice(0,14);
                  const bg = isPaywall ? "#6b6b6b" : "#2a6a4a";
                  const bgHover = isPaywall ? "#444" : "#1a4a32";
                  return (
                    <a key={li} href={a.link} target="_blank" rel="noopener noreferrer"
                      title={`${rawName}${isPaywall?" (paywalled)":""}`}
                      style={{display:"inline-flex",alignItems:"center",gap:3,marginLeft:6,
                        padding:"2px 7px",background:bg,color:"#fff",borderRadius:3,
                        fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:600,
                        textDecoration:"none",letterSpacing:"0.03em",verticalAlign:"middle",
                        transition:"background 0.15s"}}
                      onMouseOver={e=>e.currentTarget.style.background=bgHover}
                      onMouseOut={e=>e.currentTarget.style.background=bg}>
                      {isPaywall && <span style={{fontSize:8,opacity:0.85}}>🔒</span>}
                      {shortName}
                    </a>
                  );
                })}
              </span>
            </div>
          );
        }
        const mergedMatch = trimmed.match(/^\*\*([^*]+)\*\*:?\n([\s\S]+)$/);
        const cleanPara = trimmed.replace(/\[REF:[\d,\s]+\]/g, "").trim();
        return (
          <p key={i} style={{fontFamily:"'Spectral',Georgia,serif",fontSize:Math.round(14*fontScale),
            color:"#1a1a1a",lineHeight:1.7,margin:"10px 0",
            background:"#f0ece4",padding:"14px 18px",borderRadius:4}}>
            {mergedMatch
              ? <><strong>{renderTickers(mergedMatch[1].replace(/\[REF:[\d,\s]+\]/g,"").trim(), quotes, `${i}-mb`)}</strong>{": "}{renderInline(mergedMatch[2].replace(/\[REF:[\d,\s]+\]/g,"").trim(), quotes, `${i}-mr`)}</>
              : renderInline(cleanPara, quotes, `${i}-p`)
            }
          </p>
        );
      })}
    </div>
  );
}
