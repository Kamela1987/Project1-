# Monze Ride — Backend

NestJS + TypeORM/PostgreSQL API implementing
[`docs/MONZE_RIDE_ARCHITECTURE.md`](../docs/MONZE_RIDE_ARCHITECTURE.md):
rider requests a trip, a driver accepts, the trip is tracked live via
WebSocket, the fare is settled either in cash or via mobile money, the
rider rates the driver afterward, and an ops team runs driver approval,
live monitoring, fare configuration, and dispute resolution through the
[admin dashboard](../admin).

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

## Live location tracking (Phase 2)

[`src/realtime/`](src/realtime) adds a WebSocket gateway (Socket.IO) for
live driver location, backed by the Redis instance `docker-compose.yml`
provisioned back in Phase 1 for exactly this:

- Driver app connects with `auth: { token: <JWT> }` and emits
  `driver:location` (`{ tripId, lat, lng }`) while the trip is
  accepted/arrived/in-progress.
- Rider (and driver) apps emit `trip:subscribe` (`{ tripId }`) to join that
  trip's room and receive `driver:location` broadcasts. The gateway checks
  the caller is actually the trip's rider or its assigned driver before
  letting them subscribe.
- A driver's position lives in Redis with a 60s TTL — no Postgres writes on
  every GPS ping, and a stale/disconnected driver's location naturally
  expires instead of showing a rider a frozen pin forever.
- `GET /trips/:id/location` is the REST fallback for the offline/
  low-connectivity path described in the architecture doc §6.4 — same data,
  polled instead of pushed.

Verified against a real local Postgres + Redis (not just a build): a driver
socket streaming a position, a rider socket subscribed to that trip
receiving the broadcast, the REST endpoint reflecting the same value, a
bad-token connection getting rejected, and a socket for an uninvolved user
being refused a subscription.

## Post-trip ratings (Phase 2)

[`src/ratings/`](src/ratings) is a small sibling module — no cross-module
dependencies, just its own `Rating` repository — wired into both
`TripsController` and `DriversController`:

- `POST /trips/:id/rating` — rider-only, one rating per trip. The unique
  constraint on `Rating.tripId` is the real "once per trip" guard (a
  duplicate submit gets caught and rethrown as `409 Conflict`); the
  controller also checks the caller is that trip's rider and the trip is
  `completed` with a driver assigned before it even tries.
- `GET /trips/:id/rating` — `null` until rated.
- `GET /drivers/me/rating` — the driver's own aggregate (`{ average, count }`),
  computed with `AVG()`/`COUNT()` over their ratings rather than a stored
  running total: unlike `Wallet.balance`, a rating is written once and never
  revised, so there's no reconciliation to earn its keep — the query is
  cheap and always correct.

Verified against a real local Postgres (not just a build): submitting a
rating, a duplicate submission correctly rejected with 409, a non-rider
correctly rejected with 403, rating an in-progress (not yet completed) trip
correctly rejected with 400, and the aggregate's running average confirmed
correct across two ratings (5 and 2 stars → 3.5), not just that the field
exists.

## Admin dashboard & driver approval (Phase 3)

The [`admin/`](../admin) React app is the ops team's front end. It needs
new backend surface beyond `PATCH /drivers/:driverId/approve` (already
there since Phase 1): `GET /drivers` (the onboarding queue, filterable by
`verificationStatus`), `GET /drivers/:driverId` (full profile merged with
wallet balance and rating — same shape as the driver's own `me/wallet` +
`me/rating`, just admin-facing), `GET /trips` (every trip, filterable by
status, for live monitoring), [`src/zones/`](src/zones) +
[`src/fare-rules/`](src/fare-rules) (zone + per-vehicle-type fare rule CRUD
— see caveat below), and [`src/disputes/`](src/disputes) (either party on a
trip can raise one via `POST /trips/:id/rating`'s sibling
`POST /trips/:id/disputes`; an admin resolves it).

