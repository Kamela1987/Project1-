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

**Zones/fare rules feed the fare estimate (Phase 4)** — see "Zone-based
fare pricing" below. `TripsService.complete()`'s fare is still
driver-entered, deliberately unchanged (a cash fare agreed in person can
legitimately differ from any estimate).

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

`AppModule` sets `migrationsRun: true` by default (`MIGRATIONS_RUN` env
var), so `npm run start:dev` still applies pending migrations
automatically for local dev convenience. The Docker image sets
`MIGRATIONS_RUN=false` and runs migrations as an explicit deploy step
instead — see "Deployment" below.

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

## Deployment

`Dockerfile` is a multi-stage build: a `build` stage with full
`devDependencies` compiles TypeScript to `dist/`, then a `runtime` stage
installs only production dependencies and copies in the compiled output —
no source, no dev tooling, in the image that actually runs.

`docker-entrypoint.sh` runs `npm run migration:run:prod` (the plain
`typeorm` CLI against the compiled `dist/data-source.js` — no `ts-node`
needed in the runtime image) before `exec`ing into the app, but only when
`MIGRATIONS_RUN=false`. That's deliberate: if you scale to more than one
backend instance, you don't want every replica racing to apply migrations
on every boot, so migrations become a one-time step ahead of the rollout
instead of something app boot does implicitly (`AppModule`'s
`migrationsRun: true` default is for local dev convenience only, see
"Database migrations" above).

```bash
docker build -t monze-ride-backend .
# or, to sanity-check the built image against real Postgres/Redis containers:
docker compose -f docker-compose.prod.yml up --build
```

Required env vars in production (see `.env.example` for the full list,
including the SMS/mobile-money provider credentials from the sections
above): `JWT_SECRET`, `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME`,
`REDIS_HOST`/`REDIS_PORT`, `MOBILE_MONEY_WEBHOOK_SECRET`, and
`MIGRATIONS_RUN=false` (paired with running `npm run migration:run:prod`
as its own deploy step — the entrypoint does this automatically inside
the container). `GET /health` returns `{ ok: true }` once the app has a
live DB connection — point your platform's health check / load balancer
at it.

Deployable to any container host (Fly.io, Render, a plain VPS with Docker
Compose, ECS, etc.) — nothing here is platform-specific beyond needing a
reachable **PostGIS-enabled** Postgres (see "Zone-based fare pricing"
below — `postgis/postgis`, not plain `postgres`) and Redis.

Verified locally (no Docker daemon available in this dev environment, so
the image build/compose orchestration itself is unverified): built and
linted clean, ran `migration:run:prod` against a real Postgres with
`ts-node` absent from the command (confirming the CLI path the container
actually uses), booted the compiled `dist/main.js` with
`MIGRATIONS_RUN=false`, and confirmed `GET /health` returns `{ ok: true }`
— the same sequence `.github/workflows/backend-ci.yml` runs on every push.

## CI

- **`.github/workflows/backend-ci.yml`** — on changes under `backend/`:
  install, lint, build, run `migration:run:prod` against a real Postgres
  service container, boot the compiled app against that Postgres + a Redis
  service container and poll `GET /health` as a smoke test, then build the
  Docker image to catch any drift between the image and what CI just
  verified.
- **`.github/workflows/admin-ci.yml`** — on changes under `admin/`:
  install, lint, build.

Neither mobile app has a CI workflow — there's no Flutter SDK available in
this project's dev/CI environment to run one against (see each app's
README).

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

Phone + OTP: `POST /auth/request-otp` issues a 4-digit code (5 min TTL,
30s resend cooldown per phone number — see `src/auth/otp.store.ts`) and
sends it via `src/auth/sms.service.ts`. Exchange it for a JWT with
`POST /auth/verify-otp`.

