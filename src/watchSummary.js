// Watchlist bottom line: six questions answered from the board's own numbers
// (no model involved) — same shape as the Macro tab's (src/macroSummary.js),
// drawn by components/macro/BottomLine.jsx.

import { basket } from "./watchCalc.js";

const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "±");
const p1 = v => `${sgn(v)}${Math.abs(v).toFixed(1)}%`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;
const short = r => (r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name);
const list = (arr, n = 3) => arr.slice(0, n).join("; ") + (arr.length > n ? `; +${arr.length - n} more` : "");

export function watchBottomLine(rows, { today, newsLoaded }) {
  const priced = rows.filter(r => r.q?.last);
  const out = [];

  // 1. Unusual moves
  const unusual = priced.filter(r => r.q.z1d !== null && Math.abs(r.q.z1d) >= 2.5).sort((a, b) => Math.abs(b.q.z1d) - Math.abs(a.q.z1d));
  const top = [...priced].filter(r => r.q.chg1d !== null).sort((a, b) => Math.abs(b.q.chg1d) - Math.abs(a.q.chg1d))[0];
  out.push({ id: "moves", q: "Unusual moves on the day?",
    tip: { t: "Unusual moves", d: "A name's latest daily move measured against the spread (σ, standard deviation) of its previous 60 daily moves.",
      r: "2.5σ or more is listed; 3σ or more also raises an alert. A big move in a quiet stock can matter more than the same % in a volatile one." },
    a: unusual.length ? `${unusual.length} beyond 2.5σ` : "None beyond 2.5σ", tone: unusual.length ? "warn" : "neutral",
    detail: unusual.length ? list(unusual.map(r => `${short(r)} ${p1(r.q.chg1d)} (${Math.abs(r.q.z1d).toFixed(1)}σ)`))
      : top ? `largest: ${short(top)} ${p1(top.q.chg1d)}` : null });

  // 2. Gauges (groups)
  const groups = {};
  for (const r of priced) if (r.group) (groups[r.group] = groups[r.group] || []).push(r);
  const g = Object.entries(groups).filter(([, rs]) => rs.length >= 2).map(([k, rs]) => ({ k, b: basket(rs) }))
    .filter(x => x.b.chg1w !== null).sort((a, b) => Math.abs(b.b.chg1w) - Math.abs(a.b.chg1w));
  out.push({ id: "gauges", q: "Which gauges moved this week?",
    tip: { t: "Gauges", d: "Each group you set is read as an equal-weighted basket of its members.", r: "Ranked by the size of the basket's 1-week move; groups need two priced names." },
    a: g.length ? g.slice(0, 2).map(x => `${x.k} ${p1(x.b.chg1w)}`).join(" · ") : "No groups yet", tone: "neutral",
    detail: g.length > 2 ? list(g.slice(2).map(x => `${x.k} ${p1(x.b.chg1w)}`), 3) : g.length ? null : "give names a group (open a row) to read them as baskets" });

  // 3/4. Levels
  const met = side => priced.filter(r => r.nearest?.met && r.nearest.side === side);
  const near = priced.filter(r => r.nearest && !r.nearest.met && r.nearest.side === "buy" && Math.abs(r.nearest.dist) <= 5);
  const buy = met("buy");
  out.push({ id: "buy", q: "Anything at my buy levels?",
    tip: { t: "Buy levels", d: "Your Gloomberg watchlist alert price and, where a thesis exists, its entry and Munger prices.",
      r: "At = price at or below the level. Levels in a different currency from the quote are skipped (flagged in the row)." },
    a: buy.length ? `${buy.length} at or below` : "None", tone: buy.length ? "good" : "neutral",
    detail: buy.length ? list(buy.map(r => `${short(r)} (${r.nearest.label} ${p1(r.nearest.dist)})`)) : null,
    extra: near.length ? `within 5%: ${list(near.map(r => `${short(r)} ${p1(r.nearest.dist)} vs ${r.nearest.label}`))}` : null });
  const sell = met("sell"), risk = met("risk");
  out.push({ id: "sell", q: "Anything at sell or risk levels?",
    tip: { t: "Sell and risk levels", d: "Thesis exit price and holding target (sell); thesis invalidation price and holding stop-loss (risk)." },
    a: risk.length || sell.length ? [risk.length ? `${risk.length} through a risk level` : null, sell.length ? `${sell.length} at a sell level` : null].filter(Boolean).join(" · ") : "None",
    tone: risk.length ? "bad" : sell.length ? "warn" : "neutral",
    detail: [...risk, ...sell].length ? list([...risk, ...sell].map(r => `${short(r)} (${r.nearest.label})`)) : null });

  // 5. News flow
  const surge = rows.filter(r => r.news.surge).sort((a, b) => b.news.n24 - a.news.n24);
  const busiest = [...rows].sort((a, b) => b.news.n24 - a.news.n24)[0];
  out.push({ id: "news", q: "Unusual news flow?",
    tip: { t: "News flow", d: "Google News (English and the home-market language) plus this app's own feeds, kept only where the headline names the company.",
      r: "Unusual = at least 3 stories in 24 hours and 2.5× the daily rate of the six days before. For busy names Google's 100-story limit covers less than a week, so the usual rate is taken over the days it does cover; under 1.5 days covered, no call is made." },
    a: !newsLoaded ? "Loading…" : surge.length ? `${surge.length} name${surge.length > 1 ? "s" : ""} busier than usual` : "Nothing unusual", tone: surge.length ? "warn" : "neutral",
    detail: surge.length ? list(surge.map(r => `${short(r)}: ${r.news.n24} in 24h vs ${r.news.perDay.toFixed(1)}/day`))
      : newsLoaded && busiest?.news.n24 ? `busiest: ${short(busiest)} ${busiest.news.n24} in 24h` : null });

  // 6. Coming up
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
  const events = [];
  for (const r of rows) {
    if (r.nextResults?.date >= today && r.nextResults.date <= horizon) events.push({ d: r.nextResults.date, t: `${short(r)} results${r.nextResults.est ? " (est.)" : ""}` });
    if (r.exDiv?.ex_date >= today && r.exDiv.ex_date <= horizon) events.push({ d: r.exDiv.ex_date, t: `${short(r)} ex-div` });
  }
  events.sort((a, b) => (a.d < b.d ? -1 : 1));
  out.push({ id: "next", q: "What reports in the next 14 days?",
    tip: { t: "Coming up", d: "Results dates from your thesis where one exists, else Yahoo's earnings calendar (est. = Yahoo's estimate, not a company announcement). Ex-dividend dates from Gloomberg's dividend table." },
    a: events.length ? `${events.length} event${events.length > 1 ? "s" : ""}` : "Nothing dated", tone: "neutral",
    detail: events.length ? list(events.map(e => `${day(e.d)} ${e.t}`), 4) : null });

  return out;
}
