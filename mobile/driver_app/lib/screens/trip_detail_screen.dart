import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../services/api_client.dart';
import '../services/location_tracking_service.dart';

class TripDetailScreen extends StatefulWidget {
  final String tripId;
  const TripDetailScreen({super.key, required this.tripId});

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  final _api = ApiClient();
  final _locationTracking = LocationTrackingService.instance;
  final _fareController = TextEditingController();
  Trip? _trip;
  bool _loading = false;
  String? _error;

  static const _trackedStatuses = {TripStatus.accepted, TripStatus.arrived, TripStatus.inProgress};

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  // Deliberately no `dispose()` stop() call: tracking is tied to the
  // driver's online/offline state (owned by trips_screen.dart), not this
  // screen's lifecycle — leaving here should drop back to idle tracking
  // (handled in _syncTracking below), not kill the socket outright.

  Future<void> _refresh() async {
    try {
      final json = await _api.getTrip(widget.tripId);
      if (!mounted) return;
      final trip = Trip.fromJson(json);
      setState(() => _trip = trip);
      await _syncTracking(trip.status);
    } catch (e) {
      setState(() => _error = 'Could not load trip: $e');
    }
  }

  /// Tags the shared location-tracking session with this trip while it's
  /// accepted/arrived/in progress (see backend/src/realtime/location.gateway.ts),
  /// which makes the driver app's pings also broadcast to the rider
  /// watching this trip. Once the trip ends, drops back to idle tracking
  /// (still pinging position for matching, just untagged) rather than
  /// stopping outright — the driver is presumably still online. Location
  /// permission errors surface as a page banner rather than blocking the
  /// trip flow — a driver without GPS can still work the status buttons.
  Future<void> _syncTracking(TripStatus status) async {
    if (_trackedStatuses.contains(status)) {
      try {
        await _locationTracking.start(tripId: widget.tripId);
      } catch (e) {
        if (!mounted) return;
        setState(() => _error = 'Live location unavailable: $e');
      }
    } else {
      _locationTracking.clearTrip();
    }
  }

  Future<void> _runAction(Future<Map<String, dynamic>> Function() action) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await action();
      await _refresh();
    } catch (e) {
      setState(() => _error = 'Action failed: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trip = _trip;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trip'),
        actions: [
          if (_locationTracking.isTracking)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: Row(
                  children: [
                    Icon(Icons.gps_fixed, size: 16),
                    SizedBox(width: 4),
                    Text('Sharing location'),
                  ],
                ),
              ),
            ),
        ],
      ),
      body: trip == null
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Pickup: ${trip.pickupLandmark ?? '${trip.pickupLat}, ${trip.pickupLng}'}'),
                  Text('Drop-off: ${trip.dropoffLandmark ?? '${trip.dropoffLat}, ${trip.dropoffLng}'}'),
                  if (trip.requestedVehicleType != null) Text('Requested: ${trip.requestedVehicleType}'),
                  const SizedBox(height: 24),
                  if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
                  ..._actionsFor(trip.status),
                ],
              ),
            ),
    );
  }

  List<Widget> _actionsFor(TripStatus status) {
    switch (status) {
      case TripStatus.requested:
        return [
          FilledButton(
            onPressed: _loading ? null : () => _runAction(() => _api.acceptTrip(widget.tripId)),
            child: const Text('Accept trip'),
          ),
        ];
      case TripStatus.accepted:
        return [
          FilledButton(
            onPressed: _loading ? null : () => _runAction(() => _api.markArrived(widget.tripId)),
            child: const Text('Mark arrived at pickup'),
          ),
        ];
      case TripStatus.arrived:
        return [
          FilledButton(
            onPressed: _loading ? null : () => _runAction(() => _api.startTrip(widget.tripId)),
            child: const Text('Start trip'),
          ),
        ];
      case TripStatus.inProgress:
        return [
          TextField(
            controller: _fareController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Fare collected (ZMW, cash)'),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _loading
                ? null
                : () {
                    final fare = double.tryParse(_fareController.text);
                    if (fare == null) {
                      setState(() => _error = 'Enter a valid fare amount');
                      return;
                    }
                    _runAction(() => _api.completeTrip(widget.tripId, fare));
                  },
            child: const Text('Complete trip'),
          ),
        ];
      case TripStatus.completed:
        return [const Text('Trip completed. Fare collected in cash.')];
      case TripStatus.cancelled:
        return [const Text('This trip was cancelled by the rider.')];
    }
  }
}
