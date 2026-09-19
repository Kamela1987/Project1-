# Monze Ride — Driver App (Phase 1-2 scaffold)

Flutter app implementing the driver flow: log in by phone/OTP, register a
vehicle (car, minibus, **or motorbike** — boda-bodas are common and growing
in Monze, so they're a first-class vehicle type, not an afterthought), go
online once approved, work trip requests through to completion (cash or
mobile money), stream live GPS location while on a trip, and cash out
mobile-money earnings.

## Status

Verified running (web target) against a real backend — `flutter analyze`
clean, `flutter test` passing, `flutter build web` clean, and driven
end-to-end through a headless browser: login → OTP → driver
registration → the correctly-gated "pending approval" trips screen, all
against a live Postgres+Redis-backed API. Android/iOS haven't been
built or run — this repo only has the `web/` platform folder (added via
`flutter create --platforms=web .`), not `android/`/`ios/` (see
"Location permission" below for what those still need).

```bash
flutter pub get
flutter run -d web-server --dart-define=API_BASE_URL=http://localhost:3000
# or, for an Android emulator once android/ is generated (flutter create --platforms=android .):
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

**Location permission**: `location_tracking_service.dart` uses the
`geolocator` package. On the web, the browser's own permission prompt
handles this with no extra config. For Android/iOS, once those platform
folders exist, they'll need a permission entry in
`android/app/src/main/AndroidManifest.xml`
(`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`) and, for iOS,
`NSLocationWhenInUseUsageDescription` in `Info.plist` — neither exists
yet, since only the web platform has been scaffolded so far. Without it,
`Geolocator.requestPermission()` fails, which `trip_detail_screen.dart`
surfaces as a "Live location unavailable" banner rather than blocking
the trip flow — a driver without GPS can still work the
accept/arrive/start/complete buttons.

## Flow

1. `login_screen.dart` — phone + OTP (OTP logged to the backend console)
2. `onboarding_screen.dart` — license number + vehicle type/plate, submitted for approval
3. `trips_screen.dart` — once approved, toggle online/offline and see open trip requests (polled every 5s)
4. `trip_detail_screen.dart` — accept → mark arrived → start → complete (cash fare, or the rider's chosen mobile money method). Streams real GPS position over WebSocket to `backend/src/realtime/location.gateway.ts` for the whole accepted→in-progress window.
5. `wallet_screen.dart` — commission owed (cash trips) or net earnings (mobile money trips), with a "cash out to mobile money" action, plus the driver's aggregate star rating from completed trips

## Known gaps (by design)

- No SMS fallback if the WebSocket drops (architecture doc §6.4) — only REST polling as a fallback today
- Android/iOS platform folders don't exist yet (only `web/` — see "Status" above)
