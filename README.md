# Global Markets

## Macro monitor (the ◈ Macro tab — the cover page)

Tracks the signals from the Bear-Market Playbook (rev 54, 20 Nov 2026): a signals board with the
playbook's thresholds, actions and "no action unless" guards; the four yield scenarios with your
weights; Fed and ECB rates, meetings, blackout/quiet periods and market-implied paths (with paste-in
boxes for your own source); rates, credit, FX and commodity tiles (incl. China steel and iron-ore
futures); a dated catalyst calendar with Rule-10 checks on data releases; in-app alerts; Telegram push
alerts from a scheduled server check; and a decision log.

**Data** — one serverless function, `api/macro.js`, fetches every source:

| Source | What | Tier | Key |
|---|---|---|---|
| US Treasury | nominal and real par yield curves | PRIMARY | none |
| FRED (St. Louis Fed) | term premium, credit spreads, CPI/PCE, policy rates, fallbacks | PRIMARY | `FRED_API_KEY` |
| ECB Data Portal | deposit rate, €STR, monthly 10y yields (OAT–Bund, BTP–Bund) | PRIMARY | none |
| Bundesbank | daily Bund 10y | PRIMARY | none |
| Japan MoF | JGB yields | PRIMARY | none |
| Yahoo Finance | futures, FX, indices, ETFs (batched 20 symbols a request; see below) | SECONDARY-reliable | none |
| Sina Finance (global futures, US stocks) | fallbacks for Yahoo: COMEX/NYMEX/ICE/CBOT/LME futures; S&P 500, Nasdaq, HYG, ORCL, CRWV, RSP/SPY, MP, REMX | SECONDARY-unverified | none |
| ECB reference rates | fallback for every FX row, the SGD crosses, and DXY rebuilt with ICE's formula | PRIMARY | none |
| BIS (WS_CBPOL) | policy rates of the lead central banks | PRIMARY | none |
| Central Bank Watch | market-implied Fed/ECB/BoJ meeting paths; BoE, RBA, RBNZ, SNB pricing for the lead-banks card | SECONDARY-unverified | none |
| BLS | CPI items (core-services breadth), aggregates, PPI, average gasoline price | PRIMARY | `BLS_API_KEY` |
| Eurostat | euro-area and country HICP (ECOICOP ver.2, `prc_hicp_minr`) | PRIMARY | none |
| GIE AGSI+ | EU gas storage and its 5-year same-day average | PRIMARY | `GIE_API_KEY` (optional, higher limits) |
| FAO | Food Price Index and sub-indices | PRIMARY | none |
| Sina Finance | SHFE rebar and HRC, DCE iron ore and coking coal (main contracts, daily) | SECONDARY-unverified | none |
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

**Reading the page** — the header's *Bottom line* answers six questions from the page's own numbers (no
model involved, `src/macroSummary.js`); the AI read is optional and folded. Every row name, card title and
small-caps label has a hover (tap on a phone) explanation from `src/data/macroGlossary.js`, so the page
itself carries little explanatory text. The signals board is titled *Playbook triggers*: each column is a
question (has the yield peak arrived? can yields go higher? add risk? cut risk? market bottom?) with its
met-count and the action it unlocks.

