// ═══════════════════════════════════════════════════════════════════════════════
// MACRO MONITOR — playbook signals and scenarios
// ═══════════════════════════════════════════════════════════════════════════════
// Source: "Bear-Market Playbook: 1973–2026" (rev 54, 20 Nov 2026) — sections
// "What bond yields are pricing", "Signals that would justify adding risk" and
// the PM bias check — and the 19 Nov 2026 oil, inflation and rates note.
// Thresholds marked * in the playbook are illustrative; they are editable here
// and are labelled as such on the board.
//
// Each signal:
//   n, group        number on the board; which column it sits in
//   label           the playbook's wording, shortened
//   threshold       what "met" means, in words (shown on the board)
//   auto            true → evaluated from data each refresh (src/macroSignals.js);
//                   false → you set it; `phase` says when automation arrives
//   supports        scenarios it is evidence FOR when met; contradicts: AGAINST
//   action          what the playbook says to do when it is met
//   guard           "no action unless…" — the check that stops a single print or
//                   headline from triggering a trade (trading-too-often guard)

export const SCENARIOS = [
  { id: "disinf", label: "Disinflation on schedule", short: "Disinflation", weight: 40,
    path: "Core ≤0.2% m/m by Feb; last hike Jan–Mar; the 7 Oct high (5.36%) holds; ≈4.5–4.75% by mid-2027." },
  { id: "sticky", label: "Sticky core + more supply", short: "Sticky + supply", weight: 30,
    path: "Core ≥0.3% m/m; coupon increases in Feb or May; new 10y high in Q1–Q2 2027." },
  { id: "credit", label: "Credit accident", short: "Credit accident", weight: 20,
    path: "AI-debt stress spreads to banks or hyperscalers; abrupt yield peak, 2y falls faster than 10y; stocks keep falling." },
  { id: "fiscal", label: "Fiscal dominance", short: "Fiscal dominance", weight: 10,
    path: "Fed eases under pressure with core unbeaten; breakevens and term premium rise; gold, TIPS, real assets win." },
];

export const SIGNAL_GROUPS = [
  { id: "peak",    label: "PEAK CONFIRMED", color: "#1b7a3e", blurb: "the 10y peak is in; disinflation on schedule" },
  { id: "notin",   label: "PEAK NOT IN",    color: "#c0392b", blurb: "yields can make new highs" },
  { id: "risk",    label: "ADD RISK",       color: "#1b7a3e", blurb: "conditions the playbook names for adding risk" },
  { id: "defence", label: "MORE DEFENCE",   color: "#c0392b", blurb: "conditions for cutting risk further" },
  { id: "bottom",  label: "BOTTOM MARKERS", color: "#8a6a20", blurb: "what marked real lows vs false dawns" },
];

