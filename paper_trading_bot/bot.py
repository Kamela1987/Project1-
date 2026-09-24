#!/usr/bin/env python3
"""Paper-trading bot: SMA-crossover strategy, executed on Binance's spot
*testnet* (fake funds, real order book - https://testnet.binance.vision).

This never touches real money and never places orders on the production
Binance API. See README.md in this folder before running it.

Usage:
    python3 bot.py                      # loop forever, trading on testnet
    python3 bot.py --once               # check once and exit
    python3 bot.py --dry-run            # loop, but only log signals, never order
    python3 bot.py --symbol ETHUSDT --short-window 5 --long-window 20
    python3 bot.py --self-test          # check strategy math, no network
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from broker import BinanceError, TestnetClient
from strategy import Signal, crossover_signal

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / "state.json"
TRADES_LOG = HERE / "trades.csv"


def load_position() -> str:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text()).get("position", "flat")
    return "flat"


def save_position(position: str) -> None:
    STATE_FILE.write_text(json.dumps({"position": position}))


def log_trade(row: dict) -> None:
    is_new = not TRADES_LOG.exists()
    with TRADES_LOG.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(row.keys()))
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_once(
    client: TestnetClient,
    symbol: str,
    interval: str,
    short_window: int,
    long_window: int,
    trade_quote_qty: float,
    dry_run: bool,
) -> Signal:
    closes = client.closes(symbol, interval, limit=long_window + 5)
    signal = crossover_signal(closes, short_window, long_window)
    position = load_position()

    price = closes[-1] if closes else None
    print(
        f"[{now_iso()}] {symbol} price={price} short_sma={signal.short_sma} "
        f"long_sma={signal.long_sma} signal={signal.action} position={position} "
        f"({signal.reason})"
    )

    if signal.action == "buy" and position == "flat":
        _execute(client, symbol, "BUY", trade_quote_qty, signal, dry_run)
        save_position("long")
    elif signal.action == "sell" and position == "long":
        _execute(client, symbol, "SELL", trade_quote_qty, signal, dry_run)
        save_position("flat")

    return signal


def _execute(
    client: TestnetClient,
    symbol: str,
    side: str,
    trade_quote_qty: float,
    signal: Signal,
    dry_run: bool,
) -> None:
    row = {
        "time": now_iso(),
        "symbol": symbol,
        "side": side,
        "quote_qty": trade_quote_qty,
        "short_sma": signal.short_sma,
        "long_sma": signal.long_sma,
        "reason": signal.reason,
        "dry_run": dry_run,
        "order_id": "",
        "status": "",
    }
    if dry_run:
        print(f"  -> DRY RUN: would {side} {trade_quote_qty} quote units of {symbol}")
        row["status"] = "dry_run"
    else:
        try:
            order = client.market_order(symbol, side, trade_quote_qty)
            print(f"  -> order placed: {order}")
            row["order_id"] = order.get("orderId", "")
            row["status"] = order.get("status", "")
        except BinanceError as e:
            print(f"  -> ORDER FAILED: {e}", file=sys.stderr)
            row["status"] = f"error: {e}"
    log_trade(row)


def self_test() -> int:
    from strategy import sma

    assert sma([1, 2, 3, 4], 2) == 3.5
    assert sma([1, 2], 3) is None

    # Rising-then-flattening series should produce exactly one golden cross.
    closes = [10, 10, 10, 10, 10, 11, 12, 13, 14, 15, 15, 15, 15]
    signals = []
    for i in range(6, len(closes) + 1):
        signals.append(crossover_signal(closes[:i], short_window=2, long_window=5).action)
    assert "buy" in signals, signals
    assert signals.count("buy") == 1, signals

    # Falling series should produce exactly one death cross.
    closes = [15, 15, 15, 15, 15, 14, 13, 12, 11, 10, 10, 10, 10]
    signals = []
    for i in range(6, len(closes) + 1):
        signals.append(crossover_signal(closes[:i], short_window=2, long_window=5).action)
    assert "sell" in signals, signals
    assert signals.count("sell") == 1, signals

    print("self-test OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--symbol", default=os.environ.get("BOT_SYMBOL", "BTCUSDT"))
    parser.add_argument("--interval", default=os.environ.get("BOT_INTERVAL", "1m"), help="Binance kline interval")
    parser.add_argument("--short-window", type=int, default=int(os.environ.get("BOT_SHORT_WINDOW", 5)))
    parser.add_argument("--long-window", type=int, default=int(os.environ.get("BOT_LONG_WINDOW", 20)))
    parser.add_argument(
        "--trade-quote-qty",
        type=float,
        default=float(os.environ.get("BOT_TRADE_QUOTE_QTY", 50)),
        help="How much of the quote asset (e.g. USDT) to spend per buy",
    )
    parser.add_argument(
        "--loop-interval-seconds",
        type=int,
        default=int(os.environ.get("BOT_LOOP_INTERVAL_SECONDS", 60)),
    )
    parser.add_argument("--once", action="store_true", help="Check once and exit instead of looping")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=os.environ.get("BOT_DRY_RUN", "").lower() in {"1", "true", "yes"},
        help="Log signals but never place orders, even on testnet",
    )
    parser.add_argument("--self-test", action="store_true", help="Check strategy math, no network, then exit")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    client = TestnetClient(
        api_key=os.environ.get("BINANCE_TESTNET_API_KEY"),
        api_secret=os.environ.get("BINANCE_TESTNET_API_SECRET"),
    )

    if args.once:
        run_once(
            client,
            args.symbol,
            args.interval,
            args.short_window,
            args.long_window,
            args.trade_quote_qty,
            args.dry_run,
        )
        return 0

    print(
        f"Starting paper-trading bot: {args.symbol} {args.interval} "
        f"SMA({args.short_window}/{args.long_window}) dry_run={args.dry_run} "
        f"-- Ctrl+C to stop"
    )
    while True:
        try:
            run_once(
                client,
                args.symbol,
                args.interval,
                args.short_window,
                args.long_window,
                args.trade_quote_qty,
                args.dry_run,
            )
        except KeyboardInterrupt:
            print("\nStopped.")
            return 0
        except Exception as e:  # noqa: BLE001 - keep the loop alive on transient errors
            print(f"[{now_iso()}] ERROR: {e}", file=sys.stderr)
        try:
            time.sleep(args.loop_interval_seconds)
        except KeyboardInterrupt:
            print("\nStopped.")
            return 0


if __name__ == "__main__":
    sys.exit(main())
