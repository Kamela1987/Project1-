import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'api_client.dart';

/// Streams the driver's real GPS position over a WebSocket to the backend
/// (src/realtime/location.gateway.ts). Runs in two modes:
///  - idle (no `tripId`): started as soon as the driver goes online, so the
///    backend has a position to sort `GET /trips/available` by distance —
///    see docs/MONZE_RIDE_ARCHITECTURE.md §7.
///  - trip-scoped (`tripId` set): started once a trip is accepted; the
///    backend additionally broadcasts these to the rider watching the trip.
///
/// A singleton (`LocationTrackingService.instance`) rather than one per
/// screen — `trips_screen.dart` starts idle tracking when the driver goes
/// online, and `trip_detail_screen.dart` later upgrades the *same* session
/// to a trip-scoped one once a trip is accepted. Two separate instances
/// would mean two competing sockets both pinging the same driver's
/// position. Requires location permission — see the "Known gaps" note in
/// this app's README about platform (Android) permission setup this
/// lib-only scaffold doesn't ship.
class LocationTrackingService {
  LocationTrackingService._internal();
  static final LocationTrackingService instance = LocationTrackingService._internal();

  final _api = ApiClient();
  socket_io.Socket? _socket;
  StreamSubscription<Position>? _positionSubscription;
  String? _tripId;
  bool _isTracking = false;

  bool get isTracking => _isTracking;
  String? get trackedTripId => _tripId;

  /// Starts (or upgrades) a tracking session. Calling this again with a
  /// `tripId` while already tracking idly reuses the same socket/stream —
  /// it just starts tagging outgoing pings with that trip.
  Future<void> start({String? tripId}) async {
    if (_isTracking) {
      _tripId = tripId;
      return;
    }

    final permission = await _ensurePermission();
    if (!permission) {
      throw StateError('Location permission was not granted');
    }

    final token = await _api.currentToken();
    _socket = socket_io.io(
      ApiClient.baseUrl,
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .build(),
    );

    _tripId = tripId;
    _isTracking = true;
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((position) {
      _socket?.emit('driver:location', {
        if (_tripId != null) 'tripId': _tripId,
        'lat': position.latitude,
        'lng': position.longitude,
      });
    });
  }

  /// Drops back to idle tracking (still online, no trip) rather than
  /// stopping outright — call [stop] for that when the driver goes offline.
  void clearTrip() {
    _tripId = null;
  }

  Future<void> stop() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _tripId = null;
    _isTracking = false;
  }

  Future<bool> _ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }
}
