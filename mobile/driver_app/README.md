# Monze Ride — Driver App (Phase 1-2 scaffold)

Flutter app implementing the driver flow: log in by phone/OTP, register a
vehicle (car, minibus, **or motorbike** — boda-bodas are common and growing
in Monze, so they're a first-class vehicle type, not an afterthought), go
online once approved, work trip requests through to completion (cash or
mobile money), stream live GPS location while on a trip, and cash out
mobile-money earnings.

## Status

This is a scaffold, not a verified build — the container this was written in
has no Flutter SDK installed, so it hasn't been run through `flutter pub get`
/ `flutter analyze` / `flutter run`. Do that first:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # Android emulator
```

**Location permission**: `location_tracking_service.dart` uses the
`geolocator` package, which needs a permission entry in
`android/app/src/main/AndroidManifest.xml`
(`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`) and, for iOS,
`NSLocationWhenInUseUsageDescription` in `Info.plist`. Since this scaffold
is `lib/` + `pubspec.yaml` only (no platform folders — those come from
`flutter create .`), that config doesn't exist yet; add it before this runs
on a device. Without it, `Geolocator.requestPermission()` fails, which
`trip_detail_screen.dart` surfaces as a "Live location unavailable" banner
rather than blocking the trip flow — a driver without GPS can still work
the accept/arrive/start/complete buttons.

## Flow

1. `login_screen.dart` — phone + OTP (OTP logged to the backend console)
2. `onboarding_screen.dart` — license number + vehicle type/plate, submitted for approval
3. `trips_screen.dart` — once approved, toggle online/offline and see open trip requests (polled every 5s)
4. `trip_detail_screen.dart` — accept → mark arrived → start → complete (cash fare, or the rider's chosen mobile money method). Streams real GPS position over WebSocket to `backend/src/realtime/location.gateway.ts` for the whole accepted→in-progress window.
5. `wallet_screen.dart` — commission owed (cash trips) or net earnings (mobile money trips), with a "cash out to mobile money" action

## Known gaps (by design)

- Driver approval is a backend-only admin call (`PATCH /drivers/:id/approve`) — no admin UI yet (Phase 3)
- No post-trip ratings (Phase 3)
- No SMS fallback if the WebSocket drops (architecture doc §6.4) — only REST polling as a fallback today
