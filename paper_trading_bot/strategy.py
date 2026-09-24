"""Simple moving-average crossover strategy.

Signal is derived purely from a list of closing prices (oldest first):
- "buy"  when the short SMA crosses from <= to >  the long SMA (golden cross)
- "sell" when the short SMA crosses from >= to <  the long SMA (death cross)
- "hold" otherwise, or when there isn't enough history yet
"""
from __future__ import annotations

from dataclasses import dataclass


def sma(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


@dataclass
class Signal:
    action: str  # "buy" | "sell" | "hold"
    short_sma: float | None
    long_sma: float | None
    reason: str


def crossover_signal(closes: list[float], short_window: int, long_window: int) -> Signal:
    if short_window >= long_window:
        raise ValueError("short_window must be < long_window")

    # Need one extra point so we can compare "now" against "one step back".
    if len(closes) < long_window + 1:
        return Signal("hold", None, None, "not enough price history yet")

    short_now = sma(closes, short_window)
    long_now = sma(closes, long_window)
    short_prev = sma(closes[:-1], short_window)
    long_prev = sma(closes[:-1], long_window)

    if short_prev <= long_prev and short_now > long_now:
        return Signal("buy", short_now, long_now, "golden cross: short SMA moved above long SMA")
    if short_prev >= long_prev and short_now < long_now:
        return Signal("sell", short_now, long_now, "death cross: short SMA moved below long SMA")
    return Signal("hold", short_now, long_now, "no crossover")
