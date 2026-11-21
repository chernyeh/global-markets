# Global Markets

## Macro monitor (the ◈ Macro tab — the cover page)

Tracks the signals from the Bear-Market Playbook (rev 54, 20 Nov 2026): a signals board with the
playbook's thresholds, actions and "no action unless" guards; the four yield scenarios with your
weights; Fed and ECB rates, meetings, blackout/quiet periods and market-implied paths (with paste-in
boxes for your own source); rates, credit, FX and commodity tiles; a dated catalyst calendar; and
in-app alerts.

**Data** — one serverless function, `api/macro.js`, fetches every source:

| Source | What | Tier | Key |
|---|---|---|---|
| US Treasury | nominal and real par yield curves | PRIMARY | none |
| FRED (St. Louis Fed) | term premium, credit spreads, CPI/PCE, policy rates, fallbacks | PRIMARY | `FRED_API_KEY` |
| ECB Data Portal | deposit rate, €STR, monthly 10y yields (OAT–Bund, BTP–Bund) | PRIMARY | none |
| Bundesbank | daily Bund 10y | PRIMARY | none |
| Japan MoF | JGB yields | PRIMARY | none |
| Yahoo Finance | futures, FX, indices, ETFs | SECONDARY-reliable | none |
| Central Bank Watch | market-implied Fed/ECB meeting paths | SECONDARY-unverified | none |
| BLS | CPI items (core-services breadth), aggregates, PPI, average gasoline price | PRIMARY | `BLS_API_KEY` |
| Eurostat | euro-area and country HICP (ECOICOP ver.2, `prc_hicp_minr`) | PRIMARY | none |
| GIE AGSI+ | EU gas storage and its 5-year same-day average | PRIMARY | `GIE_API_KEY` (optional, higher limits) |
| FAO | Food Price Index and sub-indices | PRIMARY | none |
| Atlanta Fed Market Probability Tracker | SOFR-options distribution of the policy rate by 3-month window | PRIMARY (model) | none |
| Fed and ECB feeds; Google News | speeches, testimony, statements, interviews (incl. German, French, Italian, Spanish press) | PRIMARY / SECONDARY | none |

**Setup** — free keys, added in Vercel → this project → Settings → Environment Variables
(tick Production, Preview and Development), then Deployments → latest → ⋯ → Redeploy:

| Variable | Register at | Needed for |
|---|---|---|
| `FRED_API_KEY` | https://fredaccount.stlouisfed.org → My Account → API Keys | term premium, credit spreads, PCE, alternative cores, IMF commodities, fallbacks |
| `BLS_API_KEY` | https://data.bls.gov/registrationEngine/ (key arrives by email; click to activate) | CPI items and breadth, PPI, gasoline base effects — BLS refuses keyless calls from shared server IPs |
| `GIE_API_KEY` | https://agsi.gie.eu → register → key in your account profile | optional: higher rate limits for gas storage |

No BEA key is needed: PCE series come through FRED.

**Central-bank tracker and Macro read** use the app's existing `ANTHROPIC_KEY`. Every 30 minutes while the
page is open, new official and trusted-outlet items (at most 40 per run, normally a handful) are classified by
Haiku in batches of 10: relevance, speaker, stance −2..+2, a quote that must appear verbatim in the source,
and unanswered questions in interview transcripts. Evidence reads for signals 1, 6, 9 and 15 refresh every
6 hours and are never applied without your click. The Macro read is written on demand by the brief model
chosen in the header, from a digest of the page's own numbers.

Registry: `src/data/macroSeries.js` (indicators), `src/data/macroSignals.js` (signals, scenarios),
`src/data/macroCalendar.js` (meetings and catalysts), `src/data/macroInflation.js` (breadth items, print rows),
`src/data/macroSpeakers.js` (rosters, feeds, trusted outlets). Tracker: `src/macroSpeech.js`; Macro read: `src/macroRead.js`. Logic: `src/macroData.js`, `src/macroSignals.js`,
`src/macroAlerts.js`, `src/macroMonitor.js`. UI: `src/components/macro/`.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
