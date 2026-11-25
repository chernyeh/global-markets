// Watchlist bottom line: six questions answered from the board's own numbers
// (no model involved) — same shape as the Macro tab's (src/macroSummary.js),
// drawn by components/macro/BottomLine.jsx.

import { basket } from "./watchCalc.js";

const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "±");
const p1 = v => `${sgn(v)}${Math.abs(v).toFixed(1)}%`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;
const short = r => (r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name);
// A list cut to its first n entries for the line; the whole list (full names)
// goes with it, so the row's "+N more" button can open it.
const many = (shortItems, fullItems = shortItems, n = 3) =>
  ({ text: shortItems.slice(0, n).join("; "), all: fullItems.length > n ? fullItems : null, shown: n });
const detailOf = m => (m ? { detail: m.text, detailAll: m.all, detailShown: m.shown } : {});
const extraOf = (label, m) => (m ? { extra: `${label}${m.text}`, extraLabel: label, extraAll: m.all, extraShown: m.shown } : {});

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
    ...(unusual.length ? detailOf(many(unusual.map(r => `${short(r)} ${p1(r.q.chg1d)} (${Math.abs(r.q.z1d).toFixed(1)}σ)`),
      unusual.map(r => `${r.name} ${p1(r.q.chg1d)} (${Math.abs(r.q.z1d).toFixed(1)}σ)`)))
      : { detail: top ? `largest: ${short(top)} ${p1(top.q.chg1d)}` : null }) });

  // 2. Gauges (groups)
  const groups = {};
  for (const r of priced) if (r.group) (groups[r.group] = groups[r.group] || []).push(r);
  const g = Object.entries(groups).filter(([, rs]) => rs.length >= 2).map(([k, rs]) => ({ k, b: basket(rs) }))
    .filter(x => x.b.chg1w !== null).sort((a, b) => Math.abs(b.b.chg1w) - Math.abs(a.b.chg1w));
  out.push({ id: "gauges", q: "Which gauges moved this week?",
    tip: { t: "Gauges", d: "Each group you set is read as an equal-weighted basket of its members.", r: "Ranked by the size of the basket's 1-week move; groups need two priced names." },
    a: g.length ? g.slice(0, 2).map(x => `${x.k} ${p1(x.b.chg1w)}`).join(" · ") : "No groups yet", tone: "neutral",
    ...(g.length > 2 ? detailOf(many(g.slice(2).map(x => `${x.k} ${p1(x.b.chg1w)}`))) : { detail: g.length ? null : "give names a group (open a row) to read them as baskets" }) });

  // 3/4. Levels
  const met = side => priced.filter(r => r.nearest?.met && r.nearest.side === side);
  const near = priced.filter(r => r.nearest && !r.nearest.met && r.nearest.side === "buy" && Math.abs(r.nearest.move) <= 5);
  // Through a level: how far past it. Not there yet: the move needed to reach it.
  const past = r => `${Math.abs(r.nearest.dist).toFixed(1)}% ${r.nearest.side === "sell" ? "above" : "below"} ${r.nearest.label}`;
  const toGo = r => `${p1(r.nearest.move)} to ${r.nearest.label}`;
  const buy = met("buy");
  out.push({ id: "buy", q: "Anything at my buy levels?",
    tip: { t: "Buy levels", d: "Your Gloomberg watchlist alert price and, where a thesis exists, its entry and Munger prices.",
      r: "At = price at or below the level. Levels in a different currency from the quote are skipped (flagged in the row)." },
    a: buy.length ? `${buy.length} at or below` : "None", tone: buy.length ? "good" : "neutral",
    ...(buy.length ? detailOf(many(buy.map(r => `${short(r)} (${past(r)})`), buy.map(r => `${r.name} (${past(r)})`))) : {}),
    ...(near.length ? extraOf("within 5%: ", many(near.map(r => `${short(r)} ${toGo(r)}`), near.map(r => `${r.name} ${toGo(r)}`))) : {}) });
  const sell = met("sell"), risk = met("risk");
  out.push({ id: "sell", q: "Anything at sell or risk levels?",
    tip: { t: "Sell and risk levels", d: "Thesis exit price and holding target (sell); thesis invalidation price and holding stop-loss (risk)." },
    a: risk.length || sell.length ? [risk.length ? `${risk.length} through a risk level` : null, sell.length ? `${sell.length} at a sell level` : null].filter(Boolean).join(" · ") : "None",
    tone: risk.length ? "bad" : sell.length ? "warn" : "neutral",
    ...([...risk, ...sell].length ? detailOf(many([...risk, ...sell].map(r => `${short(r)} (${past(r)})`), [...risk, ...sell].map(r => `${r.name} (${past(r)})`))) : {}) });

  // 5. News flow — judged only where the usual rate can be measured. When
  // Google's 100-headline cap is hit it returns a sample of the week, not the
  // newest 100, so neither "in 24h" nor "per day" is a real count for that name.
  const surge = rows.filter(r => r.news.surge).sort((a, b) => b.news.n24 / Math.max(1, b.news.perDay) - a.news.n24 / Math.max(1, a.news.perDay));
  const capped = rows.filter(r => r.news.capped).sort((a, b) => b.news.n7 - a.news.n7);
  const busiest = rows.filter(r => !r.news.capped).sort((a, b) => b.news.n24 - a.news.n24)[0];
  const sx = r => `${r.news.n24} in 24h vs ${r.news.perDay.toFixed(1)}/day`;
  out.push({ id: "news", q: "Unusual news flow?",
    tip: { t: "News flow", d: "Google News (English and the home-market language) plus this app's own feeds, kept only where the headline names the company.",
      r: "Unusual = at least 3 stories in 24 hours and 2.5× the usual daily rate of the six days before. Names whose coverage hits Google's 100-headline cap can't be measured (Google then returns a sample of the week, not every story) and are listed apart, not called unusual." },
    a: !newsLoaded ? "Loading…" : surge.length ? `${surge.length} name${surge.length > 1 ? "s" : ""} busier than usual` : "Nothing unusual", tone: surge.length ? "warn" : "neutral",
    ...(surge.length ? detailOf(many(surge.map(r => `${short(r)}: ${sx(r)}`), surge.map(r => `${r.name}: ${sx(r)}`)))
      : { detail: newsLoaded && busiest?.news.n24 ? `busiest measurable: ${short(busiest)} ${busiest.news.n24} in 24h` : null }),
    ...(capped.length ? extraOf("100+ a week, not measured: ", many(capped.map(short), capped.map(r => r.name), 4)) : {}) });

  // 6. Coming up
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
  const events = [];
  for (const r of rows) {
    const est = r.nextResults?.est ? " (est.)" : "";
    if (r.nextResults?.date >= today && r.nextResults.date <= horizon) events.push({ d: r.nextResults.date, t: `${short(r)} results${est}`, full: `${r.name} results${est}` });
    if (r.exDiv?.ex_date >= today && r.exDiv.ex_date <= horizon) events.push({ d: r.exDiv.ex_date, t: `${short(r)} ex-div`, full: `${r.name} ex-div` });
  }
  events.sort((a, b) => (a.d < b.d ? -1 : 1));
  out.push({ id: "next", q: "What reports in the next 14 days?",
    tip: { t: "Coming up", d: "Results dates from your thesis where one exists, else Yahoo's earnings calendar (est. = Yahoo's estimate, not a company announcement). Ex-dividend dates from Gloomberg's dividend table." },
    a: events.length ? `${events.length} event${events.length > 1 ? "s" : ""}` : "Nothing dated", tone: "neutral",
    ...(events.length ? detailOf(many(events.map(e => `${day(e.d)} ${e.t}`), events.map(e => `${day(e.d)} ${e.full}`), 4)) : {}) });

  return out;
}
