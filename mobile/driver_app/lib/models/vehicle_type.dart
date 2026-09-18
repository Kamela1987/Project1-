/// Mirrors backend/src/entities/vehicle.entity.ts VehicleType.
enum VehicleType {
  sedan,
  minibus,
  motorbike;

  String get apiValue => name;

  String get label {
    switch (this) {
      case VehicleType.sedan:
        return 'Car';
      case VehicleType.minibus:
        return 'Minibus';
      case VehicleType.motorbike:
        return 'Motorbike';
    }
  }
}
