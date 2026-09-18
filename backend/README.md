# Monze Ride — Backend (Phase 1)

NestJS + TypeORM/PostgreSQL API implementing the Phase 1 core loop from
[`docs/MONZE_RIDE_ARCHITECTURE.md`](../docs/MONZE_RIDE_ARCHITECTURE.md):
rider requests a trip, a driver accepts, the trip is tracked through simple
status updates, and the fare is settled in cash at completion. No live GPS
tracking, mobile money, or admin dashboard yet — those are Phase 2/3.

## Running locally

```bash
cp .env.example .env
docker compose up -d          # starts Postgres (and Redis, reserved for Phase 2)
npm install
npm run start:dev
```

The API listens on `http://localhost:3000`. Tables are created automatically
via TypeORM `synchronize` for local dev — swap for real migrations before
this touches a shared or production database.

## Auth

Phone + OTP, dev-mode only: `POST /auth/request-otp` logs a 4-digit code to
the server console instead of sending an SMS. Exchange it for a JWT with
`POST /auth/verify-otp`.

## Core endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/request-otp` | — | Request a login code |
| POST | `/auth/verify-otp` | — | Verify code, get a JWT (registers on first use) |
| GET | `/users/me` | any | Current user profile |
| POST | `/drivers/register` | driver | Create a driver profile (pending approval) |
| POST | `/drivers/vehicle` | driver | Register a vehicle |
| PATCH | `/drivers/online` | driver | Go online/offline (must be approved) |
| PATCH | `/drivers/:driverId/approve` | admin | Approve a driver (stand-in for the Phase 3 admin dashboard) |
| POST | `/trips` | rider | Request a trip |
| GET | `/trips/available` | driver | List open trip requests |
| PATCH | `/trips/:id/accept` | driver | Accept a trip |
| PATCH | `/trips/:id/arrived` | driver | Mark arrived at pickup |
| PATCH | `/trips/:id/start` | driver | Start the trip |
| PATCH | `/trips/:id/complete` | driver | Complete the trip, record the cash fare |
| PATCH | `/trips/:id/cancel` | rider | Cancel a not-yet-started trip |
| GET | `/trips/mine` | rider | Trip history |
| GET | `/trips/:id` | any | Trip detail |

## What's deliberately not here yet

- No live driver location / WebSocket tracking (Phase 2)
- No mobile money integration (Phase 2)
- No PostGIS radius-based matching — `GET /trips/available` just lists all
  open requests, since the Phase 1 driver pool is small (Phase 2+)
- No admin web dashboard (Phase 3) — driver approval is a single REST call
