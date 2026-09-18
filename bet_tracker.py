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
4. Given odds and YOUR OWN estimated true win probability, size a stake with the
   Kelly criterion - it does not supply that probability, only the sizing math.

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


def kelly_fraction(decimal_odds, win_probability):
    """Full Kelly stake as a fraction of bankroll. Negative edge -> 0 (don't bet)."""
    b = decimal_odds - 1.0
    p = win_probability
    q = 1.0 - p
    f = (b * p - q) / b
    return max(f, 0.0)


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


def summarize(settled):
    """Aggregate stats for a list of settled bets. Assumes no pending bets included."""
    total_staked = sum(float(b["stake"]) for b in settled)
    total_returned = sum(float(b["payout"]) for b in settled)
    wins = sum(1 for b in settled if b["result"] == "win")
    losses = sum(1 for b in settled if b["result"] == "loss")
    pushes = sum(1 for b in settled if b["result"] == "push")
    profit = total_returned - total_staked
    return {
        "count": len(settled),
        "wins": wins,
        "losses": losses,
        "pushes": pushes,
        "win_rate": (wins / (wins + losses) * 100) if (wins + losses) else 0.0,
        "total_staked": total_staked,
        "total_returned": total_returned,
        "profit": profit,
        "roi": (profit / total_staked * 100) if total_staked else 0.0,
    }


def month_key(bet):
    return bet["date"][:7]  # "YYYY-MM-DD" -> "YYYY-MM"


def cmd_report(args):
    bets = load_bets(args.csv)
    settled = [b for b in bets if b["result"] in ("win", "loss", "push")]
    pending = [b for b in bets if b["result"] == "pending"]

    if not settled:
        print("No settled bets yet.")
        if pending:
            print(f"{len(pending)} bet(s) still pending.")
        return 0

    s = summarize(settled)
    print(f"Settled bets:   {s['count']}  (win {s['wins']} / loss {s['losses']} / push {s['pushes']})")
    print(f"Win rate:       {s['win_rate']:.1f}%  (excludes pushes)")
    print(f"Total staked:   {s['total_staked']:.2f}")
    print(f"Total returned: {s['total_returned']:.2f}")
    print(f"Net profit:     {s['profit']:+.2f}")
    print(f"ROI:            {s['roi']:+.1f}%")
    if pending:
        print(f"Pending:        {len(pending)} bet(s) not yet settled")

    months = sorted({month_key(b) for b in settled})
    if len(months) > 1 or args.monthly:
        print()
        print("By month:")
        header = f"  {'Month':<9} {'Bets':>5} {'W-L-P':>9} {'Staked':>10} {'Returned':>10} {'Profit':>10} {'ROI':>8}"
        print(header)
        for m in months:
            month_bets = [b for b in settled if month_key(b) == m]
            ms = summarize(month_bets)
            wlp = f"{ms['wins']}-{ms['losses']}-{ms['pushes']}"
            print(
                f"  {m:<9} {ms['count']:>5} {wlp:>9} {ms['total_staked']:>10.2f} "
                f"{ms['total_returned']:>10.2f} {ms['profit']:>+10.2f} {ms['roi']:>+7.1f}%"
            )
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


def cmd_kelly(args):
    odds = args.odds
    prob = args.prob
    bankroll = args.bankroll
    fraction = args.fraction

    if odds <= 1.0:
        print(f"Odds must be > 1.0, got {odds}", file=sys.stderr)
        return 1
    if not (0.0 < prob < 1.0):
        print(f"--prob must be between 0 and 1 (exclusive), got {prob}", file=sys.stderr)
        return 1

    full_kelly = kelly_fraction(odds, prob)
    applied = full_kelly * fraction
    stake = applied * bankroll
    edge = prob * odds - 1.0

    print(f"Odds:                 {odds}")
    print(f"Your estimated p(win): {prob * 100:.1f}%")
    print(f"Implied p(win) at these odds: {implied_probability(odds) * 100:.1f}%")
    print(f"Edge (yours vs market): {edge * 100:+.1f}%")
    print()
    if full_kelly <= 0.0:
        print("Full Kelly: 0% of bankroll - your estimated probability gives no edge at these odds.")
        print("Kelly says don't bet this, not how much to bet.")
        return 0

    print(f"Full Kelly stake:     {full_kelly * 100:.1f}% of bankroll")
    print(f"Applied ({fraction:g}x Kelly): {applied * 100:.1f}% of bankroll = {stake:.2f}")
    print()
    print(
        "Reminder: this is only as good as your --prob estimate. Full Kelly is aggressive "
        "and assumes that estimate is exactly right, which it rarely is - most people use "
        "half-Kelly (--fraction 0.5) or less to survive being wrong about p."
    )
    return 0


