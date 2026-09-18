# Monze Ride — Admin Dashboard (Phase 3)

React + TypeScript + Tailwind web app for the ops team, implementing the
Phase 3 slice of [`docs/MONZE_RIDE_ARCHITECTURE.md`](../docs/MONZE_RIDE_ARCHITECTURE.md):
driver onboarding & approval, live trip monitoring, zone/fare-rule
configuration, and dispute handling — against the [backend](../backend).

## Status

Unlike the two Flutter apps in `mobile/`, this one **was actually run and
driven end-to-end**: `npm run build` passes, and a Playwright script
(headless Chromium) logged in, approved a driver, watched the trips table,
created a zone and fare rule then deleted them, and resolved a dispute —
all against a real local Postgres + Redis backend, not mocked data. See the
screenshots in the PR/commit this shipped with.

## Running locally

```bash
cp .env.example .env      # points at the backend; edit if it's not on localhost:3000
npm install
npm run dev                # http://localhost:5173
```

The backend must be running (`cd ../backend && npm run start:dev`) and you
need at least one admin account — self-service signup can never create one
(see "Getting an admin account" below).

## Getting an admin account

There is **no signup form** in this app on purpose. `AuthService.verifyOtp`
on the backend rejects `role: "admin"` from any client request — the only
way to create one is the out-of-band script:

```bash
cd ../backend
npm run build && npm run seed:admin -- +260955000000 "Site Admin"
```

Then log in here with that phone number via the same OTP flow the mobile
apps use (the code is logged to the backend console in dev mode).

## What's here

- `src/contexts/AuthContext.tsx` — phone/OTP login; refuses to keep a
  session for a non-admin account even if the backend somehow returned one
- `src/screens/DriversScreen.tsx` — onboarding queue (pending/approved/all
  tabs), approve action, a detail view with wallet balance, rating, and a
  commission-settlement form for drivers who owe the platform
- `src/screens/TripsScreen.tsx` — every trip, filterable by status, polled
  every 5s — the live-monitoring feed
- `src/screens/ZonesScreen.tsx` — zone + per-vehicle-type fare rule CRUD.
  **Not wired into trip pricing yet** — Phase 1/2 kept fares manually
  entered by the driver at completion (see backend/README.md); this is
  where an admin configures rates ahead of a future automated fare
  estimate (architecture doc §6.3, §9 Phase 4)
- `src/screens/DisputesScreen.tsx` — open/resolved inbox, resolve action
  with a required resolution note

## Known gaps (by design)

- No pagination on any list — fine at Monze's scale, not forever
- No live-updating trips list beyond polling (no WebSocket subscription
  the way the mobile apps get live driver location)
- No audit log of *which* admin approved/resolved what — every admin
  shares the same capabilities today
