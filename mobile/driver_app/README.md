# Monze Ride — Driver App (Phase 1 scaffold)

Flutter app implementing the Phase 1 driver flow: log in by phone/OTP,
register a vehicle (car, minibus, **or motorbike** — boda-bodas are common
and growing in Monze, so they're a first-class vehicle type, not an
afterthought), go online once approved, and work trip requests through to
completion with a cash fare.

## Status

This is a scaffold, not a verified build — the container this was written in
has no Flutter SDK installed, so it hasn't been run through `flutter pub get`
/ `flutter analyze` / `flutter run`. Do that first:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # Android emulator
```

## Flow

1. `login_screen.dart` — phone + OTP (OTP logged to the backend console in Phase 1)
2. `onboarding_screen.dart` — license number + vehicle type/plate, submitted for approval
3. `trips_screen.dart` — once approved, toggle online/offline and see open trip requests (polled every 5s)
4. `trip_detail_screen.dart` — accept → mark arrived → start → complete (enter cash fare collected)

## Known gaps (by design, for Phase 1)

- Driver approval is a backend-only admin call (`PATCH /drivers/:id/approve`) — no admin UI yet (Phase 3)
- No live location broadcast while online (Phase 2)
- No mobile money payout / earnings dashboard (Phase 2/3)