**SMS delivery** is real, not a stand-in like `mobile-money.service.ts` —
it goes through [Africa's Talking](https://africastalking.com/), which
reaches MTN, Airtel, and Zamtel numbers through one API (unlike mobile
money, which needs a separate integration per network). Set
`AFRICASTALKING_USERNAME` and `AFRICASTALKING_API_KEY` (see
`.env.example`) to send for real; leave them unset for local dev/CI and
the OTP is logged to the console instead (`[SmsService] [DEV] SMS to
...`), with no network call made.

## Core endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/request-otp` | — | Request a login code |
| POST | `/auth/verify-otp` | — | Verify code, get a JWT (registers on first use; optional `referralCode`) |
| GET | `/users/me` | any | Current user profile |
| GET | `/users/me/referrals` | any | Own referral code, credit balance, and reward history |
| POST | `/drivers/register` | driver | Create a driver profile (pending approval) |
| POST | `/drivers/vehicle` | driver | Register a vehicle |
| PATCH | `/drivers/online` | driver | Go online/offline (must be approved, and not owing too much commission) |
| GET | `/drivers/me/wallet` | driver | Own commission balance + ledger history |
| PATCH | `/drivers/me/payout-settings` | driver | Opt in/out of automatic payouts, set payout provider |
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
| GET | `/trips` | admin | Every trip, live-monitoring feed (`?status=in_progress`, `?townId=`) |
| GET | `/trips/:id` | participant/admin | Trip detail |
| GET | `/trips/:id/location` | participant/admin | Driver's last-known live position — REST fallback for the WebSocket, `null` if unavailable |
| GET | `/trips/:id/payment` | participant/admin | This trip's payment (status, method) — `null` if not created yet |
| POST | `/trips/:id/rating` | rider | Rate the driver on a completed trip (once per trip) |
| GET | `/trips/:id/rating` | participant/admin | This trip's rating — `null` if not rated yet |
| POST | `/trips/fare-estimate` | any | Estimated fare for a pickup/dropoff, before requesting |
| POST | `/trips/:id/disputes` | rider, driver (participant) | Raise a dispute on your own trip |
| GET | `/trips/:id/disputes` | participant/admin | This trip's disputes |
| GET | `/payments/:id` | participant/admin | Payment detail by id |
| POST | `/payments/payout` | driver | Cash out a positive wallet balance to mobile money |
| POST | `/payments/auto-payouts/run` | admin | Run the automatic payout sweep on demand |
| POST | `/payments/webhooks/momo` | webhook secret | MTN MoMo provider callback |
| POST | `/payments/webhooks/airtel` | webhook secret | Airtel Money provider callback |
| POST | `/zones` | admin | Create a pricing zone (optionally with a `boundary` polygon and/or `townId`) |
| GET | `/zones` | any | List zones (`?townId=` to narrow to one town) |
| DELETE | `/zones/:id` | admin | Delete a zone (cascades its fare rules) |
| POST | `/zones/:zoneId/fare-rules` | admin | Add a fare rule for a zone + vehicle type |
| GET | `/zones/:zoneId/fare-rules` | any | List a zone's fare rules |
| DELETE | `/fare-rules/:id` | admin | Delete a fare rule |
| POST | `/towns` | admin | Create a town (optionally with a `boundary` polygon) |
| GET | `/towns` | any | List towns |
| DELETE | `/towns/:id` | admin | Delete a town |
| GET | `/disputes` | admin | Dispute inbox (`?status=open`/`resolved`) |
| PATCH | `/disputes/:id/resolve` | admin | Resolve a dispute with a required note |

## WebSocket events (`src/realtime/location.gateway.ts`)

Connect with `io(baseUrl, { auth: { token: jwt } })`.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| Client → Server | `trip:subscribe` | `{ tripId }` | Join a trip's room; rejected if you're not its rider or assigned driver |
| Client → Server | `driver:location` | `{ tripId?, lat, lng }` | Driver only, and only while online. `tripId` is optional: omit it for an idle ping (just updates the driver's cached position for matching, see below); include it to also broadcast to that trip's room, which additionally requires the trip to be accepted/arrived/in-progress and assigned to them |
| Server → Client | `driver:location` | `{ tripId, lat, lng, updatedAt }` | Broadcast to the trip's room, and sent immediately on subscribe if a position is already cached |
| Server → Client | `error` | string | Auth failure or a rejected subscribe/update |

## Driver matching (`GET /trips/available`)

Sorted by distance from the requesting driver's last-known position, when
one is cached. The driver app streams an **idle** `driver:location` ping
(no `tripId`) as soon as the driver goes online — see the WebSocket table
above — which `LocationService` caches in Redis (60s TTL, same cache used
for live trip tracking). `TripsService.listAvailable` reads that cached
position, computes a haversine distance to each open trip's pickup point,
and sorts ascending; a driver who hasn't pinged a position yet (or whose
ping expired) still gets the full list, just in chronological order —
nothing is ever filtered out by distance, only reordered. Going offline
(`PATCH /drivers/me/online`) clears the driver's cached position
immediately. Once multi-town support is configured (see below), the same
cached position also scopes this list to the driver's own town — that's
the one case something *is* filtered out, not just reordered.

This intentionally reuses the Redis live-location cache rather than adding
PostGIS: Redis was already the architecture's assigned store for "where are
all online drivers right now" (see `docs/MONZE_RIDE_ARCHITECTURE.md` §7),
and a driver's own request list is small enough that in-process haversine
sorting is enough. Still not built: active push/offer dispatch to a driver
with an accept timeout (right now drivers just poll/see the sorted list),
and PostGIS-based zone-boundary geofencing, which remains a separate
feature (pricing zones, not driver matching).

## Zone-based fare pricing (Phase 4)

`POST /trips/fare-estimate` (`TripsService.estimateFare`) is the rider's
"what will this roughly cost" step, ahead of requesting a trip — it
computes the architecture doc's §6.3 formula
(`base_fare + distance_km * per_km_rate + est_duration_min * per_min_rate`)
using whichever zone's boundary polygon contains the pickup point:

1. A zone can now have a `boundary` — a PostGIS `geometry(Polygon, 4326)`
   column (see `src/migrations/*-ZoneBoundary.ts`), set via `POST /zones`'s
   optional `boundary` field (a single ring of `[lng, lat]` pairs, GeoJSON
   coordinate order, first/last point equal). Existing zones without one
   still work as plain pricing buckets — they just never match a pickup
   point.
2. `ZonesService.findContainingPoint(lat, lng)` runs `ST_Contains` to find
   which zone (if any) a pickup falls inside. No match → the estimate
   response comes back with `zoneId: null` and no estimates, not an error.
3. Distance is the same `haversineKm` used for driver matching above.
   Duration has no real routing/traffic API behind it (that's further
   future work) — it's `distanceKm` at a flat assumed 25 km/h town-driving
   speed, good enough for a ballpark, not an ETA claim.
4. One estimate line per vehicle type priced in that zone (or just the
   requested `vehicleType`, if given) — a vehicle type with no fare rule
   in that zone is silently skipped, not an error.

This **never touches trip completion** — `TripsService.complete()` still
takes a driver-entered `fareAmount`, deliberately unchanged, since a cash
fare agreed in person (detours, waiting time, haggling) can legitimately
differ from an estimate.

**Needs a PostGIS-enabled Postgres**, not plain `postgres` — both
`docker-compose.yml` and `docker-compose.prod.yml` use
`postgis/postgis:16-3.4`, as does `backend-ci.yml`'s Postgres service
container. The migration's `CREATE EXTENSION IF NOT EXISTS postgis` relies
on that image having already installed the extension into the target
database at container init (its non-superuser app role can't create the
extension itself) — see the migration's own comment.

No admin-UI map for drawing a zone's boundary — `boundary` is set via the
API's raw coordinate array. Drawing polygons on a map is a real chunk of
frontend work on its own; out of scope for this pass.

Verified against a real local Postgres with PostGIS installed (simulating
the `postgis/postgis` image's init-time extension setup, since a plain
Postgres install has no such image to fall back on locally): created a
zone with a real boundary around a test "town center" square, added
sedan/motorbike fare rules, confirmed a pickup inside the boundary returns
correctly-computed per-vehicle-type estimates (verified the arithmetic by
hand), confirmed a pickup outside every zone's boundary returns
`zoneId: null` with no estimates rather than an error, confirmed a vehicle
type with no rate card in that zone is silently omitted, confirmed a
malformed (non-closed-ring) boundary is rejected with 400, and confirmed a
zone created with no boundary at all still works exactly as before this
feature. `migration:generate` reports "no changes" afterward (entities and
migration match exactly).

## Driver payout automation (Phase 4)

Until now, a driver's wallet balance (built up from mobile-money trip
earnings — see "Mobile money" above) only ever left their wallet if they
remembered to hit `POST /payments/payout` themselves. This adds an
opt-in scheduled sweep that pays it out for them automatically:

