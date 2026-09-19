import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'api_client.dart';

/// Subscribes to a trip's live driver-location feed
/// (backend/src/realtime/location.gateway.ts). REST polling
/// (ApiClient.getTrip / a future getTripLocation call) remains the
/// offline/low-connectivity fallback — this is the live upgrade.
class TripSocketService {
  final ApiClient _api;
  socket_io.Socket? _socket;

  TripSocketService(this._api);

  Future<void> subscribe(
    String tripId,
    void Function(Map<String, dynamic> location) onLocation,
  ) async {
    final token = await _api.currentToken();
    _socket = socket_io.io(
      ApiClient.baseUrl,
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .build(),
    );
    _socket!.on('connect', (_) => _socket!.emit('trip:subscribe', {'tripId': tripId}));
    _socket!.on('driver:location', (data) => onLocation(Map<String, dynamic>.from(data as Map)));
  }

  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }
}