**Security fix that came with this**: `AuthService.verifyOtp` used to trust
a client-supplied `role: "admin"` on signup — anyone could self-register as
admin. It now rejects that outright; the only way to create an admin
account is the out-of-band `npm run seed:admin -- <phone> <name>` script
(see [`src/scripts/create-admin.ts`](src/scripts/create-admin.ts)), which
writes directly to the database rather than going through the API.

**Zones/fare rules aren't consumed by trip pricing yet** — fare is still
manually entered by the driver at completion (unchanged since Phase 1).
This is a real, working CRUD surface for an admin to configure ahead of
time, honestly not yet wired into `TripsService.complete()`'s fare
calculation — that's an automated-fare-estimate feature for a later phase
(architecture doc §6.3, §9 Phase 4).

Verified end-to-end (not just built): the whole admin surface driven
through curl against a real Postgres + Redis (self-registration-as-admin
correctly rejected, onboarding queue → approve → detail view, live trip
filtering by status, zone/fare-rule CRUD including the duplicate-name and
duplicate-zone+vehicle-type rejections, a dispute raised by each side of a
trip and rejected for an uninvolved user, admin resolve), **and** the
`admin/` React app itself driven through a headless-Chromium Playwright
script against that same running backend — login, approve a driver via the
UI, watch the trips table, create/delete a zone and fare rule, and resolve
a dispute, all confirmed to actually change what's on screen.

## Trip-data access control

`GET /trips/:id`, `GET /trips/:id/payment`, `GET /trips/:id/location`,
`GET /trips/:id/rating`, `GET /trips/:id/disputes`, and `GET /payments/:id`
used to be readable by **any authenticated user** — a rider could look up
another rider's trip, payment, or live location just by guessing/enumerating
a UUID. Building out the admin dashboard's own trip lookups made this hole
obvious, so it's fixed: each of these now checks the caller is that trip's
rider, its assigned driver, or an admin (`TripsController.assertTripParticipantOrAdmin`,
mirrored in `PaymentsController.findById` via a denormalized `Payment.riderId`
column added for exactly this check, the same pattern `Payment.driverId`
already used for the wallet-crediting webhook flow).

Verified against a real local Postgres: a rider, the trip's driver, and an
admin can each read all six endpoints for a real trip; an uninvolved third
account gets `403 Forbidden` from all six.

## Database migrations

`synchronize: true` (auto-diffing the schema from entities on every boot,
no history, no rollback) is gone. Schema changes are now real TypeORM
migrations in [`src/migrations/`](src/migrations), applied via
[`src/data-source.ts`](src/data-source.ts) (a plain, CLI-importable
`DataSource` — kept separate from `AppModule`'s `TypeOrmModule.forRootAsync`,
which still gets its config through Nest's `ConfigService`; the two are
intentionally not shared code, just kept in sync by hand, since the CLI has
no DI container to hand a config service to):

```bash
npm run migration:generate -- src/migrations/SomeChange   # after editing an entity
npm run migration:run                                      # apply pending migrations
npm run migration:revert                                    # roll back the last one
```

`AppModule` sets `migrationsRun: true`, so `npm run start:dev` still applies
pending migrations automatically for local dev convenience — a real
deployment would run `npm run migration:run` as its own step instead of
relying on app boot to touch the schema.

Generating the initial migration caught a real bug: several denormalized
foreign-key-style columns (`Payment.driverId`/`riderId`, `Wallet.driverId`,
`LedgerEntry.tripId`, `Rating.driverId`/`riderId`, `Dispute.raisedByUserId`)
had no backing TypeORM relation for the column type to be inferred from, so
they'd been silently created as `varchar` instead of `uuid` this whole time
under `synchronize`. All now explicitly typed `@Column('uuid', ...)`.

Verified against a real local Postgres: generated the initial migration,
confirmed `migration:generate` then reports "no changes" (entities and
migration match exactly), ran a full trip lifecycle end-to-end against the
migrated (not synchronized) schema, and confirmed `migration:revert` cleanly
drops everything it created.

## Running locally

```bash
cp .env.example .env
docker compose up -d          # starts Postgres and Redis
npm install
npm run start:dev
```