**Why Yahoo tiles went blank (fixed 23 Nov 2026)** — Yahoo throttles per IP *and* User-Agent. The adapter sent a stock
Chrome User-Agent from Vercel's shared AWS IPs, one request per symbol: tested from the build sandbox, the Chrome string
got HTTP 429 while the app's own User-Agent got 200 in the same second. It now identifies itself as the app, asks for 20
symbols per request (≈4 requests a refresh), retries once, and stops for the run if Yahoo still refuses. Every Yahoo tile
except TTF, API2 coal, US HRC, rice, sugar, cattle, Lynas, China Northern RE, MOVE, Russell 2000 and SGD/TWD also has a
non-Yahoo fallback (*). A source wins only with a usable history (≥20 daily points), and a daily series with no new
observation in 21 days is marked *stale* (Yahoo's API2 coal ticker last traded 26 Dec 2025).

**FX** — the SGD crosses (SGD/USD, EUR, GBP, JPY, CNY, HKD, AUD, MYR, THB, IDR, PHP, INR, KRW, TWD; units per 1 SGD) and the
Asia oil importers sit behind their own buttons on the FX card.

**Lead central banks** — under the Fed/ECB/BoJ cards: BCB, RBNZ, BoC, BoE, MAS and RBA, plus Norges Bank, Riksbank, SNB
and Bank of Korea. Each row: policy rate and last move (BIS), moves in 12 months, the next priced meeting and total bp
priced (Central Bank Watch, BoE/RBA/RBNZ/SNB only), and the currency's month against USD. A row opens to why the bank has
led past cycles (dated precedents) and its latest headlines (Google News, local language where its press is, filtered for
relevance). Flags: a *turn* (first hike after cuts or the reverse, ≤120 days old), a move after ≥9 months on hold, a
hiking/cutting *cluster* (≥3 banks in 90 days), lead banks *diverging* from Fed pricing, and a ≥5% monthly currency move.
New moves and clusters raise alerts (pushed to Telegram from the server check); the bottom line and the Macro read carry a
one-line summary. Logic: `src/macroLeadBanks.js`; registry: `src/data/macroLeadBanks.js`. The BIS response format could
not be checked from the build sandbox (its network blocks stats.bis.org): the parser reads the SDMX-CSV standard columns
and, if BIS answers in another shape, Source health shows the error and the card falls back to Central Bank Watch rates.

**Central banks** — Fed, ECB and Bank of Japan cards: policy rate, next decision (BoJ dates from boj.or.jp,
PRIMARY), the market-implied path (Central Bank Watch; BoJ rows matched to the BoJ's published dates), and
how pricing has moved over 1 week, 3 and 6 months — SOFR options (Atlanta Fed) for the Fed, the ECB's AAA
yield-curve forwards for the ECB, JGB 2y/10y (MoF) for the BoJ. The speaker tracker covers the BoJ Policy
Board from the BoJ's feed plus Japanese and English press.

**Push alerts and sync (Phase 4)** — a scheduled server check (`api/alerts.js`) runs the same signal and
alert engine as the browser, adds new FOMC statements and minutes and ECB decisions from the banks' own
feeds, and reminds you once a day of deferred decisions that fall due. It stores state in Supabase
(Gloomberg project, tables `gm_kv`, `gm_alerts`, `gm_decisions`, row-level security on with no policies,
so only the server's secret key can read them) and pushes to Telegram. Schedule: GitHub Actions hourly on
weekdays and every 6 hours at weekends (`.github/workflows/macro-alerts.yml`), plus Vercel Cron once a day
at 22:17 UTC (`vercel.json`; the Hobby plan allows one a day). With the app key entered in the Macro tab's
Setup panel, your paste-ins, hand-set signals, scenario weights, events and release consensus sync to
Supabase so the server check uses them (`api/store.js`, `src/macroSync.js`).

| Variable (Vercel) | Value | Needed for |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Gloomberg → Project Settings → API Keys → secret key (`sb_secret_…`) | server state, sync, decision log |
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/newbot` → token | push alerts |
| `CRON_SECRET` | any long random string (also a GitHub repository secret) | lets only the scheduler call `/api/alerts` |
| `GM_APP_KEY` | a passphrase you choose; type it once into Setup on each device | reading and writing your data |
| `APP_URL` | optional: the production address, for the link in Telegram messages | — |

GitHub repository secrets (Settings → Secrets and variables → Actions): `CRON_SECRET` (same value) and
`MONITOR_URL` (the production address). Without them the workflow skips quietly.

**Rule 10 on releases** — paste the consensus on the calendar's CPI / PCE / PPI / euro flash rows ("0.3" or
"0.3 Koyfin"). After the print, the monitor compares actual vs consensus and the same-day reaction (S&P 500
and 2y/10y for US prints, Bund 10y for euro prints): good news that fails to lift prices is a red flag
(signal 17); bad news that does not hurt is noted as a bottom-type marker.

**Decision log** — on any ACT or WATCH alert, log acted / deferred (review date and what you are waiting
for, required) / no action. Open deferrals show in the inbox; due ones get a banner and a Telegram
reminder; a signal deferred twice is flagged.

Registry: `src/data/macroSeries.js` (indicators), `src/data/macroSignals.js` (signals, scenarios),
`src/data/macroCalendar.js` (meetings and catalysts), `src/data/macroInflation.js` (breadth items, print rows),
`src/data/macroSpeakers.js` (rosters, feeds, trusted outlets), `src/data/macroLeadBanks.js` (lead central banks). Tracker: `src/macroSpeech.js`; Macro read: `src/macroRead.js`. Logic: `src/macroData.js`, `src/macroSignals.js`,
`src/macroAlerts.js`, `src/macroRule10.js`, `src/macroSync.js`, `src/macroMonitor.js`. Server: `api/macro.js`,
`api/alerts.js`, `api/store.js`, `api/_supabase.js`, `api/_telegram.js`. UI: `src/components/macro/`.

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
