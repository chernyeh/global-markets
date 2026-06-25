// Shared briefing structure — actionable, ahead-of-consensus, organised around the
// signals that drive buy/trim/avoid decisions.
export const BRIEF_FORMAT = `## Bottom Line
[2-3 sentences: the most actionable, ahead-of-consensus reads right now. For each, state the implied action.]

## Changes in View — Analyst & Broker Actions
- [Upgrade/downgrade/price-target/estimate change: who, the direction, and the non-consensus angle. **Action:** accumulate/trim/watch/avoid. [REF:N]]

## Management Changes & Insider Signals
- [CEO/CFO/board change, strategy reset, turnaround, activist stake, director buying/selling: what it signals about the company's trajectory. **Action:** … [REF:N]]

## Management Interviews & Analyst Roundtables
- [Detailed executive interview or strategist/fund-manager roundtable: the key call and what is new or contrarian. **Action:** … [REF:N]]

## Strategic Shifts & Deep Dives
- [Business-model change, competitive dynamic, or feature that changes the long-term thesis. **Action:** … [REF:N]]

## Catalysts & Company Actions
- [Earnings surprise, M&A, dividend/buyback, contract win/loss, regulatory — only items that move the thesis. **Action:** … [REF:N]]

## Shifting Environment & Sentiment
- [ONLY macro/policy/geopolitics that represents a CHANGE — a new regime, an emerging or fading trend, or a shift in sentiment — and which sectors or groups of companies it helps or hurts. **Action:** … [REF:N]]`;

export const BRIEF_RULES = (effectivePriority) => `Rules:
- Lead with the most actionable, ahead-of-the-crowd items. Skip anything generic or already fully priced in.
- Every bullet ends with a concrete **Action:** (accumulate / trim / watch / avoid, or precisely what to watch) AND a [REF:N] citation.
- Be specific: name companies (ticker where known), the direction of the move, and magnitude when stated.
- Weight the strongest signals (▲▲ Strong Positive / ▽▽ Strong Negative) and the highest-value categories (analyst rating changes, management changes, insider buying/selling, activist stakes, management interviews, analyst roundtables, strategic shifts) most heavily.
- OMIT any section with no genuinely actionable content — do not pad with filler.
- Do NOT write generic macro narration. Macro belongs in "Shifting Environment & Sentiment" ONLY when it reflects a regime change, trend inflection, or sentiment shift with clear sector/company implications.
- ${effectivePriority}
- FACTUAL RULE: Use only what is in the headline, the analyst insight, and the description snippet provided (text after "::"). Do NOT invent figures, names, percentages, or details not present in that material.`;

export const WORLD_FORMAT = `## [Headline capturing the dominant global story right now]

[3-4 sentence big-picture summary: the dominant macro/geopolitical force shaping markets, the most significant development of the day, and the overall risk-on/risk-off tone.]

## Geopolitics & Conflicts
- [Iran (nuclear/sanctions/military), Ukraine war, Taiwan Strait tensions, Israel/Gaza/Middle East, US-China trade and military friction, Russia: what changed, who is affected, and the market or policy implication. [REF:N]]

## Oil, Energy & Inflation
- [OPEC decisions, supply disruptions, price moves, demand shifts — and the implication for inflation and central bank rate expectations. [REF:N]]

## AI & Tech Infrastructure
- [AI model launches, data-centre and chip buildout, AI regulation or policy changes, and what leading companies are doing — including in China and Hong Kong. [REF:N]]

## Elon Musk & His Companies
- [Tesla, SpaceX, xAI/Grok, Starlink, X, or DOGE-related developments — include only if there is genuinely new news. [REF:N]]

## Company Catalysts
- [Management changes, transformative product launches, earnings surprises, or M&A that materially shift a company's trajectory. [REF:N]]

## Other Global News
- [Significant developments from Bloomberg, WSJ, FT, Reuters, SCMP, NYT, Washington Post, Semafor, the Guardian, Globe and Mail, or Reuters Breakingviews that don't fit the above sections. [REF:N]]

## What to Watch
- [Upcoming catalysts, events, or risks over the next few days.]`;

export const WORLD_RULES = `Rules:
- PRIORITY ORDER: Lead with Geopolitics (Iran, Ukraine, Taiwan, Israel/ME, US-China, Russia), then Oil/Energy, then AI, then Elon Musk, then company catalysts, then other important global news.
- Source hierarchy: Bloomberg, WSJ, FT, Reuters (incl. Breakingviews), SCMP, NYT, Washington Post, Semafor, the Guardian, and Globe and Mail take precedence over regional or niche publications when covering the same event.
- De-prioritise news from Philippines, Nigeria, Malaysia, and India unless it carries clear global market impact.
- EXCLUDE sports, entertainment, and celebrity news entirely — even from tier-1 sources.
- OMIT any section with no genuine content — do not pad with filler.
- Each bullet is 1-2 sentences with real detail and a clear "why it matters", ending with [REF:N] (or [REF:N,M]).
- FACTUAL RULE: Use only what is in the headline and description snippet (text after "::"). Do NOT invent figures, names, percentages, or details not present.`;
