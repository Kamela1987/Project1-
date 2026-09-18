# Monze Ride — Rider App (Phase 1-2 scaffold)

Flutter app implementing the rider flow: log in by phone/OTP, request a
ride (car, minibus, or motorbike; cash, MTN MoMo, or Airtel Money), track
trip status and the driver's live location, and watch mobile money payment
settle, against the [backend](../../backend).

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
  backend console, no real SMS yet)
- `lib/screens/request_ride_screen.dart` — pickup/dropoff by lat/lng +
  landmark note, with a car/minibus/motorbike ride-type picker and a
  cash/MoMo/Airtel payment-method picker
- `lib/screens/trip_status_screen.dart` — polls trip status every 5s (the
  low-connectivity-friendly baseline), and once a driver is assigned also
  opens a WebSocket (`lib/services/trip_socket_service.dart`) to
  `backend/src/realtime/location.gateway.ts` for their live position
  without waiting for the next poll. Also polls payment status for mobile
  money trips, since it settles asynchronously.
- `lib/services/api_client.dart` — thin REST client for the backend

## Known gaps (by design)

- No map widget — pickup/dropoff are typed coordinates, and the driver's
  live position is shown as raw lat/lng, not a pin on a map
- No push notifications
- No post-trip ratings (Phase 3)
