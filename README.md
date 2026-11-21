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

**Setup** — add the free FRED key in Vercel:
1. Register at https://fredaccount.stlouisfed.org → My Account → API Keys → Request API Key.
2. Vercel → this project → Settings → Environment Variables → add `FRED_API_KEY` (Production, Preview, Development).
3. Deployments → latest → ⋯ → Redeploy.

Registry: `src/data/macroSeries.js` (indicators), `src/data/macroSignals.js` (signals, scenarios),
`src/data/macroCalendar.js` (meetings and catalysts). Logic: `src/macroData.js`, `src/macroSignals.js`,
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
