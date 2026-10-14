# Economy: markets and paper trading

Economy is a private, per-account workspace in Vault's top navigation. It is a paper-trading experiment, not a brokerage connection. No route places real orders, moves money, or accepts Nordnet/Binance trading credentials.

## Start here

1. Open **Economy → Setup** as a Vault administrator.
2. Create a Twelve Data API key and save it in the password field. Use **Test connection** to request an Apple quote. Confirm your subscription's exchange coverage, redistribution terms and delay before relying on it. Oslo coverage is plan-dependent; a listed symbol is not a promise of coverage.
3. Save an OpenAI API key, or use Vault's existing `openaiApiKey`/`OPENAI_API_KEY`. Each role has an editable model ID. The default is `gpt-4.1-mini`; all four may use the same model, so they are distinct roles, not independent model families. The connection test lists models and makes no generation call.
4. In **Markets**, search the provider's stock catalogue, inspect an instrument, and add it to your watchlist. Binance public BTC/USDT, ETH/USDT and SOL/USDT data requires no account key.
5. In **Sandbox**, create an experiment with a currency, starting paper cash, horizon, costs, limits and optional buy-and-hold benchmark. USD, NOK, EUR and USDT are separate balances; there is no implicit FX conversion.
6. Choose an instrument and run a four-agent discussion, or use the manual paper-order disclosure. Discussions run on request, not on an unattended schedule. The journal updates while a round runs. Export the experiment's evidence and ledger as JSON.

**Try a demo** uses a labelled fictional company and deterministic synthetic prices. Demo and real-market experiments cannot mix instruments. Demo results do not measure investing ability. Demo creation and manual fills require no provider key; actual agent discussions still require the OpenAI connection and incur model usage.

## Execution and limits

Every order is priced on the server from the selected data provider. Client-supplied prices are ignored. Buy fills add half the configured spread plus slippage; sells subtract them. Commission is a percentage of the resulting notional. Basis points are 1/100 of a percent. The ledger records the quote time, source, fill, fee, actor and linked decision round. Average cost includes purchase fees; sale proceeds deduct fees.

Orders require an open market and a valid quote no older than 2 minutes for day strategies or 20 minutes for long-term strategies. Provider timestamps are preserved and delay is disclosed; requesting a quote does not make an old quote fresh. A position mark older than 20 minutes prevents additional orders until refreshed. Closed-market quotes may be viewed but cannot produce fills. One order/round/valuation at a time per account prevents concurrent overspending. Reusing an order `clientId` returns the existing fill.

The server enforces cash sufficiency, quantity validity, currency/mode separation, maximum position percentage and daily order limits. After the configured daily loss threshold, new buys stop but sells remain possible. UTC daily loss uses the first recorded valuation that day (initial capital if absent), not an exchange open or continuous stop-loss. Pausing blocks fills, including a discussion already underway. There is no leverage, short selling, partial fill model, order book, corporate-action adjustment, dividend accrual or live stop-loss monitoring.

Portfolio values use last observed marks, with stale marks identified. The chart records observations, not a continuous backtest. Current drawdown is measured from the highest recorded portfolio value. The optional buy-and-hold comparison starts at its first successful quote, excludes fees/dividends/FX, and keeps the experiment's initial capital. Cash provides a zero-return baseline. These are approximate research comparisons, not risk-adjusted evidence of trading skill.

## Four-agent discussion

The Researcher describes the supplied quote and daily history without inventing news or fundamentals. The Strategist proposes a trade. The Critic challenges it. The Risk manager reviews the previous three messages and can reduce size or veto. Each role is a separate Responses API call with structured output. The complete supplied history, quote, role responses, model IDs, token counts and result are retained.

An order requires critic approval, risk approval, matching strategy/risk direction and a risk quantity no larger than the strategy proposal. A fresh execution check then applies the ordinary paper engine's rules. Invalid, refused, incomplete or failed model outputs never execute. Restarted unfinished rounds become `interrupted`, with no automatic retry. A completed fill and round outcome commit together. Agent confidence is self-reported, not calibrated probability.

