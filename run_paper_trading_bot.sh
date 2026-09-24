#!/usr/bin/env bash
# Paper-trading bot (Binance SPOT TESTNET - fake funds only). Point cron, a
# systemd service, or just a terminal/tmux session at this file.
set -euo pipefail

cd "$(dirname "$0")"

# Credentials live in .env, which is gitignored. See .env.example.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

exec python3 paper_trading_bot/bot.py "$@"