1. `PATCH /drivers/me/payout-settings` — a driver opts in
   (`autoPayoutEnabled: true`) and picks which mobile money provider
   (`payoutMethod`, `"momo"` or `"airtel"`) to be paid out to.
   `payoutMethod` is required the first time (either in the same request
   or already stored from before) — `DriversService.updatePayoutSettings`
   rejects enabling it with neither. A driver who never opts in is
   completely unaffected; the on-demand `POST /payments/payout` flow is
   unchanged.
2. `PaymentsService.runAutoPayouts()` sweeps every approved, opted-in
   driver's **full** wallet balance out, once it's at least
   `AUTO_PAYOUT_MIN_BALANCE` (default 50 ZMW — not worth a disbursement
   fee below that). Reuses the same disbursement + ledger logic as the
   on-demand payout (`PaymentsService`'s private `executePayout`), so a
   sweep produces an identical `payout` ledger entry either way. One
   driver's disbursement failing (e.g. the mock/real provider call
   throwing) never blocks the rest of the batch — failures are caught and
   counted per-driver, not fatal to the sweep.
3. `PayoutSchedulerService` registers `runAutoPayouts` on a cron schedule
   (`AUTO_PAYOUT_CRON`, default once daily at 02:00) — but only if
   `AUTO_PAYOUT_ENABLED=true`. **Off by default**: with it unset, the cron
   job isn't even registered (checkable at boot — nothing to wait on to
   confirm it's off), not just skipped when it would've fired.
