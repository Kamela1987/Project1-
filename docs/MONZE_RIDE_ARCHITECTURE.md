# Monze Ride-Hailing Platform — Architecture & Design Spec

*A Yango-style on-demand transport app, scoped and designed for Monze, Zambia.*

## 1. Overview & Product Framing

"An app like Yango" usually conjures Yango's full continental platform — rides,
deliveries, groceries, dynamic surge pricing, thousands of drivers. That is
the wrong target for Monze. Monze is a small town (roughly 50,000 people in
the urban area), served today by minibuses, a modest pool of private-hire
taxi drivers, and a fast-growing number of motorbike taxis (boda-bodas) who
mostly get hailed by phone call or roadside flag-down.

The right product is a **focused on-demand ride app**: a rider taps "request
a ride," the nearest available driver — car, minibus, **or motorbike**
— accepts, both sides track the trip live, and payment happens by cash or
mobile money. It should feel like Yango's core ride flow, stripped of
everything that only makes sense at national/continental scale.

Motorbikes deserve explicit product support, not a bolt-on: they are cheaper
per trip, faster through town congestion and market-day crowds, and able to
reach unpaved or narrow roads a car can't — which fits Monze's road network
better than a car-only model. Modeling them as a first-class vehicle type
from day one (see the data model in §5) also gives the platform a natural
lower-cost tier for price-sensitive riders and an easy entry point for
motorbike owners who couldn't otherwise afford to join as drivers.

Design constraints that shape every decision below:

| Constraint | Implication |
|---|---|
| Small, high-end-light driver pool (tens, not thousands) | Simple nearest-driver matching beats ML-based dispatch |
| Low-end Android devices dominate | Small APK size, low RAM/CPU footprint, aggressive caching |
| Patchy, metered mobile data | Minimize payload size, support graceful offline/SMS fallback |
| No formal street addressing in much of the town | Pickup by map-pin + landmark description, not address autocomplete |
| Cash-heavy economy, mobile money (MTN MoMo / Airtel Money) as digital rail | No assumption of card payments; mobile money and cash are first-class |
| Small dev budget / small team | Prefer one cross-platform mobile codebase, managed/cheap infra, avoid bespoke ML |

## 2. System Actors & Apps

- **Rider app** (Android-first mobile app) — request rides, track driver, pay, rate.
- **Driver app** (Android-first mobile app) — go online/offline, accept trip requests, navigate, collect payment, view earnings.
- **Admin/Dispatch web dashboard** — operations team: approve driver onboarding, monitor live trips, configure fares/zones, handle disputes and refunds, view analytics.
- **Backend platform** — shared API, matching engine, and data store behind all three.

