import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'api_client.dart';

/// Streams the driver's real GPS position over a WebSocket to the backend
/// (src/realtime/location.gateway.ts) while a trip is active. Requires
/// location permission — see the "Known gaps" note in this app's README
/// about platform (Android) permission setup this lib-only scaffold
/// doesn't ship.
class LocationTrackingService {
  final ApiClient _api;
  socket_io.Socket? _socket;
  StreamSubscription<Position>? _positionSubscription;
  String? _tripId;

  LocationTrackingService(this._api);

  bool get isTracking => _tripId != null;

  Future<void> start(String tripId) async {
    if (_tripId == tripId) return; // already tracking this trip
    await stop();

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
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((position) {
      _socket?.emit('driver:location', {
        'tripId': tripId,
        'lat': position.latitude,
        'lng': position.longitude,
      });
    });
  }

  Future<void> stop() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _tripId = null;
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
