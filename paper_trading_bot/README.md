# Paper-trading bot

Trades a simple moving-average (SMA) crossover strategy fully automatically,
but only against **Binance's spot testnet** (https://testnet.binance.vision) -
a real, live order book funded with fake test money. No real money is ever at
risk, and this code never talks to the production Binance API.

- **buy** when the short SMA crosses above the long SMA (golden cross)
- **sell** when the short SMA crosses below the long SMA (death cross)
- otherwise it holds

It tracks one position at a time (flat or long) in `state.json` and appends
every signal it acts on to `trades.csv`, both gitignored so your local runs
don't get committed.

## Setup

1. Get free testnet API keys (log in with GitHub, no real account needed):
   https://testnet.binance.vision/
2. From the repo root:

   ```bash
   pip install -r requirements.txt
   cp .env.example .env
   # then fill in BINANCE_TESTNET_API_KEY / BINANCE_TESTNET_API_SECRET
   ```

3. Try it with no keys at all first, in dry-run mode (fetches real testnet
   prices, logs what it *would* trade, places no orders):

   ```bash
   python3 paper_trading_bot/bot.py --once --dry-run
   ```

4. Check the strategy math with no network at all:

   ```bash
   python3 paper_trading_bot/bot.py --self-test
   ```

## Running it

```bash
# One check, then exit
python3 paper_trading_bot/bot.py --once

# Loop forever, checking every BOT_LOOP_INTERVAL_SECONDS (default 60s)
python3 paper_trading_bot/bot.py

# Different market / windows / position size
python3 paper_trading_bot/bot.py --symbol ETHUSDT --short-window 10 --long-window 30 --trade-quote-qty 25

# Log-only, never place an order, even with keys set
python3 paper_trading_bot/bot.py --dry-run
```

Or use the wrapper from the repo root, which sources `.env` for you:

```bash
./run_paper_trading_bot.sh --once
```

Every option can also be set via env var in `.env` (see `.env.example`) so
you can run it unattended from cron, a systemd service, or `tmux`/`screen`.

## Flags / env vars

| Flag | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `--symbol` | `BOT_SYMBOL` | `BTCUSDT` | Trading pair |
| `--interval` | `BOT_INTERVAL` | `1m` | Binance kline interval (`1m`, `5m`, `1h`, ...) |
| `--short-window` | `BOT_SHORT_WINDOW` | `5` | Short SMA length, in candles |
| `--long-window` | `BOT_LONG_WINDOW` | `20` | Long SMA length, in candles |
| `--trade-quote-qty` | `BOT_TRADE_QUOTE_QTY` | `50` | Quote-asset amount (e.g. USDT) to spend per buy |
| `--loop-interval-seconds` | `BOT_LOOP_INTERVAL_SECONDS` | `60` | Seconds between checks when looping |
| `--dry-run` | `BOT_DRY_RUN` | off | Log signals, never place orders |
| `--once` | - | off | Check once and exit instead of looping |

## Known limits

- Testnet market data can be thin outside a few major pairs (`BTCUSDT`,
  `ETHUSDT`) - if `closes` looks stale or empty, try a more liquid symbol.
- The bot only ever holds one position at a time and sizes buys by a fixed
  quote amount (`--trade-quote-qty`); it does no risk management beyond that
  (no stop-loss, no position scaling).
- If the process restarts mid-position, `state.json` is what it trusts to
  know whether it's flat or long - delete it to reset to flat.
- A crossover strategy on 1-minute candles trades often and pays testnet
  "fees" in test funds; widen `--interval`/windows to trade less frequently.
