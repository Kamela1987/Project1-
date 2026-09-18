import 'package:flutter/material.dart';
import '../models/payment_method.dart' as pm;
import '../models/vehicle_type.dart';
import '../services/api_client.dart';
import 'trip_status_screen.dart';

/// Phase 1 note: pickup/dropoff are entered as lat/lng + a landmark note
/// rather than picked off a live map widget — the map SDK integration is
/// tracked separately (see docs/MONZE_RIDE_ARCHITECTURE.md §3, Maps).
class RequestRideScreen extends StatefulWidget {
  const RequestRideScreen({super.key});

  @override
  State<RequestRideScreen> createState() => _RequestRideScreenState();
}

class _RequestRideScreenState extends State<RequestRideScreen> {
  final _api = ApiClient();
  final _pickupLatController = TextEditingController();
  final _pickupLngController = TextEditingController();
  final _pickupLandmarkController = TextEditingController();
  final _dropoffLatController = TextEditingController();
  final _dropoffLngController = TextEditingController();
  final _dropoffLandmarkController = TextEditingController();
  VehicleType? _vehicleType;
  pm.PaymentMethod _paymentMethod = pm.PaymentMethod.cash;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final trip = await _api.requestTrip(
        pickupLat: double.parse(_pickupLatController.text),
        pickupLng: double.parse(_pickupLngController.text),
        pickupLandmark: _pickupLandmarkController.text.trim().isEmpty
            ? null
            : _pickupLandmarkController.text.trim(),
        dropoffLat: double.parse(_dropoffLatController.text),
        dropoffLng: double.parse(_dropoffLngController.text),
        dropoffLandmark: _dropoffLandmarkController.text.trim().isEmpty
            ? null
            : _dropoffLandmarkController.text.trim(),
        requestedVehicleType: _vehicleType?.apiValue,
        paymentMethod: _paymentMethod.apiValue,
      );
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TripStatusScreen(tripId: trip['id'] as String)),
      );
    } catch (e) {
      setState(() => _error = 'Could not request a ride: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Request a ride')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Pickup', style: TextStyle(fontWeight: FontWeight.bold)),
            _latLngRow(_pickupLatController, _pickupLngController),
            TextField(
              controller: _pickupLandmarkController,
              decoration: const InputDecoration(labelText: 'Landmark (e.g. "blue gate near market")'),
            ),
            const SizedBox(height: 24),
            const Text('Drop-off', style: TextStyle(fontWeight: FontWeight.bold)),
            _latLngRow(_dropoffLatController, _dropoffLngController),
            TextField(
              controller: _dropoffLandmarkController,
              decoration: const InputDecoration(labelText: 'Landmark'),
            ),
            const SizedBox(height: 24),
            const Text('Ride type', style: TextStyle(fontWeight: FontWeight.bold)),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Any'),
                  selected: _vehicleType == null,
                  onSelected: (_) => setState(() => _vehicleType = null),
                ),
                for (final type in VehicleType.values)
                  ChoiceChip(
                    label: Text(type.label),
                    selected: _vehicleType == type,
                    onSelected: (_) => setState(() => _vehicleType = type),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            const Text('Payment method', style: TextStyle(fontWeight: FontWeight.bold)),
            Wrap(
              spacing: 8,
              children: [
                for (final method in pm.PaymentMethod.values)
                  ChoiceChip(
                    label: Text(method.label),
                    selected: _paymentMethod == method,
                    onSelected: (_) => setState(() => _paymentMethod = method),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: const Text('Request ride'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _latLngRow(TextEditingController lat, TextEditingController lng) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: lat,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            decoration: const InputDecoration(labelText: 'Latitude'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TextField(
            controller: lng,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            decoration: const InputDecoration(labelText: 'Longitude'),
          ),
        ),
      ],
    );
  }
}
