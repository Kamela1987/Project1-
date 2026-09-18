# Tech news digest, every 2 hours

`tech_news_zambia.py` builds a short digest from free, no-key-needed public feeds
and APIs, in three sections:

1. **World Tech — Trending Now**: Hacker News' current top stories, plus TechCrunch,
   The Verge, Ars Technica and Wired.
2. **Africa & Zambia Tech**: TechCabal, Disrupt Africa, and Google News searches for
   Zambian tech coverage and Zambian tech jobs/bootcamps/scholarships.
3. **Career & Skills — Entry-Level Developer Reading**: freeCodeCamp News plus
   dev.to's top posts tagged `beginners`, `career` and `programming` — the kind of
   reading that actually builds someone starting out, rather than just news to skim.

Every run prints the digest, saves `digests/latest.txt` and `digests/latest.html`,
and — if you've set up email — sends it. A feed that's down is skipped with a
warning; it never stops the rest of the run.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env        # then fill in the SMTP_* lines if you want email
```

Try it once with no setup at all — no email, no key, nothing to configure:

```bash
python3 tech_news_zambia.py --no-save
```

## Running it from a phone (no computer needed)

GitHub runs the script for you every 2 hours, for free. **Do this in your phone's
browser** (Chrome or Safari) — the GitHub mobile *app* has no Settings menu for
secrets.

1. Get a Gmail App Password: turn on
   [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification),
   then create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   Copy the 16-character code.
2. Go to this repo's **Settings → Secrets and variables → Actions**, then add:

   | Name | Value |
   | --- | --- |
   | `NEWS_EMAIL_TO` | where the digest should go, e.g. `you@example.com` |
   | `SMTP_USER` | the Gmail address you're sending *from* |
   | `SMTP_PASSWORD` | the 16-character App Password |

3. Go to the **Actions** tab → **Tech news digest** → **Run workflow** to test it
   immediately.
4. After that it runs by itself every 2 hours. **Scheduled runs are queued, not
   exact** — a few minutes late at peak times is normal.

Either way, the digest is attached to each run as a downloadable **tech-news-digest**
artifact, so you can read it even if email didn't go out.

## Running it from your own computer

```ini
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.address@gmail.com
SMTP_PASSWORD=your_16_char_app_password
NEWS_EMAIL_TO=you@example.com
```

Test it once:

```bash
./run_tech_news.sh
```

Then schedule it every 2 hours:

```bash
crontab -e
```

```cron
0 */2 * * *  /full/path/to/this/repo/run_tech_news.sh >> /full/path/to/this/repo/tech_news.log 2>&1
```

Your machine has to be awake when cron fires. If it usually isn't, use the GitHub
Actions route above instead, or run `python3 tech_news_zambia.py --loop` in a
terminal (or under something like `tmux`/`screen`/a systemd service) to have the
script schedule itself in-process.

## Usage

```bash
python3 tech_news_zambia.py                       # one run: print + save digests/latest.*
python3 tech_news_zambia.py --email               # also email it (needs SMTP_* set)
python3 tech_news_zambia.py --loop                # keep running, fetching every 2 hours
python3 tech_news_zambia.py --loop --interval-hours 4
python3 tech_news_zambia.py --max-per-section 5    # fewer items per section (default 8)
python3 tech_news_zambia.py --hn-count 12          # more Hacker News stories (default 8)
python3 tech_news_zambia.py --no-save              # skip writing digests/latest.*
python3 tech_news_zambia.py --self-test            # check the formatting pipeline, no network
```

Exit codes for cron/Actions logs: `0` normal, `3` email was requested but failed to
send, `4` every source failed and the digest came back empty.

## Bet tracker + parlay calculator

`bet_tracker.py` is a small honesty tool, not a picks generator. It does not
predict outcomes or fetch odds - it only helps you evaluate and log bets you've
already decided on:

```bash
# Before betting: see the real combined odds/probability of a multi-leg slip
python3 bet_tracker.py parlay --odds 1.149 1.33 1.176 --stake 100

# After placing a bet: log it (result defaults to "pending" until settled)
python3 bet_tracker.py add "Man City W1" --odds 1.33 --stake 50 --result win

# Any time: see your real win rate and ROI across everything you've logged
python3 bet_tracker.py report
```

Bets are stored in `bets.csv` (gitignored, stays local) unless you pass
`--csv path/to/file.csv`. Run `python3 bet_tracker.py --self-test` to check the
math and file I/O with no data required.

## Known limits

- These are free public feeds with no key, so they can rate-limit or go down; a
  failed source is skipped, not retried.
- Google News RSS result quality varies with how specific the search terms are —
  widen or narrow the queries at the top of `tech_news_zambia.py` if the Zambia
  section comes back thin or too broad.
- `--loop` mode drifts by however long each fetch takes; for a precise 2-hour
  cadence, prefer cron or the GitHub Actions schedule instead.
