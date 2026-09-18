#!/usr/bin/env python3
"""Bet tracker + parlay/EV calculator.

This tool does NOT predict outcomes, fetch odds, or generate picks - there is no
reliable way to do that, and anything claiming otherwise is selling a story. What
it does do:

1. Log every bet you place (stake, odds, outcome) to a local CSV.
2. Report your real win rate, total staked/returned, and ROI over time - the only
   honest signal of whether your betting is actually working.
3. Given a list of leg odds, compute the combined odds, implied probability, and
   payout for a parlay/accumulator BEFORE you place it, so you can see the real
   risk instead of judging it "by feel".

Nothing here is financial or gambling advice.
"""

import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

FIELDNAMES = ["date", "description", "odds", "stake", "result", "payout"]
VALID_RESULTS = {"win", "loss", "push", "pending"}


def load_bets(csv_path):
    path = Path(csv_path)
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_bet(csv_path, row):
    path = Path(csv_path)
    is_new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def combined_odds(legs):
    total = 1.0
    for o in legs:
        total *= o
    return total


def implied_probability(decimal_odds):
    return 1.0 / decimal_odds if decimal_odds > 0 else 0.0


def cmd_add(args):
    if args.result not in VALID_RESULTS:
        print(f"--result must be one of {sorted(VALID_RESULTS)}", file=sys.stderr)
        return 1

    stake = args.stake
    odds = args.odds
    if args.result == "win":
        payout = round(stake * odds, 2)
    elif args.result == "push":
        payout = stake
    else:
        payout = 0.0

    row = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": args.description,
        "odds": odds,
        "stake": stake,
        "result": args.result,
        "payout": payout,
    }
    save_bet(args.csv, row)
    print(f"Logged: {row}")
    return 0


def cmd_report(args):
    bets = load_bets(args.csv)
    settled = [b for b in bets if b["result"] in ("win", "loss", "push")]
    pending = [b for b in bets if b["result"] == "pending"]

    if not settled:
        print("No settled bets yet.")
        if pending:
            print(f"{len(pending)} bet(s) still pending.")
        return 0

    total_staked = sum(float(b["stake"]) for b in settled)
    total_returned = sum(float(b["payout"]) for b in settled)
    wins = sum(1 for b in settled if b["result"] == "win")
    losses = sum(1 for b in settled if b["result"] == "loss")
    pushes = sum(1 for b in settled if b["result"] == "push")
    profit = total_returned - total_staked
    roi = (profit / total_staked * 100) if total_staked else 0.0
    win_rate = (wins / (wins + losses) * 100) if (wins + losses) else 0.0

    print(f"Settled bets:   {len(settled)}  (win {wins} / loss {losses} / push {pushes})")
    print(f"Win rate:       {win_rate:.1f}%  (excludes pushes)")
    print(f"Total staked:   {total_staked:.2f}")
    print(f"Total returned: {total_returned:.2f}")
    print(f"Net profit:     {profit:+.2f}")
    print(f"ROI:            {roi:+.1f}%")
    if pending:
        print(f"Pending:        {len(pending)} bet(s) not yet settled")
    return 0


def cmd_parlay(args):
    legs = args.odds
    if not legs:
        print("Provide at least one leg odds value, e.g. --odds 1.5 1.3 1.2", file=sys.stderr)
        return 1
    for o in legs:
        if o <= 1.0:
            print(f"Odds must be > 1.0, got {o}", file=sys.stderr)
            return 1

    combined = combined_odds(legs)
    prob = implied_probability(combined)
    stake = args.stake
    payout = stake * combined
    profit = payout - stake

    print(f"Legs ({len(legs)}): {legs}")
    print(f"Combined odds:        {combined:.3f}")
    print(f"Implied probability:  {prob * 100:.1f}%  (bookmaker's break-even estimate, includes their margin)")
    print(f"Stake:                {stake:.2f}")
    print(f"Potential payout:     {payout:.2f}")
    print(f"Potential profit:     {profit:.2f}")
    print()
    print(
        "Reminder: implied probability already bakes in the bookmaker's margin per leg, "
        "so your real win chance is likely lower than this number, not higher."
    )
    return 0


def self_test():
    assert round(combined_odds([1.5, 2.0]), 4) == 3.0
    assert round(implied_probability(4.0), 4) == 0.25

    tmp = Path("/tmp/_bet_tracker_selftest.csv")
    if tmp.exists():
        tmp.unlink()
    save_bet(tmp, {
        "date": "2026-01-01", "description": "test", "odds": 2.0,
        "stake": 10.0, "result": "win", "payout": 20.0,
    })
    loaded = load_bets(tmp)
    assert len(loaded) == 1 and loaded[0]["description"] == "test"
    tmp.unlink()

    print("self-test OK")


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", default="bets.csv", help="Path to the bet log CSV (default: bets.csv)")
    sub = parser.add_subparsers(dest="command")

    p_add = sub.add_parser("add", help="Log a bet")
    p_add.add_argument("description", help="What the bet was, e.g. 'Man City W1'")
    p_add.add_argument("--odds", type=float, required=True)
    p_add.add_argument("--stake", type=float, required=True)
    p_add.add_argument("--result", default="pending", help="win/loss/push/pending (default: pending)")
    p_add.set_defaults(func=cmd_add)

    p_report = sub.add_parser("report", help="Show win rate, ROI, totals from the log")
    p_report.set_defaults(func=cmd_report)

    p_parlay = sub.add_parser("parlay", help="Compute combined odds/probability for a set of legs")
    p_parlay.add_argument("--odds", type=float, nargs="+", required=True, help="Decimal odds for each leg")
    p_parlay.add_argument("--stake", type=float, default=1.0)
    p_parlay.set_defaults(func=cmd_parlay)

    parser.add_argument("--self-test", action="store_true")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    if not getattr(args, "command", None):
        parser.print_help()
        sys.exit(1)

    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
