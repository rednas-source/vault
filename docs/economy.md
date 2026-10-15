# Economy: markets and investment experiments

Economy is an authenticated, per-account paper-trading workspace. No endpoint submits real orders or accepts Nordnet/Binance trading credentials.

## Getting started

1. In Economy → Setup, save Twelve Data and OpenAI keys. Existing keys are preserved. Choose a model for each role from its dropdown. Vault loads available model IDs from OpenAI and matches exact supported text-model IDs to the official Standard pricing table; audio, image, legacy and unpriced variants are excluded or disabled. Prices appear automatically. The default is not a claim of superior trading ability. Test connection checks credentials/model visibility, not actual decision quality.
2. Set data requests per minute/day to your provider plan, and a model-review daily cap. Defaults are 8/minute, 700/day and 24 reviews/account/day (an older config can retain its existing cap). Raising local limits does not purchase provider access.
3. Markets browses the provider's complete supported stock catalogue with country/exchange/currency filters, search and 25-row pagination. The catalogue is cached for one day. Unsupported symbol formats are omitted. Listing is not proof that your plan includes the quote. Watchlists support 200 instruments. Quotes load on selection or Refresh first 4; there is no whole-market live stream.
4. Price charts support 5-minute intraday history and daily one-month, three-month, one-year and five-year ranges. Provider availability governs history; Binance daily history is limited to 1,000 observations. The latest candle may still be open. Public BTC/ETH/SOL USDT data requires no account key.
5. Create an experiment with currency, paper capital, horizon, transaction costs, position/daily-loss/order limits and a benchmark. USD/NOK/EUR/USDT stay separate; no automatic FX conversion occurs.
6. In its run settings choose watchlist or catalogue, exchange/country scope, new candidates per review (1–20), interval (5–10,080 minutes), duration (1–8,760 hours), AI USD budget and allocated total market-data subscription cost. Long-term defaults: daily for 30 days. Intraday defaults: every 15 minutes for four hours. These are configurable test defaults, not financial advice.
7. Saving captures Setup's model selections for that experiment. Other experiments retain their own selections. Change Setup then save an experiment's run settings to apply new models. Rates are refreshed automatically before a review when due; each response records its own rate and pricing timestamp, so history is never repriced. The on-screen cost example assumes 10,000 input and 1,000 output tokens per call; it is explicitly illustrative, not a measured bill.
8. Start the timed experiment, or save settings and run one review manually. Stop also pauses the experiment and prevents an in-flight paper fill. Resume/save before continuing. Export results as JSON.

Synthetic demo prices remain separate from real-market experiments. Demo/manual trading needs no API key, but actual model discussions are billed. No paid model session is started merely by deploying this feature.

## Four simultaneous agents

Critic challenges evidence/downside; Opportunist seeks opportunities; Realist tests feasibility/cost/risk; Professional compares timing, exits and alternatives. All four initial calls start concurrently with identical evidence. All four debate calls then see every initial opinion and cast final votes. Each selects an instrument, buy/sell/hold, share quantity, rationale, risks and exit/invalidation plan. At least three matching instrument/action approvals including Critic and Realist are required. Quantity is the smallest supporter quantity. Server risk checks still apply. At most one paper order is filled per review.

The universe is a rolling deterministic scan, not a claim to review every global stock at once. Each cycle includes existing holdings plus the next batch; the UI records universe size, candidate visits and cursor. Agents receive actual quote/history evidence for that batch plus recent decisions and portfolio/rules. Long-term uses up to one year of daily history; day strategies use five-minute candles. Unavailable instruments and failed requests are logged. If no fresh open-market candidates exist, the cycle holds without model calls. Source evidence and all messages are preserved. There is no invented news, fundamental-data access or live broker tool. Exit plans guide future reviews; they are not exchange stop orders.

## Schedule, persistence and costs

A server timer checks active schedules every 30 seconds. It runs while the browser is closed, provided Vault remains online. Active schedules persist across restarts; missed intervals are not replayed. One decision/order/valuation per account prevents concurrent overspending. An unfinished round becomes interrupted after restart and never resumes its partial trade. Session duration, pause, market freshness, round limits and order limits are checked before execution. Each new cycle is scheduled after the previous finishes, so provider throttling can lengthen intervals.

The estimate uses each recorded response's input/output tokens, reported cache reads/writes, and the Standard short/long-context rate at that review. Missing cache-write counts use the higher input rate conservatively. Requests explicitly select default processing, excluding Fast/Batch/Flex pricing. These estimates exclude tax, negotiated discounts and non-default regional uplifts. Before eight model calls, a conservative maximum reservation covers supplied context, debate overhead and output caps. Missing/stale verified rates, unavailable models or insufficient budget block all model calls. A complete round settles its reservation to recorded estimated usage. Failures/interrupted rounds keep the full reservation and flag unknown cost; net profit remains unavailable rather than treating it as zero. These are local estimates, not provider invoices or a guaranteed provider-side spending cap. Configure spending limits in the provider account too.

Analytics includes trading P&L, realized/unrealized results, fees, AI cost, allocated subscription cost, net return, benchmark comparison, maximum observed drawdown, exposure, sell-fill win rate, outcomes, tokens, daily history and cross-experiment comparison. For currencies other than USD, enter an explicit USD conversion rate for cost accounting. Subscription allocation is manually updated as charges accrue. Compare manual and AI experiments over matching dates/currency/capital; different horizons are not automatically comparable.

Paper fills add/subtract configured half-spread plus slippage and deduct commission. Only open markets with quotes under two minutes (day) or twenty minutes (long) can fill. All held marks must be fresh. There is no leverage, shorting, tax, dividend/corporate-action adjustment, order-book liquidity or partial-fill simulation. Results therefore do not establish real execution performance. UTC daily loss compares with the first observed valuation that day, not a continuously monitored exchange-open stop.

