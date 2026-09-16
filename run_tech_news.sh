#!/usr/bin/env bash
# Tech news digest (world trending + Africa/Zambia tech + entry-level career
# reading) -> printed, saved to digests/, and emailed. Point cron at this file to get
# it every 2 hours.
#
#   crontab -e
#   0 */2 * * *  /full/path/to/this/repo/run_tech_news.sh >> /full/path/to/this/repo/tech_news.log 2>&1
set -euo pipefail

cd "$(dirname "$0")"

# Credentials live in .env, which is gitignored. See .env.example.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

echo "=== $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
exec python3 tech_news_zambia.py --email "$@"
