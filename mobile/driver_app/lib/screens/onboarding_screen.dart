import 'package:flutter/material.dart';
import '../models/vehicle_type.dart';
import '../services/api_client.dart';
import 'trips_screen.dart';

/// Registers the driver profile + vehicle. Approval itself happens on the
/// admin side (Phase 3 dashboard; a single REST call for now) — this screen
/// just gets a driver into the "pending" queue.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _api = ApiClient();
  final _licenseController = TextEditingController();
  final _plateController = TextEditingController();
  VehicleType _vehicleType = VehicleType.sedan;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.registerDriver(_licenseController.text.trim());
      await _api.registerVehicle(
        type: _vehicleType.apiValue,
        plateNumber: _plateController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const TripsScreen()),
      );
    } catch (e) {
      setState(() => _error = 'Could not complete onboarding: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Driver details')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _licenseController,
              decoration: const InputDecoration(labelText: 'Driving license number'),
            ),
            const SizedBox(height: 16),
            const Text('Vehicle type', style: TextStyle(fontWeight: FontWeight.bold)),
            Wrap(
              spacing: 8,
              children: [
                for (final type in VehicleType.values)
                  ChoiceChip(
                    label: Text(type.label),
                    selected: _vehicleType == type,
                    onSelected: (_) => setState(() => _vehicleType = type),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _plateController,
              decoration: const InputDecoration(labelText: 'Number plate'),
            ),
            const SizedBox(height: 24),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: const Text('Submit for approval'),
            ),
          ],
        ),
      ),
    );
  }
}
