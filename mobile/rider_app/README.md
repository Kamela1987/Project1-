# Monze Ride — Rider App (Phase 1 scaffold)

Flutter app implementing the Phase 1 rider flow: log in by phone/OTP,
request a ride (car, minibus, or motorbike), and track trip status against
the [backend](../../backend).

## Status

This is a scaffold, not a verified build — the container this was written in
has no Flutter SDK installed, so it hasn't been run through `flutter pub get`
/ `flutter analyze` / `flutter run`. Do that first before trusting it end to
end:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # Android emulator
```

## What's here

- `lib/screens/login_screen.dart` — phone + OTP login (OTP is logged to the
  backend console in Phase 1, no real SMS yet)
- `lib/screens/request_ride_screen.dart` — pickup/dropoff by lat/lng +
  landmark note, with a car/minibus/motorbike ride-type picker
- `lib/screens/trip_status_screen.dart` — polls trip status every 5s
  (no live GPS/WebSocket yet — that's Phase 2)
- `lib/services/api_client.dart` — thin REST client for the backend

## Known gaps (by design, for Phase 1)

- No map widget — pickup/dropoff are typed coordinates for now
- No push notifications
- No in-app payment — fare is settled in cash and shown after completion
