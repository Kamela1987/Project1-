#!/usr/bin/env python3
"""Tech news digest: world trending tech + Africa/Zambia tech + entry-level career
reading, fetched from free public feeds/APIs (no API key needed) and printed, saved,
and optionally emailed. Meant to run every couple of hours from cron, a GitHub Actions
schedule, or its own --loop mode.
"""

import argparse
import html
import os
import smtplib
import sys
import time
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from itertools import zip_longest
from pathlib import Path

import feedparser
import requests

USER_AGENT = "tech-news-zambia-script/1.0 (+https://github.com/Kamela1987/Project1-)"
TIMEOUT = 12

# Global, high-traffic tech coverage.
WORLD_FEEDS = [
    ("TechCrunch", "https://techcrunch.com/feed/"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("Wired", "https://www.wired.com/feed/rss"),
]

# Africa/Zambia tech scene: startups, jobs, bootcamps, scholarships.
AFRICA_ZAMBIA_FEEDS = [
    ("TechCabal", "https://techcabal.com/feed/"),
    ("Disrupt Africa", "https://disrupt-africa.com/feed/"),
    (
        "Google News: Zambia tech",
        "https://news.google.com/rss/search?q=Zambia+technology&hl=en-ZM&gl=ZM&ceid=ZM:en",
    ),
    (
        "Google News: Zambia tech jobs/bootcamps",
        "https://news.google.com/rss/search?q=Zambia+(tech+OR+software)+(jobs+OR+bootcamp+OR+scholarship)&hl=en-ZM&gl=ZM&ceid=ZM:en",
    ),
]

# Reading to actually grow an entry-level developer: tutorials, career advice, "how I
# learned/got hired" posts.
CAREER_FEEDS = [
    ("freeCodeCamp News", "https://www.freecodecamp.org/news/rss/"),
]
CAREER_DEVTO_TAGS = ["beginners", "career", "programming"]

HN_TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{}.json"
DEVTO_URL = "https://dev.to/api/articles"


def fetch_rss(name, url, limit):
    entries = []
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
        for e in parsed.entries[:limit]:
            title = html.unescape(e.get("title", "").strip())
            if not title:
                continue
            entries.append({"title": title, "link": e.get("link", ""), "source": name})
    except Exception as exc:  # noqa: BLE001 - one dead feed must never sink the run
        print(f"  ! {name}: {exc}", file=sys.stderr)
    return entries


def fetch_hn_top(limit):
    entries = []
    try:
        resp = requests.get(HN_TOP_URL, timeout=TIMEOUT)
        resp.raise_for_status()
        for story_id in resp.json()[:limit]:
            item_resp = requests.get(HN_ITEM_URL.format(story_id), timeout=TIMEOUT)
            item_resp.raise_for_status()
            item = item_resp.json() or {}
            title = item.get("title")
            if not title:
                continue
            link = item.get("url") or f"https://news.ycombinator.com/item?id={story_id}"
            entries.append({"title": title, "link": link, "source": "Hacker News"})
    except Exception as exc:  # noqa: BLE001
        print(f"  ! Hacker News: {exc}", file=sys.stderr)
    return entries


def fetch_devto(tag, limit):
    entries = []
    try:
        resp = requests.get(
            DEVTO_URL,
            params={"tag": tag, "top": 3, "per_page": limit},
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        for article in resp.json()[:limit]:
            title = (article.get("title") or "").strip()
            if not title:
                continue
            entries.append(
                {"title": title, "link": article.get("url", ""), "source": f"dev.to #{tag}"}
            )
    except Exception as exc:  # noqa: BLE001
        print(f"  ! dev.to #{tag}: {exc}", file=sys.stderr)
    return entries


def round_robin_merge(sources):
    """Interleave per-source lists so one prolific/stale source can't crowd the rest
    out before dedupe+limit gets applied."""
    merged = []
    for group in zip_longest(*sources):
        for item in group:
            if item is not None:
                merged.append(item)
    return merged


def dedupe(entries):
    seen = set()
    out = []
    for e in entries:
        key = e["title"].strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(e)
    return out


def build_section(name, entries, limit):
    return {"name": name, "entries": dedupe(entries)[:limit]}


def fetch_digest(max_per_section, hn_count):
    world = round_robin_merge(
        [fetch_hn_top(hn_count)]
        + [fetch_rss(name, url, max_per_section) for name, url in WORLD_FEEDS]
    )

    africa = round_robin_merge(
        [fetch_rss(name, url, max_per_section) for name, url in AFRICA_ZAMBIA_FEEDS]
    )

    career = round_robin_merge(
        [fetch_rss(name, url, max_per_section) for name, url in CAREER_FEEDS]
        + [fetch_devto(tag, max_per_section) for tag in CAREER_DEVTO_TAGS]
    )

    return [
        build_section("World Tech - Trending Now", world, max_per_section),
        build_section("Africa & Zambia Tech", africa, max_per_section),
        build_section("Career & Skills - Entry-Level Developer Reading", career, max_per_section),
    ]


def render_text(sections, generated_at):
    lines = [f"TECH NEWS DIGEST - {generated_at:%Y-%m-%d %H:%M UTC}", ""]
    for section in sections:
        lines.append(f"== {section['name']} ==")
        if not section["entries"]:
            lines.append("  (no items this run)")
        for i, e in enumerate(section["entries"], 1):
            lines.append(f"  {i}. {e['title']}")
            lines.append(f"     {e['source']} - {e['link']}")
        lines.append("")
    return "\n".join(lines)


def render_html(sections, generated_at):
    parts = [
        "<html><body style='font-family:sans-serif;max-width:640px;margin:0 auto'>",
        f"<h2>Tech news digest &mdash; {generated_at:%Y-%m-%d %H:%M UTC}</h2>",
    ]
    for section in sections:
        parts.append(f"<h3>{html.escape(section['name'])}</h3>")
        if not section["entries"]:
            parts.append("<p><em>No items this run.</em></p>")
            continue
        parts.append("<ol>")
        for e in section["entries"]:
            parts.append(
                f"<li><a href='{html.escape(e['link'])}'>{html.escape(e['title'])}</a>"
                f" <small>({html.escape(e['source'])})</small></li>"
            )
        parts.append("</ol>")
    parts.append("</body></html>")
    return "\n".join(parts)


def send_email(subject, text_body, html_body):
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    to_addr = os.environ.get("NEWS_EMAIL_TO") or os.environ.get("EMAIL_TO")
    from_addr = os.environ.get("EMAIL_FROM", user)

    if not all([user, password, to_addr]):
        print(
            "Email not sent: SMTP_USER, SMTP_PASSWORD and NEWS_EMAIL_TO/EMAIL_TO "
            "must all be set (see .env.example).",
            file=sys.stderr,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(from_addr, [to_addr], msg.as_string())
    return True


def save_digest(text_body, html_body, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "latest.txt").write_text(text_body, encoding="utf-8")
    (out_dir / "latest.html").write_text(html_body, encoding="utf-8")


def run_once(args):
    generated_at = datetime.now(timezone.utc)
    print(f"=== Fetching tech news digest ({generated_at:%Y-%m-%d %H:%M UTC}) ===")
    sections = fetch_digest(args.max_per_section, args.hn_count)
    text_body = render_text(sections, generated_at)
    html_body = render_html(sections, generated_at)

    print(text_body)

    if not args.no_save:
        save_digest(text_body, html_body, Path(args.out_dir))

    exit_code = 0
    total_items = sum(len(s["entries"]) for s in sections)
    if total_items == 0:
        print("Every source failed - nothing to report this run.", file=sys.stderr)
        exit_code = 4

    if args.email:
        subject = f"Tech news digest - {generated_at:%Y-%m-%d %H:%M} UTC"
        if send_email(subject, text_body, html_body):
            print("Email sent.")
        else:
            print("Email NOT sent (see warning above).")
            exit_code = exit_code or 3

    return exit_code


def self_test():
    """Exercise the pure formatting pipeline with canned data - no network needed."""
    merged = round_robin_merge([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]])
    assert merged == ["a1", "b1", "c1", "a2", "c2", "a3"], (
        f"round-robin should interleave sources fairly instead of draining one first, got {merged}"
    )

    raw = [
        {"title": "Same Title", "source": "A", "link": "https://a.example"},
        {"title": "same title", "source": "B", "link": "https://b.example"},
        {"title": "Different", "source": "C", "link": "https://c.example"},
    ]
    deduped = dedupe(raw)
    assert len(deduped) == 2, f"expected dedupe to drop the case-insensitive repeat, got {deduped}"

    section = build_section("Test Section", raw, limit=1)
    assert len(section["entries"]) == 1, "limit was not applied"

    sections = [build_section("Test Section", raw, limit=5)]
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    text_body = render_text(sections, now)
    assert "Test Section" in text_body and "Different" in text_body

    html_body = render_html(sections, now)
    assert "<h3>Test Section</h3>" in html_body and "Different" in html_body

    empty_html = render_html([build_section("Empty", [], limit=5)], now)
    assert "No items this run" in empty_html

    print("self-test OK")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--loop", action="store_true", help="Keep running, fetching every --interval-hours"
    )
    parser.add_argument("--interval-hours", type=float, default=2.0)
    parser.add_argument(
        "--email", action="store_true", help="Email the digest (needs SMTP_* in .env)"
    )
    parser.add_argument("--max-per-section", type=int, default=8)
    parser.add_argument(
        "--hn-count", type=int, default=8, help="Hacker News top stories to include"
    )
    parser.add_argument("--out-dir", default="digests")
    parser.add_argument("--no-save", action="store_true", help="Skip writing digests/latest.*")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    if not args.loop:
        sys.exit(run_once(args))

    print(f"Looping every {args.interval_hours} hour(s). Ctrl+C to stop.")
    while True:
        try:
            run_once(args)
        except Exception as exc:  # noqa: BLE001 - the loop must survive one bad run
            print(f"Run failed: {exc}", file=sys.stderr)
        time.sleep(args.interval_hours * 3600)


if __name__ == "__main__":
    main()
