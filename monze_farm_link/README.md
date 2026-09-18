# Monze Farm & Market Link

A small FastAPI backend for the problem that touches almost every household in
Monze, Southern Province, Zambia: farmers and traders selling into an opaque
market, with no fast way to know prices, find agro-dealer stock, get a
planting-window forecast, or warn each other about livestock disease.

Built smartphone-optional on purpose — most of the target users are on
feature phones, so the **USSD menu is the primary interface**. For people
with a smartphone and data, there's also a lightweight, installable mobile
web app served from the same backend.

## Features

- **Price board** — submit and average recent maize/cattle/groundnut prices
  reported by traders and farmers at Monze Market.
- **Agro-dealer directory** — who has fertilizer/seed in stock right now, and
  their phone number.
- **Rain forecast & planting advice** — pulls a free 7-day forecast for Monze
  (Open-Meteo, no API key needed) and gives a plain-language planting call.
- **Livestock disease alerts** — community-reported, held unverified until a
  vet/extension officer confirms, so ECF and similar outbreaks spread warning
  fast without becoming a rumor mill.
- **USSD gateway** (`/ussd`) — a menu-driven flow compatible with the
  Africa's Talking USSD API, so anyone can dial in from a basic phone with no
  app install and no data bundle.
- **Mobile web app** (`/`) — a single-page app for smartphones: tabs for
  Prices, Dealers, Weather and Alerts, installable to the home screen (PWA
  manifest + service worker), so it opens and feels like a native app without
  an app-store listing.

## Stack

- FastAPI + Pydantic for the API
- SQLAlchemy + SQLite by default (swap `DATABASE_URL` for Postgres in production)
- Plain `requests` call to Open-Meteo for weather — free, no key
- Mobile web app: plain HTML/CSS/JS (`app/static/`), no build step, no framework

## Running it

```bash
cd monze_farm_link
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- Open `http://127.0.0.1:8000/` on a phone or browser for the mobile web app.
  On a phone, "Add to Home Screen" installs it like an app.
- Open `http://127.0.0.1:8000/docs` for the interactive API docs.
- POST to `/ussd` with Africa's Talking-style form fields (`sessionId`,
  `phoneNumber`, `text`) to simulate a USSD session locally:

```bash
curl -X POST http://127.0.0.1:8000/ussd -d "sessionId=1&phoneNumber=0977000000&text="
```

## Tests

```bash
cd monze_farm_link
pip install -r requirements-dev.txt   # adds pytest + httpx on top of requirements.txt
pytest
```

Each test runs against a fresh in-memory SQLite database, so tests don't
touch `monze_farm_link.db` or affect each other. Weather tests mock the
Open-Meteo call so they don't depend on network access.

## Endpoints

| Method | Path                          | What it does                                  |
|--------|-------------------------------|------------------------------------------------|
| POST   | `/prices`                     | Submit a price report                           |
| GET    | `/prices`                     | List recent price reports                       |
| GET    | `/prices/average/{commodity}` | Average price over the last N days              |
| POST   | `/dealers`                    | Add an agro-dealer                              |
| GET    | `/dealers`                    | List agro-dealers                               |
| PATCH  | `/dealers/{id}/stock`         | Update a dealer's stock status                  |
| POST   | `/alerts`                     | Report a livestock disease alert                |
| GET    | `/alerts`                     | List alerts (optionally verified-only)          |
| PATCH  | `/alerts/{id}/verify`         | Mark an alert verified                          |
| GET    | `/weather/forecast`           | 7-day rain forecast + planting advice for Monze |
| POST   | `/ussd`                       | USSD webhook (Africa's Talking format)          |
| GET    | `/health`                     | Health check                                    |
| GET    | `/`                            | Mobile web app                                  |

## Deployment

The app is packaged so it's deployable on most platforms with no code
changes — pick whichever you already have an account with:

**Docker (any host: a VPS, Fly.io, a container registry, etc.)**

```bash
cd monze_farm_link
docker build -t monze-farm-link .
docker run -p 8000:8000 -e PORT=8000 monze-farm-link
```

The image only installs `requirements.txt` (no test dependencies), reads
`$PORT` at startup, and serves both the API and the mobile web app.

**Render** — a `render.yaml` blueprint is included. On render.com: New →
Blueprint → point it at this repo (set the blueprint's root directory to
`monze_farm_link`, or copy `render.yaml` to the repo root) → Render builds
the Dockerfile and deploys automatically on every push to `main`.

**Railway / Heroku-style platforms** — a `Procfile` is included
(`web: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`); these
platforms detect it automatically once the repo/subdirectory is connected.

**Persistence note**: SQLite is a single file (`monze_farm_link.db` by
default). Most free container platforms wipe local disk on every redeploy
or restart, so data won't survive unless you either attach a persistent
volume/disk, or set `DATABASE_URL` to point at a managed Postgres instance
instead — the app already reads `DATABASE_URL` from the environment, so
switching databases needs no code change.

## Why this app first

Monze has plenty of real problems — transport schedules, water cuts, hospital
drug stock — but agriculture is the one that touches nearly every household
directly, and where a wrong price or a missed disease warning costs real
money fast. This is deliberately the smallest useful slice: get the price
board and disease alerts trusted by real traders and farmers at Monze Market
first, then layer on the rest. The same model ports straight to Mazabuka,
Choma, Namwala, or any other farming district — only the seed data
(commodities, dealer list, coordinates) changes.

## Next steps toward production

- Wire `/ussd` to a real Africa's Talking (or similar) shortcode.
- Add phone-number verification/rate-limiting on price submissions to deter
  spam/price manipulation.
- Add an SMS broadcast for verified disease alerts to nearby registered
  farmers (Africa's Talking SMS API, same SDK as USSD).
- Swap SQLite for Postgres and deploy behind a small VPS or PaaS.