4. `POST /payments/auto-payouts/run` (admin) runs the exact same sweep on
   demand — an ops escape hatch, and how this feature is verified without
   waiting for a cron to fire.

Verified against a real local Postgres + Redis: completed a mobile-money
trip to build up a driver's wallet balance, confirmed enabling
`autoPayoutEnabled` without a `payoutMethod` is rejected with 400,
enabled it with `momo`, triggered `POST /payments/auto-payouts/run` as
admin and confirmed the driver's full balance was paid out (wallet back
to 0, a `payout` ledger entry recorded, the mock disbursement logged),
confirmed a second sweep immediately after processes 0 drivers (nothing
left above the threshold), confirmed a driver role gets 403 on the
admin-only sweep endpoint, and confirmed `AUTO_PAYOUT_ENABLED=true` with
a custom `AUTO_PAYOUT_CRON` actually registers the job at boot (log line
confirmed) while the default (unset) registers nothing.

## Multi-town support (Phase 4)

Until now, driver matching had no concept of geography beyond distance —
a driver in one town would see (and be sorted alongside) every open trip
request platform-wide, just ranked last if it was far away. This adds a
**Town**: the same PostGIS boundary-polygon shape as Zone, one level up
the geographic hierarchy (a Town can contain many Zones — see below), and
uses it to scope driver-trip matching so a driver in one town never sees
another town's requests at all.

1. `POST /towns` (admin), `GET /towns` (any), `DELETE /towns/:id` (admin)
   — same CRUD shape as `/zones`, including the optional `boundary`
   field (a closed ring of `[lng, lat]` pairs) and the same "no boundary
   yet still works as a plain admin grouping" fallback.
2. `TripsService.request()` tags each new trip with its pickup's town
   (`Trip.townId`, computed once via `TownsService.findContainingPoint`
   and cached on the row — never recomputed). A pickup outside every
   configured town (or a deployment with no towns configured at all)
   gets `townId: null`.
3. `GET /trips/available` (`TripsService.listAvailable`) scopes to the
   requesting driver's own town, found the same way — via their cached
   position from the idle `driver:location` ping (see "Driver matching"
   above). A trip with `townId: null`, or a driver whose own town can't
   be determined, is **never** filtered out — town-scoping only ever
   hides a trip confidently placed in a *different* town. A single-town
   deployment with no `Town` rows configured at all behaves exactly as
   before this feature existed.
