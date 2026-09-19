export type UserRole = 'rider' | 'driver' | 'admin';

/** The envelope GET /drivers and GET /trips return (`?page=&pageSize=`, defaults 1/50 — see backend README's "Pagination" section). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type VehicleType = 'sedan' | 'minibus' | 'motorbike';
export type DriverVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface Vehicle {
  id: string;
  driverId: string;
  type: VehicleType;
  plateNumber: string;
  photoUrl?: string | null;
}

export interface Driver {
  id: string;
  userId: string;
  licenseNumber: string;
  verificationStatus: DriverVerificationStatus;
  isOnline: boolean;
  user?: User;
  vehicle?: Vehicle;
  walletBalance?: number;
  rating?: { average: number | null; count: number };
}

export type TripStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'momo' | 'airtel';

export interface Trip {
  id: string;
  riderId: string;
  driverId: string | null;
  pickupLat: number;
  pickupLng: number;
  pickupLandmark?: string | null;
  dropoffLat: number;
  dropoffLng: number;
  dropoffLandmark?: string | null;
  requestedVehicleType: VehicleType | null;
  paymentMethod: PaymentMethod;
  status: TripStatus;
  fareAmount: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface Zone {
  id: string;
  name: string;
}

export interface FareRule {
  id: string;
  zoneId: string;
  vehicleType: VehicleType;
  baseFare: string;
  perKmRate: string;
  perMinRate: string;
}

export type DisputeStatus = 'open' | 'resolved';

export interface Dispute {
  id: string;
  tripId: string;
  raisedByUserId: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}
