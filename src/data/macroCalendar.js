// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — policy meetings, communication windows and dated catalysts
// ═══════════════════════════════════════════════════════════════════════════════
// FOMC: Federal Reserve calendar as REVISED on 12 Nov 2026 — the 7–8 Dec 2027
//   meeting moved to 16–17 Nov 2027 and 26–27 Oct 2027 is a strategy-only meeting
//   with no policy decision.
//   https://www.federalreserve.gov/newsevents/pressreleases/monetary20261112a.htm (PRIMARY)
//   https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm (PRIMARY)
// ECB: Governing Council monetary policy meetings (decision day), cross-checked
//   against the ECB's 2027 reserve-maintenance calendar (30 Jun 2026 release).
//   https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html (PRIMARY)
// Catalysts: the playbook's dated list (rev 54) and the 19 Nov note's calendar.
//   Dates marked approx are the playbook's "mid-Jan" / "early Dec" style dates;
//   replace them with the agency's release-schedule date when published.

export const FOMC_MEETINGS = [
  { start: "2026-12-08", end: "2026-12-09", sep: true },
  { start: "2027-01-26", end: "2027-01-27" },
  { start: "2027-03-16", end: "2027-03-17", sep: true },
  { start: "2027-04-27", end: "2027-04-28" },
  { start: "2027-06-08", end: "2027-06-09", sep: true },
  { start: "2027-07-27", end: "2027-07-28" },
  { start: "2027-09-14", end: "2027-09-15", sep: true },
  { start: "2027-10-26", end: "2027-10-27", noDecision: true, note: "strategy-only meeting — no policy decision" },
  { start: "2027-11-16", end: "2027-11-17", note: "moved from 7–8 Dec on 12 Nov 2026" },
  { start: "2028-01-25", end: "2028-01-26" },
];

export const ECB_MEETINGS = [
  { date: "2026-12-17", proj: true },
  { date: "2027-02-04", note: "last meeting before Lagarde leaves on 7 Feb" },
  { date: "2027-03-18", proj: true },
  { date: "2027-04-29" },
  { date: "2027-06-10", proj: true },
  { date: "2027-07-22" },
  { date: "2027-09-09", proj: true },
  { date: "2027-10-28" },
  { date: "2027-12-16", proj: true },
];

// release: data the monitor checks after the print for the Rule-10 test —
// series id and measure, the reference month, and which way is "good news"
// (lower inflation). Consensus is pasted on the calendar row.
const rel = (id, kind, ref, label, market = "us") => ({ id, kind, ref, label, market, better: "lower" });
export const MACRO_EVENTS = [
  { date: "2026-11-25", type: "us",   label: "US October PCE inflation", release: rel("corePce", "mom", "2026-10", "core PCE m/m") },
  { date: "2026-12-02", type: "eu",   label: "Euro-area November flash HICP", approx: true, release: rel("ezCore", "level", "2026-11", "euro core HICP y/y", "eu") },
  { date: "2026-12-10", type: "us",   label: "US November CPI — the day after the FOMC", release: rel("coreCpi", "mom", "2026-11", "core CPI m/m") },
  { date: "2026-12-15", type: "us",   label: "US November PPI", approx: true, release: rel("ppiCore", "mom", "2026-11", "core PPI m/m") },
  { date: "2027-01-10", type: "geo",  label: "US–China truce expires unless extended" },
  { date: "2027-01-13", type: "us",   label: "US December CPI", approx: true, release: rel("coreCpi", "mom", "2026-12", "core CPI m/m") },
  { date: "2027-01-21", type: "ust",  label: "New 10y TIPS auction" },
  { date: "2027-01-26", end: "2027-02-06", type: "earn", label: "Hyperscaler Q4 calls — 2027 capex vs ≈$935bn consensus", approx: true },
  { date: "2027-02-03", type: "ust",  label: "Treasury February refunding — coupon sizes", approx: true },
  { date: "2027-02-07", type: "eu",   label: "Lagarde leaves the ECB" },
  { date: "2027-02-11", type: "us",   label: "US January CPI — start-of-year price resets", approx: true, release: rel("coreCpi", "mom", "2027-01", "core CPI m/m") },
  { date: "2027-03-01", end: "2027-06-30", type: "us", label: "Oil base effects pull headline CPI down (≈1–1.5pp, note estimate)", approx: true },
  { date: "2027-04-11", type: "geo",  label: "French presidential election, first round (date to be set by decree)", approx: true },
  { date: "2027-05-05", type: "ust",  label: "Treasury May refunding", approx: true },
];