## 3. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Rider + Driver apps | **Flutter** | One Dart codebase covers both apps and (with the same widgets) could later target iOS; compiles to small, fast native binaries that run well on low-end Android; strong offline-first tooling (local SQLite/Hive caching, connectivity-aware UI). Beats React Native on raw performance/footprint for this device profile, and beats native Kotlin on dev cost since one team maintains both apps. |
| Backend API | **Node.js + NestJS (TypeScript)** | Structured, testable service layout out of the box; huge ecosystem for payment/SMS integrations; easy to hire for regionally. |
| Primary database | **PostgreSQL + PostGIS** | PostGIS gives efficient "find nearest driver within radius" geospatial queries without a bespoke matching service. |
| Live location / matching cache | **Redis** ✅ scaffolded (`backend/src/realtime/location.service.ts` — 60s-TTL cache of each online driver's position) | Sub-second read/write for "where are all online drivers right now," trip-state pub/sub, and the request-matching queue. |
| Real-time transport | **WebSocket (Socket.IO)** ✅ scaffolded (`backend/src/realtime/location.gateway.ts`), with SMS fallback (not yet built) | Push live driver location and trip status to both apps; when a device drops off data, fall back to SMS for critical state changes (trip accepted, driver arrived, trip completed). |
| Admin dashboard | **React + TypeScript + Tailwind** ✅ scaffolded (`admin/`; plain Tailwind rather than shadcn, to keep the dependency footprint small for a scaffold) | Fast to build CRUD-heavy ops screens; same API as the mobile apps. |
| Payments | **MTN Mobile Money & Airtel Money APIs** (primary) ✅ scaffolded (`backend/src/payments/`, dev-mode simulated — no live provider credentials yet), cash (equally first-class, tracked in-app), card (future/optional via a gateway like Flutterwave/DPO if ever needed) | Matches how money actually moves in Monze today. |
| Maps | **Landmark-first pickup UX** on top of a map SDK — start with **Google Maps SDK** for reliability/familiarity, keep an **OpenStreetMap + self-hosted tiles** path open as a lower-cost fallback if API costs become a concern at scale | Formal addressing is sparse; the UI should let riders drop a pin and add a landmark note ("blue gate near Monze market") rather than rely on address search. |
| Push notifications | **Firebase Cloud Messaging** | Free, reliable, works well alongside Flutter. |
| Infra | **Docker containers**, deployed to a nearby low-cost cloud region (e.g. South Africa or EU — no in-country hyperscaler presence today); managed Postgres/Redis to start | Keeps ops overhead low for a small team; can move to self-managed infra later if costs demand it. |

## 4. High-Level System Architecture

```mermaid
flowchart LR
    RiderApp["Rider App (Flutter)"]
    DriverApp["Driver App (Flutter)"]
    AdminWeb["Admin Dashboard (React)"]

    subgraph Backend["Backend Platform (NestJS)"]
        Gateway["API Gateway / REST + WebSocket"]
        Auth["Auth Service"]
        Trip["Trip & Matching Service"]
        Pricing["Pricing Service"]
        Payment["Payment Service"]
        Notify["Notification Service"]
    end

    Postgres[("PostgreSQL + PostGIS")]
    Redis[("Redis: live locations, queues")]
    MoMo["MTN MoMo / Airtel Money APIs"]
    SMSGW["SMS Gateway"]
    FCM["Firebase Cloud Messaging"]

    RiderApp <--> Gateway
    DriverApp <--> Gateway
    AdminWeb <--> Gateway

    Gateway --> Auth
    Gateway --> Trip
    Gateway --> Pricing
    Gateway --> Payment
    Gateway --> Notify

    Auth --> Postgres
    Trip --> Postgres
    Trip --> Redis
    Pricing --> Postgres
    Payment --> Postgres
    Payment --> MoMo
    Notify --> FCM
    Notify --> SMSGW
```

## 5. Core Domain Model

```mermaid
erDiagram
    USER ||--o{ TRIP : requests
    DRIVER ||--o{ TRIP : accepts
    DRIVER ||--|| VEHICLE : drives
    TRIP ||--o{ TRIP_STATUS_EVENT : has
    TRIP ||--|| PAYMENT : settled_by
    TRIP ||--o| RATING : rated_by
    DRIVER ||--o{ RATING : receives
    ZONE ||--o{ FARE_RULE : defines
    DRIVER ||--|| WALLET : owns
    WALLET ||--o{ LEDGER_ENTRY : records
    TRIP ||--o{ DISPUTE : raised_on

    USER {
        uuid id
        string phone_number
        string name
        string role "rider|driver|admin"
        timestamp created_at
    }
    DRIVER {
        uuid id
        uuid user_id
        string license_number
        string verification_status
        boolean is_online
        geography current_location
    }
    VEHICLE {
        uuid id
        uuid driver_id
        string type "sedan|minibus|motorbike"
        string plate_number
        string photo_url
    }
    TRIP {
        uuid id
        uuid rider_id
        uuid driver_id
        geography pickup_point
        string pickup_landmark
        geography dropoff_point
        string requested_vehicle_type "sedan|minibus|motorbike|null=any"
        string status
        decimal fare_amount
        timestamp requested_at
        timestamp completed_at
    }
    TRIP_STATUS_EVENT {
        uuid id
        uuid trip_id
        string status
        timestamp occurred_at
    }
    PAYMENT {
        uuid id
        uuid trip_id
        string method "cash|momo|airtel"
        string status
        decimal amount
    }
    RATING {
        uuid id
        uuid trip_id
        uuid driver_id
        uuid rider_id
        int stars
        string comment
    }
    ZONE {
        uuid id
        string name
        geography boundary
    }
    DISPUTE {
        uuid id
        uuid trip_id
        uuid raised_by_user_id
        string reason
        string status "open|resolved"
        string resolution_note
        timestamp created_at
        timestamp resolved_at
    }
    FARE_RULE {
        uuid id
        uuid zone_id
        string vehicle_type "sedan|minibus|motorbike"
        decimal base_fare
        decimal per_km_rate
        decimal per_min_rate
    }
    WALLET {
        uuid id
        uuid driver_id
        decimal balance
    }
    LEDGER_ENTRY {
        uuid id
        uuid wallet_id
        decimal amount
        string type "trip_earning|commission|payout"
        timestamp created_at
    }
```

## 6. Key Flows

### 6.1 Ride request → matching → completion

```mermaid
sequenceDiagram
    participant Rider
    participant RiderApp
    participant Backend
    participant DriverApp
    participant Driver

    Rider->>RiderApp: Drop pickup pin + landmark, set destination
    RiderApp->>Backend: POST /trips (pickup, dropoff)
    Backend->>Backend: Estimate fare (Pricing Service)
    Backend-->>RiderApp: Fare estimate
    Rider->>RiderApp: Confirm request
    Backend->>Backend: Find nearest online driver (PostGIS + Redis)
    Backend->>DriverApp: Push trip offer (WebSocket/FCM)
    Driver->>DriverApp: Accept
    DriverApp->>Backend: POST /trips/{id}/accept
    Backend-->>RiderApp: Driver assigned + live location stream starts
    Driver->>RiderApp: (location updates every few seconds via WebSocket)
    Driver->>DriverApp: Mark "arrived"
    Backend-->>RiderApp: Arrival notification
    Driver->>DriverApp: Start trip
    Driver->>DriverApp: Complete trip
    DriverApp->>Backend: POST /trips/{id}/complete
    Backend->>Backend: Finalize fare, create Payment record
    Backend-->>RiderApp: Trip summary + payment prompt
    Rider->>RiderApp: Pay (cash confirm or MoMo push) + rate driver
```

### 6.2 Driver onboarding

1. Driver registers in the Driver app with phone number (OTP verification).
2. Submits license, national ID, vehicle photo, plate number.
3. Admin dashboard queues the application for manual review.
4. Ops staff verifies documents, approves or rejects.
5. On approval, driver account flips to `verification_status = approved` and can go online.

### 6.3 Fare estimation

Kept deliberately simple and transparent rather than Yango-style dynamic
surge, since Monze's market doesn't have the volume to make surge
meaningful — and transparent pricing builds trust in a new market:

```
fare = fare_rule(zone, vehicle_type).base_fare
     + (distance_km * fare_rule(zone, vehicle_type).per_km_rate)
     + (est_duration_min * fare_rule(zone, vehicle_type).per_min_rate)
```

Zones let the admin team set different base rates for, e.g., town-center
trips vs. trips to outlying areas, without needing a dynamic pricing engine.
Fare rules are keyed by **zone + vehicle type**, so motorbike trips can be
priced noticeably below car trips (reflecting real running costs and giving
riders an affordable option) without any special-casing in the pricing
logic itself.

### 6.4 Offline / low-connectivity degradation

- Map tiles for the town center are pre-cached on first app launch so pickup
  pin-dropping works even with a weak signal.
- If a WebSocket connection drops mid-trip, both apps fall back to polling
  every 15–30s; if data drops entirely, critical status changes (driver
  assigned, arrived, completed) are also sent via SMS.
- Trip requests made while briefly offline are queued locally and submitted
  the moment connectivity returns, rather than failing outright.

## 7. Driver Matching & Dispatch

Given a driver pool in the tens-to-low-hundreds, a simple radius search is
sufficient — no need for the ML-based dispatch optimization larger
platforms use:

1. On trip request, query Redis/PostGIS for online drivers within an
   expanding radius (start at 2 km, widen if none found).
2. Rank candidates by distance (and optionally driver rating).
3. Offer the trip to the top candidate with a short accept window (e.g. 15s);
   if declined or timed out, offer to the next.
4. If no driver accepts within a configurable window, notify the rider and
   suggest retrying or calling dispatch directly.

**Growth path:** if the driver pool grows into the hundreds and multiple
towns are added, this can evolve into a proper matching service that scores
drivers on ETA, acceptance rate, and rider preference — but that's
over-engineering for launch.

## 8. Non-Functional Requirements

- **Performance:** trip request → driver offer should round-trip in under
  ~3s on a 3G connection; this is comfortably achievable at Monze's scale.
- **Offline resilience:** see §6.4; the app should never be fully unusable
  due to a dropped connection.
- **Security:** OTP-based phone auth, JWT session tokens, encrypted at-rest
  storage for ID documents, PCI-conscious handling of any card data if that
  path is ever added (avoid storing raw card numbers — use the payment
  gateway's tokenization).
- **Privacy:** driver ID documents and location history are sensitive;
  handle in line with Zambia's Data Protection Act (2021) — data
  minimization, defined retention periods, and driver consent for location
  tracking while online.
- **Scalability path:** the stack (NestJS + Postgres/PostGIS + Redis) scales
  horizontally well past what Monze alone would need, so expansion to
  nearby towns (Mazabuka, Choma) is a config/data change, not a
  re-architecture.
- **Observability:** structured logging, request tracing, and dashboards for
  trip funnel metrics (requested → matched → completed → paid) from day one,
  since a small ops team needs visibility without deep debugging.

## 9. MVP Roadmap

| Phase | Scope |
|---|---|
| **Phase 1 — Core loop** ✅ scaffolded | Rider requests a trip (car, minibus, or motorbike), driver accepts, manual/cash fare, basic trip status tracking. No live GPS yet — just status updates. Code scaffold: [`backend/`](../backend) (NestJS API), [`mobile/rider_app/`](../mobile/rider_app), [`mobile/driver_app/`](../mobile/driver_app). |
| **Phase 2 — Live tracking, digital payment & ratings** ✅ scaffolded | MTN MoMo / Airtel Money integration ✅ scaffolded ([`backend/src/payments/`](../backend/src/payments) — collections from riders, disbursements/payouts to drivers, dev-mode simulation since no real provider credentials exist yet). Real-time GPS tracking ✅ scaffolded ([`backend/src/realtime/`](../backend/src/realtime) — WebSocket gateway backed by Redis, verified against a real Postgres+Redis+socket client, not just built). Post-trip ratings ✅ scaffolded ([`backend/src/ratings/`](../backend/src/ratings) — one rating per completed trip, rider-only, driver's aggregate exposed via `GET /drivers/me/rating`; verified end-to-end against a real Postgres, including the duplicate/ownership/pre-completion rejections and the running-average math). |
| **Phase 3 — Ops tooling** ✅ scaffolded | Admin dashboard ✅ scaffolded ([`admin/`](../admin), React+TypeScript+Tailwind — driver onboarding & approval, live trip monitoring, zone/fare-rule configuration, dispute handling; verified with a Playwright script driving the actual UI against a real running backend, not just built). Ships with a security fix: self-service signup could previously mint an admin account by passing `role: "admin"`; the backend now refuses that, and admin accounts only come from an out-of-band seed script (`backend/src/scripts/create-admin.ts`). Zone/fare-rule config is real CRUD but not yet consumed by trip pricing (still manual, per Phase 1) — that's Phase 4. |
| **Phase 4 — Scale-out** | Multi-town support, driver earnings/payout automation, loyalty or referral incentives, optional surge pricing if volume justifies it. |

## 10. Open Questions for Stakeholders

- **Driver supply model:** independent owner-operators applying individually, or onboarding via existing minibus/taxi associations in bulk?
- **Regulatory:** what licensing or permit requirements does the Monze Municipal Council (or national transport regulator) impose on app-based dispatch — is a permit or registration needed before launch?
- **Vehicle types:** motorbikes, cars, and minibuses are now all modeled as point-to-point trips with the same status flow (see §5, §9) — is that right, or do shared/fixed-route minibus trips need a materially different booking flow (e.g. multiple riders per trip)?
- **Motorbike safety:** should the app require proof of a helmet policy or basic rider-safety training before approving a motorbike driver, given the higher injury risk of that vehicle type?
- **Commission model:** implemented as a per-vehicle-type percentage (15% car / 12% minibus / 10% motorbike — see [`backend/src/config/commission.config.ts`](../backend/src/config/commission.config.ts)). For cash trips it's deducted into a driver `Wallet` as a debt (driver already holds the fare; blocked from going online past K100 owed, settled via `POST /drivers/:driverId/wallet/settlements`). For mobile money trips the platform collects the fare directly and credits the driver's net share to their wallet, payable out via `POST /payments/payout` — see §3 and `backend/src/payments/`. Open for stakeholders to confirm: are these the right rates, is K100 the right block-online threshold, and — now that mobile money settlement exists — should cash commission debts eventually be settleable the same way instead of admin-recorded cash?
- **Emergency/safety features:** is an SOS button, trip-sharing with a contact, or driver background-check requirement needed for launch, or can it wait for Phase 2/3?