4. `GET /trips?townId=` (admin) and `GET /zones?townId=` narrow the
   admin dashboard's live-monitoring feed and zone list once more than
   one town exists. `Zone` gained an optional `townId` (`POST /zones`'s
   new `townId` field, 404s if it doesn't reference a real town) so an
   admin can group pricing zones under the town they belong to.

`Trip.townId` and `Zone.townId` are deliberately plain typed columns with
no FK constraint (same denormalized-reference style as
`Payment.driverId`/`riderId`) — a `Trip` is a permanent historical
record and must never cascade-delete just because a `Town` is removed
later.

Verified against a real local Postgres + Redis: created two
non-overlapping towns (Monze, Mazabuka) with real boundary polygons,
pinged two drivers' idle locations into each, requested one trip inside
each town plus one outside both — confirmed each driver's
`GET /trips/available` showed only their own town's trip plus the
town-less one (never the other town's), confirmed a driver who never
pinged a location still got the full unscoped list (all three trips,
chronological), confirmed the admin `?townId=` filter on `/trips`
returned only that town's trips, and confirmed a zone created with a
real `townId` linked correctly while one with a bogus `townId` was
rejected with 404. `migration:generate` reports "no changes" afterward.

**Caught along the way:** `src/data-source.ts` (the plain `DataSource`
the TypeORM CLI uses — see "Database migrations" above) keeps its own
entity list separate from `AppModule`'s, and had fallen out of sync —
`migration:generate` silently produced a migration missing the new
`Town` entity's table entirely until `Town` was added there too. Worth
knowing if a future entity addition's generated migration looks
suspiciously incomplete.

## Referral program (Phase 4)

Every user gets a referral code at signup; a new signup who enters someone
else's code, once they complete their first trip, credits the referrer —
the first of the two roadmap items grouped under "loyalty or referral
incentives" (surge pricing is the other, still not built — see below).

1. `ReferralsService.generateUniqueCode()` (`src/referrals/`) assigns
   every new user an 8-char code (`AuthService.verifyOtp`, on the same
   code path that creates the row — never a separate step). Out-of-band
   accounts (`scripts/create-admin.ts`) don't get one; `User.referralCode`
   is nullable for exactly that reason, not because the app's own signup
   path ever skips it.
2. `POST /auth/verify-otp` takes an optional `referralCode` — only
   consulted the first time a phone number registers. An unknown code
   rejects the signup with 400 (`ReferralsService.resolveReferrer`)
   rather than silently creating an unreferenced account; leaving it out
   is completely normal and unaffected.
3. `TripsService.complete()` counts the rider's total completed trips
   right after saving this one; when that count is exactly 1, it's their
   first ever, and `ReferralsService.rewardReferrerForFirstTrip` credits
   whoever referred them a flat `REFERRAL_REWARD_AMOUNT` (default 20
   ZMW) — a no-op if they weren't referred by anyone. This can only ever
   fire once per rider, by construction (a rider has exactly one "first
   completed trip" in their lifetime), so there's no separate idempotency
   check needed.
4. `GET /users/me/referrals` — a user's own code, accrued
   `referralCreditBalance`, how many people they've referred, and their
   full reward history.

**Deliberately a separate mechanism from the driver Wallet/LedgerEntry
system**, not a reuse of it: `Wallet` is keyed to `driverId` only (see
its entity comment), and a referrer is typically a rider, who has no
wallet at all today. `ReferralReward` is its own small append-only
ledger, and `User.referralCreditBalance` its own balance column — same
shape as `Wallet`/`LedgerEntry` in spirit, kept intentionally separate
rather than generalizing the driver-only Wallet to fit a second use case.

**Not yet built:** `referralCreditBalance` isn't automatically applied as
a discount on a future fare — cash fares are driver-entered manually at
completion (see "Zone-based fare pricing" above for why that's
deliberately untouched) and mobile-money fares go through a provider
request-to-pay for the full amount, so redeeming a credit against either
would mean changing the payment-collection flow itself, not just this
feature. Today the balance is informational (and, like driver commission
before payout automation existed, something an admin could settle
out-of-band) rather than self-service spendable. Also: the reward fires
on trip *completion*, not on the eventual mobile-money payment
*succeeding* (which resolves asynchronously, possibly after — see
"Mobile money" above) — a deliberate simplification, same as most
real-world "complete a ride" referral programs.

Verified against a real local Postgres + Redis: Rider A signs up (gets a
code, no referrer); an unknown referral code on signup is rejected with
400; Rider B signs up with Rider A's code (`referredByUserId` set
correctly); `GET /users/me/referrals` for Rider A shows `referredCount:
1` and no rewards yet; Rider B completes their first trip — Rider A's
balance jumps to 20 with a reward ledger row recorded; Rider B completes
a *second* trip — Rider A's balance and rewards are unchanged (fires
exactly once, confirmed); Rider B's own `/users/me/referrals` and the
out-of-band admin's (`referralCode: null`) both return cleanly with no
rewards. `migration:generate` reports "no changes" afterward. Lint +
build clean throughout.

## Surge pricing (Phase 4 — not built)

The architecture doc's §6.3 explicitly recommended against this at
launch ("Monze's market doesn't have the volume to make surge
meaningful — and transparent pricing builds trust in a new market"), so
it was deliberately skipped rather than half-built off-by-default. If
volume later justifies revisiting it, the natural hook is
`TripsService.estimateFare`'s per-zone-and-vehicle-type fare formula
(see "Zone-based fare pricing" above) — a time/demand-based multiplier
would apply there, gated behind its own env flag the same way
`AUTO_PAYOUT_ENABLED` gates driver payout automation, so it stays inert
unless explicitly turned on for a zone that's actually seeing demand
pressure.

## What's deliberately not here yet

- No pagination on `GET /drivers` or `GET /trips` — fine at Monze's scale
- No audit trail of which admin approved a driver or resolved a dispute —
  every admin account has the same capabilities today