State lives privately in storagePath/.economy with atomic writes and mode 0600 where supported, excluded from Git and public file routes. Back it up privately. Caps: 20 experiments/account, 10,000 orders and 10,000 council reviews/experiment, 3,000 recent intraday observations plus persistent daily closing observations. Export and create a new experiment at record limits. Each role has a 90-second timeout and 1,800-output-token cap. Model evidence and simulated portfolio are sent to OpenAI with store:false; no private Vault files are sent.

## Automatic model prices

The server fetches https://api.openai.com/v1/models using the configured key (cached one hour). It separately fetches https://developers.openai.com/api/docs/pricing.md without credentials (cached 24 hours, persisted privately in .economy/model-pricing.json). Setup loads these automatically and offers Refresh models & prices. Forced refreshes are limited to once per minute. Prices are parsed by labelled Standard table columns; changed/ambiguous tables fail closed. No browser-supplied prices or guessed snapshot/alias rates are used. Historical manual rates remain only in past response records.

A lookup failure shows its last-checked time/error; stale prices block new model calls. A fresh cached catalogue can remain usable during a temporary refresh failure. Listing a model does not prove generation permission or sufficient account credit; provider rejection remains visible in the journal. No billed completion is used to populate the dropdown.

## API

Existing Vault bearer tokens retain their full account scope; they are not Economy-only tokens. All routes require authentication; provider settings require admin.

- GET /api/economy — overview, configuration flags, summaries, analytics, schedules and journals; never keys.
- GET /api/economy/catalogue?q=&exchange=&country=&currency=&page=0 — filtered catalogue.
- GET /api/economy/models?refresh=1 — admin-only model choices, automatic rates and freshness; omit refresh for cached lookup.
- GET /api/economy/search?q=AAPL — provider search compatibility endpoint.
- POST /api/economy/market — {instrument,history:true,range:'day'|'1m'|'3m'|'1y'|'5y'}.
- PUT /api/economy/watchlist — {instruments:[...]}.
- POST /api/economy/experiments — name, mode paper/demo, currency, initial, horizon day/long, feeBps, spreadBps, slippageBps, maxPositionPct, maxDailyLossPct, maxTradesPerDay, benchmark.
- PUT /api/economy/experiments/:id/research — enabled, source watchlist/catalogue, exchange, country, batchSize, intervalMinutes, durationHours, budgetUSD, dataCostUSD, usdRate. {enabled:false} alone stops/pauses without changing configuration.
- POST /api/economy/experiments/:id/council — starts a budgeted review (202). /rounds is a compatibility alias for this same implementation; there is no unmetered legacy path.
- POST /api/economy/experiments/:id/orders — {instrument,side,quantity,clientId}; server prices only, retry same clientId safely.
- POST /api/economy/experiments/:id/refresh — refresh marks.
- PATCH /api/economy/experiments/:id — {paused:true|false}; pausing disables its schedule.
- GET /api/economy/experiments/:id/export — complete JSON evidence/ledger and analytics.

Environment TWELVE_DATA_API_KEY / OPENAI_API_KEY override saved keys, then config.json keys. Blank Setup fields preserve keys. Model defaults come from economyModels/economyModel (default gpt-4.1-mini); daily cap from economyDailyRounds. Market/model settings are persisted separately from experiment snapshots.

## Verification and sources

Tests use fixture providers to verify parallel reviews, debate, consensus, budget refusal, stop, expiration, recovery, accounting, intraday timestamps, catalogue caching, authentication and net-cost truth. They do not claim real-model profitability or paid exchange coverage. Run npm run check and npm test before promotion.

- [Catalogue discovery](https://support.twelvedata.com/en/articles/5620513-how-to-find-all-available-symbols-at-twelve-data)
- [Provider credits](https://support.twelvedata.com/en/articles/5615854-credits)
- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Model pricing](https://developers.openai.com/api/docs/pricing)
- [Public Binance data](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)

## Sol experiment presets

Sandbox → Sol tests → Prepare Sol tests creates (or reuses) a four-hour test with 15-minute reviews and a $20 AI cap, plus a 30-day test with daily reviews and a $10 AI cap. The short test can instead be one hour. Each uses $100,000 simulated USD, all four roles pinned to gpt-6.1-sol, and SPY buy-and-hold. The initial fixed universe is AAPL, MSFT, NVDA, AMZN and GOOGL: two rotating candidates plus holdings per review. It is a focused starting experiment, not a whole-market scan. Custom experiments still support the provider catalogue.

POST /api/economy/experiment-presets with {"shortHours":4} prepares only: it does not call providers, start a timer or spend API funds. Repeated preparation preserves existing tests and spend. Use the normal research start endpoint for each experiment. Preset schedules run weekdays 09:35–15:50 America/New_York; quotes still validate actual market opening, holidays and freshness. Short starts require a fresh open-market quote; duration is elapsed wall-clock time. Daily presets wait for the next eligible window and retry closed-market evidence after 15 minutes without model calls. These tests require the Vault server to stay online.

Reasoning models receive a 6,000-token output allowance including reasoning; Sol explicitly uses low effort and other models keep their own default; reservations include that maximum before any call. Incomplete/failed rounds retain conservative reservations. The cap is locally enforced against these estimates, not an OpenAI invoice guarantee. Stop never clears accounted spend. Analytics includes net percentage-point return above buy-and-hold after recorded AI and allocated data costs; unknown costs hide net comparisons. Benchmarks exclude dividends, taxes and corporate actions.