export const releaseKey = e => `${e.date}:${e.release.id}:${e.release.ref}`;

export const EVENT_TYPES = {
  fed:  { label: "FED",  color: "#1a1a1a" },
  ecb:  { label: "ECB",  color: "#3a6080" },
  us:   { label: "US",   color: "#8a6a20" },
  eu:   { label: "EU",   color: "#3a6080" },
  ust:  { label: "UST",  color: "#555" },
  geo:  { label: "GEO",  color: "#c0392b" },
  earn: { label: "EARN", color: "#6b4c9a" },
  mine: { label: "YOU",  color: "#1b7a3e" },
};

const DAY = 86400000;
const ms = d => Date.parse(`${d}T00:00:00Z`);
const iso = t => new Date(t).toISOString().slice(0, 10);

// Fed blackout: from the second Saturday before the meeting's first day until
// midnight ET on the day after the meeting ends (Fed communications policy).
export function fedBlackout(m) {
  const first = ms(m.start);
  const dow = new Date(first).getUTCDay(); // 0 = Sunday … 6 = Saturday
  const back = ((dow - 6 + 7) % 7) || 7;   // days back to the Saturday before
  return { start: iso(first - (back + 7) * DAY), end: iso(ms(m.end) + DAY) };
}

// ECB quiet period: begins a week before the monetary policy meeting and ends
// with the press conference. Counted from the decision day, so approximate by a day.
export function ecbQuiet(m) {
  return { start: iso(ms(m.date) - 7 * DAY), end: m.date, approx: true };
}

export function nextFomc(today) {
  return FOMC_MEETINGS.find(m => m.end >= today && !m.noDecision) || null;
}
export function nextEcb(today) {
  return ECB_MEETINGS.find(m => m.date >= today) || null;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDay = d => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;
export const fmtRange = (a, b) => (a.slice(0, 7) === b.slice(0, 7)
  ? `${Number(a.slice(8, 10))}–${fmtDay(b)}` : `${fmtDay(a)} – ${fmtDay(b)}`);
export const daysUntil = (d, today) => Math.round((ms(d) - ms(today)) / DAY);

// Every calendar item, sorted: meetings, communication windows, catalysts and
// the reader's own events.
export function buildCalendar(userEvents = []) {
  const items = [];
  for (const m of FOMC_MEETINGS) {
    // Listed on the decision day (the meeting's second day).
    items.push({ date: m.end, type: "fed",
      label: m.noDecision ? `FOMC ${fmtRange(m.start, m.end)} — strategy discussion only, no decision`
        : `FOMC decision${m.sep ? " + projections (dots)" : ""} · meeting ${fmtRange(m.start, m.end)}`,
      note: m.note });
    if (!m.noDecision) {
      const b = fedBlackout(m);
      items.push({ date: b.start, type: "fed", label: `Fed blackout begins (to ${fmtDay(b.end)})`, minor: true });
    }
  }
  for (const m of ECB_MEETINGS) {
    items.push({ date: m.date, type: "ecb", label: `ECB decision${m.proj ? " + staff projections" : ""}`, note: m.note });
    const q = ecbQuiet(m);
    items.push({ date: q.start, type: "ecb", label: "ECB quiet period begins", minor: true, approx: true });
  }
  items.push(...MACRO_EVENTS);
  items.push(...userEvents.map(e => ({ ...e, type: "mine", mine: true })));
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
