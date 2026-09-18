import 'dart:async';
import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../services/api_client.dart';

/// Phase 1 status tracking is poll-based, not a live WebSocket stream —
/// that upgrade lands in Phase 2 alongside live GPS (see architecture doc).
class TripStatusScreen extends StatefulWidget {
  final String tripId;
  const TripStatusScreen({super.key, required this.tripId});

  @override
  State<TripStatusScreen> createState() => _TripStatusScreenState();
}

class _TripStatusScreenState extends State<TripStatusScreen> {
  final _api = ApiClient();
  Trip? _trip;
  Timer? _poller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
    _poller = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final json = await _api.getTrip(widget.tripId);
      if (!mounted) return;
      setState(() => _trip = Trip.fromJson(json));
      if (_trip!.status == TripStatus.completed || _trip!.status == TripStatus.cancelled) {
        _poller?.cancel();
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
                  if (trip.fareAmount != null) Text('Fare: K${trip.fareAmount} (cash)'),
                  const SizedBox(height: 24),
                  if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
                  if (trip.status == TripStatus.requested || trip.status == TripStatus.accepted)
                    OutlinedButton(onPressed: _cancel, child: const Text('Cancel ride')),
                ],
              ),
      ),
    );
  }
}
