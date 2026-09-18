import 'dart:async';
import 'package:flutter/material.dart';
import '../models/payment_method.dart' as pm;
import '../models/trip.dart';
import '../services/api_client.dart';
import '../services/trip_socket_service.dart';

/// Trip status is poll-based (every 5s) as a low-connectivity-friendly
/// baseline; on top of that, once a driver is assigned this screen opens a
/// WebSocket (backend/src/realtime/location.gateway.ts) to show their live
/// position without waiting for the next poll. Payment (for mobile money
/// trips) is also polled once the trip completes, since it settles
/// asynchronously — see PaymentsService on the backend.
class TripStatusScreen extends StatefulWidget {
  final String tripId;
  const TripStatusScreen({super.key, required this.tripId});

  @override
  State<TripStatusScreen> createState() => _TripStatusScreenState();
}

class _TripStatusScreenState extends State<TripStatusScreen> {
  final _api = ApiClient();
  late final _tripSocket = TripSocketService(_api);
  Trip? _trip;
  Map<String, dynamic>? _payment;
  Map<String, dynamic>? _driverLocation;
  Timer? _poller;
  String? _error;
  bool _liveTrackingStarted = false;

  static const _trackedStatuses = {TripStatus.accepted, TripStatus.arrived, TripStatus.inProgress};

  @override
  void initState() {
    super.initState();
    _refresh();
    _poller = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void dispose() {
    _poller?.cancel();
    _tripSocket.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final json = await _api.getTrip(widget.tripId);
      if (!mounted) return;
      final trip = Trip.fromJson(json);
      setState(() => _trip = trip);

      if (_trackedStatuses.contains(trip.status) && !_liveTrackingStarted) {
        _liveTrackingStarted = true;
        await _tripSocket.subscribe(widget.tripId, (location) {
          if (!mounted) return;
          setState(() => _driverLocation = location);
        });
      }

      if (trip.status == TripStatus.completed) {
        final payment = await _api.getTripPayment(widget.tripId);
        if (!mounted) return;
        setState(() => _payment = payment);
      }

      final paymentSettled = _payment == null || _payment!['status'] != 'pending';
      if (trip.status == TripStatus.cancelled ||
          (trip.status == TripStatus.completed && paymentSettled)) {
        _poller?.cancel();
        _tripSocket.dispose();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not refresh trip: $e');
    }
  }

  Future<void> _cancel() async {
    try {
      await _api.cancelTrip(widget.tripId);
      await _refresh();
    } catch (e) {
      setState(() => _error = 'Could not cancel: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final trip = _trip;
    return Scaffold(
      appBar: AppBar(title: const Text('Your trip')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: trip == null
            ? const Center(child: CircularProgressIndicator())
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(trip.status.label, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 16),
                  Text('Pickup: ${trip.pickupLandmark ?? '${trip.pickupLat}, ${trip.pickupLng}'}'),
                  Text('Drop-off: ${trip.dropoffLandmark ?? '${trip.dropoffLat}, ${trip.dropoffLng}'}'),
                  if (trip.requestedVehicleType != null)
                    Text('Ride type: ${trip.requestedVehicleType!.label}'),
                  if (_trackedStatuses.contains(trip.status)) ...[
                    const SizedBox(height: 16),
                    _driverLocationCard(),
                  ],
                  if (trip.fareAmount != null) ...[
                    const SizedBox(height: 16),
                    Text('Fare: K${trip.fareAmount}'),
                    _paymentStatusLine(),
                  ],
                  const SizedBox(height: 24),
                  if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
                  if (trip.status == TripStatus.requested || trip.status == TripStatus.accepted)
                    OutlinedButton(onPressed: _cancel, child: const Text('Cancel ride')),
                ],
              ),
      ),
    );
  }

  Widget _driverLocationCard() {
    final location = _driverLocation;
    if (location == null) {
      return const Row(
        children: [
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          SizedBox(width: 8),
          Text('Waiting for driver location…'),
        ],
      );
    }
    final updatedAt = DateTime.tryParse(location['updatedAt'] as String? ?? '');
    final secondsAgo = updatedAt == null ? null : DateTime.now().difference(updatedAt).inSeconds;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.teal),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.gps_fixed, color: Colors.teal),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Driver at ${(location['lat'] as num).toStringAsFixed(5)}, '
              '${(location['lng'] as num).toStringAsFixed(5)}'
              '${secondsAgo != null ? ' — updated ${secondsAgo}s ago' : ''}',
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentStatusLine() {
    final payment = _payment;
    if (payment == null) {
      return const Text('Payment: cash');
    }
    final method = pm.PaymentMethod.fromApiValue(payment['method'] as String);
    final status = pm.PaymentStatus.fromApiValue(payment['status'] as String);
    switch (status) {
      case pm.PaymentStatus.pending:
        return Row(
          children: [
            const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 8),
            Text('Approve the ${method.label} prompt on your phone…'),
          ],
        );
      case pm.PaymentStatus.collected:
        return Text('Payment: ${method.label} — received', style: const TextStyle(color: Colors.green));
      case pm.PaymentStatus.failed:
        return const Text(
          'Payment failed. Please pay the driver in cash.',
          style: TextStyle(color: Colors.red),
        );
    }
  }
}