export const SIGNALS = [
  // ── Peak confirmed ───────────────────────────────────────────────────────
  { id: "s1", n: 1, group: "peak", label: "Fed signals it is done", auto: false, phase: 3,
    threshold: "Statement or presser says hikes are over; dots median = current rate",
    supports: ["disinf"], src: "FOMC statement & SEP (PRIMARY) — next: 9 Dec",
    action: "Peak-confirmed signal: add nominal duration in thirds; rate-sensitives (homebuilders, REITs, airlines) become turn-signal trades.",
    guard: "Only with inflation expectations anchored (10y breakeven < 2.5%) — not merely a first cut, which was a false dawn in 2001 and 2007." },
  { id: "s2", n: 2, group: "peak", label: "Core CPI ≤0.2% m/m, twice", auto: true,
    threshold: "Two consecutive core CPI prints at ≤0.2% m/m (published, 1dp)",
    supports: ["disinf"], contradicts: ["sticky"], src: "BLS via FRED (CPILFESL)",
    action: "The trigger the playbook names for the yield peak: add the first third of nominal duration.",
    guard: "Check core-services breadth (signal 4) — one soft print alone is not the trigger." },
  { id: "s3", n: 3, group: "peak", label: "Core PCE falling three months", auto: true,
    threshold: "3-month annualised core PCE lower in each of the last three months (my reading of the playbook's wording)",
    supports: ["disinf"], src: "BEA via FRED (PCEPILFE)",
    action: "With signal 1, this is the single fact that moves the stance to the 2002–03 shopping list (financials, EM, HY, best-hit cyclicals).",
    guard: "Needs signal 1 as well — falling core PCE while the Fed keeps hiking is the Aug 2022 false dawn." },
  { id: "s4", n: 4, group: "peak", label: "Core-services breadth narrowing", auto: true,
    threshold: "Share of core services above 3% (by weight, 3m annualised, SA) below 50%* and lower than three months earlier; partly met if it fell ≥5pp in a month or is below 60%*",
    supports: ["disinf"], contradicts: ["sticky"], src: "BLS CPI item indices (PRIMARY); weights from the 19 Nov note",
    action: "Waller's case for more hikes weakens; supports a last hike in Q1 2027.",
    guard: "Separate fading items (education, lodging) and fuel-linked ones (airfares) from the sticky ones (OER, hospital, dental, repair)." },
  { id: "s5", n: 5, group: "peak", label: "Term premium below ≈0.8%*", auto: true,
    threshold: "Fed Board (Kim-Wright) 10y term premium < 0.80%",
    supports: ["disinf"], contradicts: ["sticky", "fiscal"], src: "Federal Reserve Board via FRED (THREEFYTP10)",
    action: "Supply and fiscal premium easing: extend duration from the front end.",
    guard: "Model estimate published with a lag; confirm against the NY Fed (ACM) model before acting." },
  { id: "s6", n: 6, group: "peak", label: "Refunding holds coupon sizes", auto: false, phase: 3,
    threshold: "Treasury keeps coupon auction sizes unchanged at the Feb 2027 refunding",
    supports: ["disinf"], contradicts: ["sticky"], src: "Treasury refunding statement (PRIMARY) — ≈3 Feb 2027",
    action: "Supply leg of the peak case confirmed. Larger coupons (dealers pencil in Feb or May) would instead lift the term premium.",
    guard: "A tilt to bills and bigger buybacks also caps the term premium — read the whole statement." },

  // ── Peak not in ──────────────────────────────────────────────────────────
  { id: "s10", n: 10, group: "notin", label: "10y breakeven above 2.5%", auto: true,
    threshold: "Nominal minus real 10y par yield > 2.50%",
    supports: ["fiscal"], contradicts: ["disinf"], src: "US Treasury par curves",
    action: "Credibility slipping: favour TIPS, gold and real assets; avoid long nominal bonds.",
    guard: "Oil spikes lift breakevens briefly — need it to hold, not a one-day print." },
  { id: "s11", n: 11, group: "notin", label: "Real 10y through the 3.15% record", auto: true,
    threshold: "10y TIPS par yield > 3.15% (Nov 2008 record)",
    supports: ["sticky"], src: "US Treasury real par curve",
    action: "Real yields at a post-2008 record: lock the TIPS real yield; long-duration equities de-rate further.",
    guard: "TIPS lock the real yield without calling the peak — no need to wait for this." },
  { id: "s12", n: 12, group: "notin", label: "10y above the 5.36% high", auto: true,
    threshold: "10y close > 5.36% (7 Oct intraday high; compared on closes)",
    supports: ["sticky"], contradicts: ["disinf"], src: "US Treasury par curve",
    action: "Sticky-core scenario gaining: value, energy and T-bills hold up; hold off nominal duration.",
    guard: "Peaks after the last hike came 1–3 months later in 1981 and 2023 — check where the last hike sits." },

  // ── Add risk ─────────────────────────────────────────────────────────────
  { id: "s7", n: 7, group: "risk", label: "Brent holds below ≈$90*, curve easing", auto: true,
    threshold: "5+ sessions below $90 and the M1–M6 backwardation narrower than a month ago",
    supports: ["disinf"], src: "Brent futures (Yahoo) / Brent spot (FRED)",
    action: "Helps oil users (airlines, chemicals, consumers) and headline CPI; use pre-set trim levels on energy.",
    guard: "The Hormuz binary is still open — energy can lose a year's gain in a week (June 2026)." },
  { id: "s8", n: 8, group: "risk", label: "OAT–Bund below ≈100bp*", auto: true,
    threshold: "French–German 10y spread < 100bp (daily paste-in overrides the monthly series)",
    src: "ECB monthly 10y yields; your daily paste-in",
    action: "France stress fading: French duration and France-heavy financials come back into scope.",
    guard: "A credible 2027 budget or an ECB signal should accompany it — spread compression on thin news fades." },
  { id: "s9", n: 9, group: "risk", label: "US–China truce made durable", auto: false, phase: 3,
    threshold: "Truce extended beyond 10 Jan 2027; rare-earth controls not reactivated",
    src: "USTR / MOFCOM (PRIMARY, Chinese-language for MOFCOM)",
    preset: "China's suspension of rare-earth controls lapsed 10 Nov 2026 — outcome not re-checked in the playbook",
    action: "Lowers China-as-supplier risk across holdings. Reactivated controls instead argue for more defence in autos, electronics and defence supply chains.",
    guard: "Measure China exposure across every holding (customer, supplier, competitor, asset) before acting on a headline." },
  { id: "s18", n: 18, group: "risk", label: "Risk-off USD spike vs SGD", auto: true,
    threshold: "USD/SGD up ≥2.0% in 10 sessions* (≥1.0% = partial)",
    src: "USD/SGD (Yahoo / FRED H.10)",
    action: "Deploy USD dry powder into US assets then, rather than converting it back to SGD.",
    guard: "The SGD has been the strong currency in inflationary regimes — a spike is the entry, not a new trend." },

  // ── More defence ─────────────────────────────────────────────────────────
  { id: "s13", n: 13, group: "defence", label: "Credit stress spreading", auto: true,
    threshold: "IG OAS +20bp* and HY OAS +50bp* in a month (either = partial). Proxy for AI-debt stress reaching hyperscalers and banks",
    supports: ["credit"], src: "ICE BofA OAS via FRED",
    action: "2007 template — credit cracks first: cut leveraged and AI-debt exposure; build the distressed shopping list.",
    guard: "CoreWeave bond and CDS quotes have no free feed; confirm with news (bonds > 16%, CDS > 1,000bp on 6 Nov)." },
  { id: "s14", n: 14, group: "defence", label: "2y falls faster than 10y, abruptly", auto: true,
    threshold: "2y −20bp* in 5 sessions with the curve steepening ≥10bp (−10bp = partial)",
    supports: ["credit"], src: "US Treasury par curve",
    action: "Credit-accident signature: yields peak abruptly, but equities may keep falling (2000, 2007).",
    guard: "A soft CPI also drops the 2y — check credit spreads (signal 13) before reading it as an accident." },
  { id: "s15", n: 15, group: "defence", label: "Hyperscaler capex cut, revisions negative", auto: false, phase: 3,
    threshold: "Q4 calls (late Jan–Feb 2027) cut 2027 capex vs ≈$935bn consensus",
    supports: ["credit"], src: "Company calls and filings (PRIMARY)",
    action: "Negative for AI hardware and Korea/Taiwan-heavy EM first; potentially positive for the broad market via lower yields.",
    guard: "Rule 10 applies: a beat-and-raise that fails to lift the shares is the earlier warning." },
  { id: "s8b", n: "8b", group: "defence", label: "OAT–Bund above ≈200bp*, no ECB response", auto: true,
    threshold: "Spread > 200bp (> 175bp = partial); the ECB response part is your call",
    supports: ["fiscal"], src: "ECB monthly 10y yields; your daily paste-in",
    action: "Stay light French duration and France-heavy financials until the ECB signals a backstop (TPI) or a budget passes.",
    guard: "After Jul 2012 the most-hated assets led for two years — keep the list for after the backstop." },

  // ── Bottom markers ───────────────────────────────────────────────────────
  { id: "s16", n: 16, group: "bottom", label: "Capitulation: credit leads, breadth turns", auto: true,
    threshold: "HY OAS gapped ≥100bp off its 3m low, then ≥10% off its peak; equal-weight beating cap-weight over 1m",
    supports: [], src: "ICE BofA via FRED; RSP/SPY; VIX",
    action: "Deploy the next tranche of the shopping list (financials, EM, high yield, best-hit cyclicals) once credit leads.",
    guard: "Two-thirds of post-war bears made lower lows after a double-digit rebound — tranche in, don't go all at once." },
  { id: "s17", n: 17, group: "bottom", label: "Rule 10: good news fails to lift", auto: false, phase: 4,
    threshold: "A benign print or beat, and bonds/equities do not rally",
    src: "Release calendar + market reaction — Phase 4",
    action: "Red flag: sector over-owned or good news already priced.",
    guard: "Needs a clean surprise vs consensus — paste consensus from your own source." },
];

export const SIGNAL_MAP = Object.fromEntries(SIGNALS.map(s => [s.id, s]));
