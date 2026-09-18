# Monze Ride — Backend

NestJS + TypeORM/PostgreSQL API implementing
[`docs/MONZE_RIDE_ARCHITECTURE.md`](../docs/MONZE_RIDE_ARCHITECTURE.md):
rider requests a trip, a driver accepts, the trip is tracked through simple
status updates, and the fare is settled either in cash or via mobile money.
No live GPS tracking or admin dashboard yet — those are Phase 3.

## How the platform (admin) makes money

Every completed trip deducts a **commission** from the fare into the
platform's favor — this is how "admin" benefits from each transaction, not
just from running the app. See
[`src/config/commission.config.ts`](src/config/commission.config.ts) for the
rates:

| Vehicle type | Commission |
|---|---|
| Car (sedan) | 15% |
| Minibus | 12% |
| Motorbike | 10% |

Motorbikes get the lowest rate on purpose — it keeps the platform attractive
to Monze's fast-growing boda-boda supply. How the commission actually moves
depends on the payment method:

- **Cash**: the driver already holds the full fare, so the commission is
  recorded as a **debt** in their [`Wallet`](src/entities/wallet.entity.ts)
  (a negative balance) until they settle it with an admin.
- **Mobile money (MTN MoMo / Airtel Money)**: the platform collects the
  fare directly from the rider, so the driver's net share (fare minus
  commission) is **credited** to their wallet (a positive balance) as soon
  as the payment clears — payable out to the driver's phone on request.

A driver who owes more than K100 in unpaid commission is blocked from going
online again (`MIN_WALLET_BALANCE_TO_GO_ONLINE`) until an admin clears some
of it via `POST /drivers/:driverId/wallet/settlements`. Every commission
deduction, mobile-money credit, settlement, and payout is an immutable
`LedgerEntry`, so a driver's balance is always reconstructable/auditable,
not just a mutable counter.

## Mobile money (Phase 2)

[`src/payments/`](src/payments) implements two flows against MTN Mobile
Money and Airtel Money:

- **Collections** — when a rider requests/completes a trip with
  `paymentMethod: "momo"` or `"airtel"`, `PaymentsService.initiateMobileMoneyPayment`
  fires a request-to-pay against the rider's phone. The trip itself
  completes immediately (the ride is over); the `Payment` stays `pending`
  until the provider confirms it, via `POST /payments/webhooks/momo` or
  `/airtel` in production.
- **Disbursements** — once a driver has a positive wallet balance (from
  mobile-money trip earnings), `POST /payments/payout` sends it to their
  phone.

**No real MTN/Airtel sandbox credentials exist in this repo.**
[`MobileMoneyService`](src/payments/mobile-money.service.ts) only logs what
it would send and returns a fake reference. In dev mode
(`MOBILE_MONEY_DEV_AUTO_COMPLETE=true`, the default), a pending collection
auto-resolves as successful after `MOBILE_MONEY_DEV_AUTO_COMPLETE_DELAY_MS`
(default 3s) instead of waiting for a real webhook, so the end-to-end flow
is testable locally. Before this touches real money:

1. Replace `MobileMoneyService`'s two methods with real Collections/
   Disbursements API calls (MTN MoMo and Airtel Money each have their own
   REST APIs and sandbox).
2. Set `MOBILE_MONEY_DEV_AUTO_COMPLETE=false`.
3. Replace `WebhookSecretGuard`'s shared-secret check with real provider
   signature verification, and adapt each provider's actual callback
   payload into the normalized `ProviderCallbackDto` shape.

## Running locally

```bash
cp .env.example .env
docker compose up -d          # starts Postgres (and Redis, reserved for Phase 2 live tracking)
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
| POST | `/trips` | rider | Request a trip (`paymentMethod`: cash / momo / airtel) |
| GET | `/trips/available` | driver | List open trip requests |
| PATCH | `/trips/:id/accept` | driver | Accept a trip |
| PATCH | `/trips/:id/arrived` | driver | Mark arrived at pickup |
| PATCH | `/trips/:id/start` | driver | Start the trip |
| PATCH | `/trips/:id/complete` | driver | Complete the trip, record/collect the fare |
| PATCH | `/trips/:id/cancel` | rider | Cancel a not-yet-started trip |
| GET | `/trips/mine` | rider | Trip history |
| GET | `/trips/:id` | any | Trip detail |
| GET | `/trips/:id/payment` | any | This trip's payment (status, method) — `null` if not created yet |
| GET | `/payments/:id` | any | Payment detail by id |
| POST | `/payments/payout` | driver | Cash out a positive wallet balance to mobile money |
| POST | `/payments/webhooks/momo` | webhook secret | MTN MoMo provider callback |
| POST | `/payments/webhooks/airtel` | webhook secret | Airtel Money provider callback |

## What's deliberately not here yet

- No live driver location / WebSocket tracking (Phase 2, remaining)
- No PostGIS radius-based matching — `GET /trips/available` just lists all
  open requests, since the Phase 1 driver pool is small (Phase 2+)
- No admin web dashboard (Phase 3) — driver approval and settlements are
  single REST calls
- `GET /payments/:id` and `GET /trips/:id/payment` don't check the caller
  is actually the trip's rider/driver — fine for this scaffold, not for
  production
