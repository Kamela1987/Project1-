import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../services/api_client.dart';

class TripDetailScreen extends StatefulWidget {
  final String tripId;
  const TripDetailScreen({super.key, required this.tripId});

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  final _api = ApiClient();
  final _fareController = TextEditingController();
  Trip? _trip;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final json = await _api.getTrip(widget.tripId);
      if (!mounted) return;
      setState(() => _trip = Trip.fromJson(json));
    } catch (e) {
      setState(() => _error = 'Could not load trip: $e');
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
      appBar: AppBar(title: const Text('Trip')),
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