The API listens on `http://localhost:3000`. Tables are created by running
the migrations in [`src/migrations/`](src/migrations) — `npm run start:dev`
applies any pending ones automatically (`migrationsRun: true`); see
"Database migrations" above.

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
| GET | `/drivers/me/rating` | driver | Own aggregate rating (`{ average, count }`) |
| GET | `/drivers` | admin | Onboarding queue / all drivers (`?status=pending`) |
| GET | `/drivers/:driverId` | admin | Full driver profile + wallet balance + rating |
| PATCH | `/drivers/:driverId/approve` | admin | Approve a driver |
| POST | `/drivers/:driverId/wallet/settlements` | admin | Record a driver paying down commission owed |
| POST | `/trips` | rider | Request a trip (`paymentMethod`: cash / momo / airtel) |
| GET | `/trips/available` | driver | List open trip requests |
| PATCH | `/trips/:id/accept` | driver | Accept a trip |
| PATCH | `/trips/:id/arrived` | driver | Mark arrived at pickup |
| PATCH | `/trips/:id/start` | driver | Start the trip |
| PATCH | `/trips/:id/complete` | driver | Complete the trip, record/collect the fare |
| PATCH | `/trips/:id/cancel` | rider | Cancel a not-yet-started trip |
| GET | `/trips/mine` | rider | Trip history |
| GET | `/trips` | admin | Every trip, live-monitoring feed (`?status=in_progress` etc.) |
| GET | `/trips/:id` | participant/admin | Trip detail |
| GET | `/trips/:id/location` | participant/admin | Driver's last-known live position — REST fallback for the WebSocket, `null` if unavailable |
| GET | `/trips/:id/payment` | participant/admin | This trip's payment (status, method) — `null` if not created yet |
| POST | `/trips/:id/rating` | rider | Rate the driver on a completed trip (once per trip) |
| GET | `/trips/:id/rating` | participant/admin | This trip's rating — `null` if not rated yet |
| POST | `/trips/:id/disputes` | rider, driver (participant) | Raise a dispute on your own trip |
| GET | `/trips/:id/disputes` | participant/admin | This trip's disputes |
| GET | `/payments/:id` | participant/admin | Payment detail by id |
| POST | `/payments/payout` | driver | Cash out a positive wallet balance to mobile money |
| POST | `/payments/webhooks/momo` | webhook secret | MTN MoMo provider callback |
| POST | `/payments/webhooks/airtel` | webhook secret | Airtel Money provider callback |
| POST | `/zones` | admin | Create a pricing zone |
| GET | `/zones` | any | List zones |
| DELETE | `/zones/:id` | admin | Delete a zone (cascades its fare rules) |
| POST | `/zones/:zoneId/fare-rules` | admin | Add a fare rule for a zone + vehicle type |
| GET | `/zones/:zoneId/fare-rules` | any | List a zone's fare rules |
| DELETE | `/fare-rules/:id` | admin | Delete a fare rule |
| GET | `/disputes` | admin | Dispute inbox (`?status=open`/`resolved`) |
| PATCH | `/disputes/:id/resolve` | admin | Resolve a dispute with a required note |

## WebSocket events (`src/realtime/location.gateway.ts`)

Connect with `io(baseUrl, { auth: { token: jwt } })`.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| Client → Server | `trip:subscribe` | `{ tripId }` | Join a trip's room; rejected if you're not its rider or assigned driver |
| Client → Server | `driver:location` | `{ tripId, lat, lng }` | Driver only; ignored unless the trip is accepted/arrived/in-progress and assigned to them |
| Server → Client | `driver:location` | `{ tripId, lat, lng, updatedAt }` | Broadcast to the trip's room, and sent immediately on subscribe if a position is already cached |
| Server → Client | `error` | string | Auth failure or a rejected subscribe/update |

## What's deliberately not here yet

- No PostGIS radius-based matching — `GET /trips/available` just lists all
  open requests, since the Phase 1 driver pool is small (Phase 2+)
- Zone/fare-rule config isn't consumed by trip pricing yet — see the admin
  dashboard section above
- No pagination on `GET /drivers` or `GET /trips` — fine at Monze's scale
- No audit trail of which admin approved a driver or resolved a dispute —
  every admin account has the same capabilities today