There are no web-search, broker or filesystem tools in these agents. Only market evidence and this account's simulated portfolio are sent to OpenAI, with `store: false`. The default persisted allowance is 10 started rounds per account per UTC day (maximum configurable 50), including failures. A round makes up to four calls, each capped at 1,800 output tokens and a 90-second timeout. Set monetary limits in the provider dashboard as well. These bounds do not imply a fixed monetary price.

## Configuration and persistence

Provider settings are saved outside the public directory in `<storagePath>/.economy/settings.json`, written atomically with mode 0600 where supported. API responses contain only configuration flags and model IDs, never keys. Environment variables take precedence over saved settings, then `config.json`:

```json
{
  "twelveDataApiKey": "",
  "openaiApiKey": "",
  "economyModel": "gpt-4.1-mini",
  "economyDailyRounds": 10,
  "economyModels": {
    "researcher": "gpt-4.1-mini",
    "strategist": "gpt-4.1-mini",
    "critic": "gpt-4.1-mini",
    "risk": "gpt-4.1-mini"
  }
}
```

Supported environment variables: `TWELVE_DATA_API_KEY`, `OPENAI_API_KEY`. Blank fields in Setup preserve existing values. Restart after environment/config changes. Back up `.economy` privately; it contains keys, portfolios and research. It is gitignored. Do not expose it as a shareable shelf. Each user's data filename hashes the account name; access is enforced by the authenticated route, not by filename obscurity.

Market requests use fixed official HTTPS hosts, timeouts, a bounded cache (45 seconds for quotes, 5 minutes for history), and a per-process Twelve Data allowance of 8 requests/minute and 700/day shared across users. Provider limits may differ. There is no streaming feed. Displayed US/Norwegian instruments are starter references; provider search supplies the wider universe. Future broker adapters must be a separate deliberate project and must not turn these paper routes into real-order routes.

## External agents

Use Vault's existing API token with `Authorization: Bearer YOUR_VAULT_TOKEN`. It is account-scoped access to Vault, not a new Economy-only token; store it privately.

- `GET /api/economy`: configuration flags, watchlist, experiments, journals, role descriptions and starter instruments.
- `GET /api/economy/search?q=AAPL`: stock search.
- `POST /api/economy/market`: `{ "instrument": {"provider":"twelve","symbol":"AAPL","exchange":"NASDAQ","currency":"USD","name":"Apple"}, "history":true }`.
- `PUT /api/economy/watchlist`: `{ "instruments": [...] }`, up to 30.
- `POST /api/economy/experiments`: `{ "name":"US long-term", "mode":"paper", "currency":"USD", "initial":100000, "horizon":"long", "feeBps":10, "spreadBps":10, "slippageBps":5, "maxPositionPct":20, "maxDailyLossPct":3, "maxTradesPerDay":10, "benchmark":null }`.
- `POST /api/economy/experiments/:id/refresh`: `{}` updates valuations.
- `POST /api/economy/experiments/:id/rounds`: `{ "instrument": {...} }` starts a four-role round and returns 202. Poll the overview for status.
- `POST /api/economy/experiments/:id/orders`: `{ "instrument": {...}, "side":"buy", "quantity":2, "clientId":"unique-order-0001" }`. Retry with the same ID only for the same intended order.
- `PATCH /api/economy/experiments/:id`: `{ "paused":true }` (or false).
- `GET /api/economy/experiments/:id/export`: downloadable JSON.

The settings and connection-test endpoints require an administrator. Maximums: 20 experiments/account, 10,000 orders/experiment, 500 discussions/experiment and 3,000 retained valuation observations. There is intentionally no destructive reset button in the first version.

## Verification and sources

`node --test tests/economy.test.js` covers accounting, duplicate retries, exposure/cash/loss limits, quote freshness, currency separation, account isolation, key masking, sequential role context, vetoes, pause during execution and restart recovery. Tests mock provider responses; they do not claim live model validation or access to a paid stock plan. Run the complete `npm run check` and `npm test` before production promotion.

- [Twelve Data API reference](https://github.com/twelvedata/twelvedata-node/blob/master/api_reference.md)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Binance public market-data endpoints](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)
- [Nordnet access documentation](https://www.nordnet.no/externalapi/docs/getting_started)
