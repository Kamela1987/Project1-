enum TripStatus {
  requested,
  accepted,
  arrived,
  inProgress,
  completed,
  cancelled;

  static TripStatus fromApiValue(String value) {
    switch (value) {
      case 'requested':
        return TripStatus.requested;
      case 'accepted':
        return TripStatus.accepted;
      case 'arrived':
        return TripStatus.arrived;
      case 'in_progress':
        return TripStatus.inProgress;
      case 'completed':
        return TripStatus.completed;
      case 'cancelled':
        return TripStatus.cancelled;
      default:
        throw ArgumentError('Unknown trip status: $value');
    }
  }
}

class Trip {
  final String id;
  final double pickupLat;
  final double pickupLng;
  final String? pickupLandmark;
  final double dropoffLat;
  final double dropoffLng;
  final String? dropoffLandmark;
  final String? requestedVehicleType;
  final TripStatus status;
  final String? fareAmount;
  /// Distance from the requesting driver's last-known position, in km.
  /// Only present when the backend knew where the driver was — see
  /// TripsService.listAvailable in the backend.
  final double? distanceKm;

  Trip({
    required this.id,
    required this.pickupLat,
    required this.pickupLng,
    this.pickupLandmark,
    required this.dropoffLat,
    required this.dropoffLng,
    this.dropoffLandmark,
    this.requestedVehicleType,
    required this.status,
    this.fareAmount,
    this.distanceKm,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    return Trip(
      id: json['id'] as String,
      pickupLat: (json['pickupLat'] as num).toDouble(),
      pickupLng: (json['pickupLng'] as num).toDouble(),
      pickupLandmark: json['pickupLandmark'] as String?,
      dropoffLat: (json['dropoffLat'] as num).toDouble(),
      dropoffLng: (json['dropoffLng'] as num).toDouble(),
      dropoffLandmark: json['dropoffLandmark'] as String?,
      requestedVehicleType: json['requestedVehicleType'] as String?,
      status: TripStatus.fromApiValue(json['status'] as String),
      fareAmount: json['fareAmount'] as String?,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
    );
  }
}