def self_test():
    assert round(combined_odds([1.5, 2.0]), 4) == 3.0
    assert round(implied_probability(4.0), 4) == 0.25
    assert round(kelly_fraction(2.0, 0.6), 4) == 0.2  # b=1, p=0.6, q=0.4 -> (0.6-0.4)/1
    assert kelly_fraction(2.0, 0.4) == 0.0  # negative edge -> no bet

    sample = [
        {"date": "2026-01-05", "stake": "10", "result": "win", "payout": "20"},
        {"date": "2026-01-20", "stake": "10", "result": "loss", "payout": "0"},
        {"date": "2026-02-01", "stake": "10", "result": "win", "payout": "15"},
    ]
    assert [month_key(b) for b in sample] == ["2026-01", "2026-01", "2026-02"]
    jan = summarize([b for b in sample if month_key(b) == "2026-01"])
    assert jan["count"] == 2 and jan["wins"] == 1 and jan["losses"] == 1
    assert round(jan["profit"], 2) == 0.0  # staked 20, returned 20
    feb = summarize([b for b in sample if month_key(b) == "2026-02"])
    assert feb["count"] == 1 and round(feb["profit"], 2) == 5.0

    _test_csv_edge_cases()

    print("self-test OK")


def _test_csv_edge_cases():
    tmp = Path("/tmp/_bet_tracker_selftest.csv")
    if tmp.exists():
        tmp.unlink()

    # Nonexistent file -> empty list, not an error.
    assert load_bets(tmp) == []

    # First save creates the file with a header row.
    save_bet(tmp, {
        "date": "2026-01-01", "description": "test", "odds": 2.0,
        "stake": 10.0, "result": "win", "payout": 20.0,
    })
    header_line = tmp.read_text(encoding="utf-8").splitlines()[0]
    assert header_line == ",".join(FIELDNAMES)
    loaded = load_bets(tmp)
    assert len(loaded) == 1 and loaded[0]["description"] == "test"

    # Second save appends a row without repeating the header.
    save_bet(tmp, {
        "date": "2026-01-02", "description": "second", "odds": 1.5,
        "stake": 5.0, "result": "loss", "payout": 0.0,
    })
    lines = tmp.read_text(encoding="utf-8").splitlines()
    assert lines.count(header_line) == 1
    loaded = load_bets(tmp)
    assert len(loaded) == 2
    assert [b["description"] for b in loaded] == ["test", "second"]

    # Descriptions containing commas and quotes must round-trip intact -
    # naive comma-splitting would silently corrupt these.
    tricky = 'Man City, Chelsea "double" bet'
    save_bet(tmp, {
        "date": "2026-01-03", "description": tricky, "odds": 1.2,
        "stake": 1.0, "result": "pending", "payout": 0.0,
    })
    loaded = load_bets(tmp)
    assert loaded[-1]["description"] == tricky

    # DictReader always returns strings, even for numeric fields - callers
    # that forget to cast (e.g. via float()) would misbehave silently.
    assert isinstance(loaded[0]["stake"], str)
    assert float(loaded[0]["stake"]) == 10.0

    tmp.unlink()

    # A file with only a header row (no data yet) loads as an empty list,
    # not an error or a row of blanks.
    tmp.write_text(",".join(FIELDNAMES) + "\n", encoding="utf-8")
    assert load_bets(tmp) == []
    tmp.unlink()


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
    p_report.add_argument(
        "--monthly", action="store_true",
        help="Always show the month-by-month breakdown, even with only one month of data",
    )
    p_report.set_defaults(func=cmd_report)

    p_parlay = sub.add_parser("parlay", help="Compute combined odds/probability for a set of legs")
    p_parlay.add_argument("--odds", type=float, nargs="+", required=True, help="Decimal odds for each leg")
    p_parlay.add_argument("--stake", type=float, default=1.0)
    p_parlay.set_defaults(func=cmd_parlay)

    p_kelly = sub.add_parser(
        "kelly", help="Size a stake with the Kelly criterion from your own probability estimate"
    )
    p_kelly.add_argument("--odds", type=float, required=True, help="Decimal odds offered")
    p_kelly.add_argument(
        "--prob", type=float, required=True,
        help="YOUR estimated true win probability (0-1) - not derived from the odds",
    )
    p_kelly.add_argument("--bankroll", type=float, required=True)
    p_kelly.add_argument(
        "--fraction", type=float, default=0.5,
        help="Fraction of full Kelly to apply (default 0.5 = half-Kelly, safer than full 1.0)",
    )
    p_kelly.set_defaults(func=cmd_kelly)

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
