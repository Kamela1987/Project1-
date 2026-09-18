# Monze Ride — Backend (Phase 1)

NestJS + TypeORM/PostgreSQL API implementing the Phase 1 core loop from
[`docs/MONZE_RIDE_ARCHITECTURE.md`](../docs/MONZE_RIDE_ARCHITECTURE.md):
rider requests a trip, a driver accepts, the trip is tracked through simple
status updates, and the fare is settled in cash at completion. No live GPS
tracking, mobile money, or admin dashboard yet — those are Phase 2/3.

## How the platform (admin) makes money

Every completed trip deducts a **commission** from the fare into the
platform's favor — this is how "admin" benefits from each transaction, not
just from running the app. Since Phase 1 is cash-only, the driver keeps the
full fare in hand and the commission is instead recorded as a debt in their
[`Wallet`](src/entities/wallet.entity.ts), which they settle later (in
person, or a future in-app MoMo payment). See
[`src/config/commission.config.ts`](src/config/commission.config.ts) for the
rates:

| Vehicle type | Commission |
|---|---|
| Car (sedan) | 15% |
| Minibus | 12% |
| Motorbike | 10% |

Motorbikes get the lowest rate on purpose — it keeps the platform attractive
to Monze's fast-growing boda-boda supply. A driver who owes more than
K100 in unpaid commission is blocked from going online again
(`MIN_WALLET_BALANCE_TO_GO_ONLINE`) until an admin (or the driver, once
in-app settlement exists) clears some of the balance via
`POST /drivers/:driverId/wallet/settlements`. Every commission deduction and
settlement is an immutable `LedgerEntry`, so the driver's balance is always
reconstructable/auditable, not just a mutable counter.

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
| PATCH | `/drivers/online` | driver | Go online/offline (must be approved, and not owing too much commission) |
| GET | `/drivers/me/wallet` | driver | Own commission balance + ledger history |
| PATCH | `/drivers/:driverId/approve` | admin | Approve a driver (stand-in for the Phase 3 admin dashboard) |
| POST | `/drivers/:driverId/wallet/settlements` | admin | Record a driver paying down commission owed |
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
