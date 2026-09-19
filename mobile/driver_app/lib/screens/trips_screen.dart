import 'dart:async';
import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../services/api_client.dart';
import '../services/location_tracking_service.dart';
import 'trip_detail_screen.dart';
import 'wallet_screen.dart';

class TripsScreen extends StatefulWidget {
  const TripsScreen({super.key});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  final _api = ApiClient();
  final _locationTracking = LocationTrackingService.instance;
  List<Trip> _trips = [];
  bool _isOnline = false;
  bool _isApproved = false;
  String? _error;
  Timer? _poller;

  @override
  void initState() {
    super.initState();
    _loadMe();
    _poller = Timer.periodic(const Duration(seconds: 5), (_) => _refreshTrips());
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _loadMe() async {
    try {
      final me = await _api.me();
      setState(() {
        _isOnline = me['isOnline'] as bool;
        _isApproved = me['verificationStatus'] == 'approved';
      });
      if (_isOnline) {
        // Covers e.g. an app restart while the backend still thinks this
        // driver is online — resume idle tracking so distance-sorted
        // matching keeps working without them toggling the switch.
        await _startIdleTracking();
      }
      _refreshTrips();
    } catch (e) {
      setState(() => _error = 'Could not load driver profile: $e');
    }
  }

  Future<void> _startIdleTracking() async {
    try {
      await _locationTracking.start();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Live location unavailable: $e');
    }
  }

  Future<void> _refreshTrips() async {
    if (!_isOnline) return;
    try {
      final json = await _api.availableTrips();
      if (!mounted) return;
      setState(() => _trips = json.map((t) => Trip.fromJson(t as Map<String, dynamic>)).toList());
    } catch (e) {
      setState(() => _error = 'Could not load trips: $e');
    }
  }

  Future<void> _toggleOnline(bool value) async {
    try {
      await _api.setOnline(value);
      setState(() => _isOnline = value);
      if (value) {
        await _startIdleTracking();
      } else {
        await _locationTracking.stop();
      }
      _refreshTrips();
    } catch (e) {
      setState(() => _error = 'Could not go ${value ? 'online' : 'offline'}: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Available trips'),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            tooltip: 'My wallet',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
          ),
          if (_isApproved)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Row(
                children: [
                  Text(_isOnline ? 'Online' : 'Offline'),
                  Switch(value: _isOnline, onChanged: _toggleOnline),
                ],
              ),
            ),
        ],
      ),
      body: !_isApproved
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Your driver profile is pending approval. '
                  'You can go online once an admin approves your account.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : !_isOnline
              ? const Center(child: Text('Go online to see trip requests'))
              : RefreshIndicator(
                  onRefresh: _refreshTrips,
                  child: _trips.isEmpty
                      ? ListView(
                          children: const [
                            Padding(
                              padding: EdgeInsets.all(24),
                              child: Center(child: Text('No trip requests right now')),
                            ),
                          ],
                        )
                      : ListView.builder(
                          itemCount: _trips.length,
                          itemBuilder: (context, index) {
                            final trip = _trips[index];
                            final distance = trip.distanceKm;
                            return ListTile(
                              title: Text(trip.pickupLandmark ?? 'Pickup at ${trip.pickupLat}, ${trip.pickupLng}'),
                              subtitle: Text(
                                'To: ${trip.dropoffLandmark ?? '${trip.dropoffLat}, ${trip.dropoffLng}'}'
                                '${distance != null ? ' · ${distance.toStringAsFixed(1)} km away' : ''}',
                              ),
                              trailing: trip.requestedVehicleType != null
                                  ? Chip(label: Text(trip.requestedVehicleType!))
                                  : null,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => TripDetailScreen(tripId: trip.id),
                                  ),
                                );
                                _refreshTrips();
                              },
                            );
                          },
                        ),
                ),
    );
  }
}
