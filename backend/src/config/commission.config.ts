import { VehicleType } from '../entities/vehicle.entity';

/**
 * Platform commission taken from every completed trip, by vehicle type.
 * Motorbikes carry a lower rate than cars/minibuses on purpose: running
 * costs are lower but so are fares, and a lower cut makes the platform a
 * more attractive channel for the motorbike-taxi supply Monze already has
 * (see docs/MONZE_RIDE_ARCHITECTURE.md §1, §6.3).
 *
 * These are launch defaults, not a policy carved in stone — move this to
 * an admin-configurable `FareRule`-style table (see architecture doc §5)
 * once the Phase 3 dashboard exists.
 */
export const COMMISSION_RATES: Record<VehicleType, number> = {
  [VehicleType.SEDAN]: 0.15,
  [VehicleType.MINIBUS]: 0.12,
  [VehicleType.MOTORBIKE]: 0.1,
};

export const DEFAULT_COMMISSION_RATE = 0.15;

/**
 * Cash-heavy market, so the driver already holds the fare after a trip —
 * the "deduction" is really a debt the driver owes the platform until they
 * remit it. Below this wallet balance (in ZMW) a driver is blocked from
 * going online again until an admin (or a future in-app settlement flow)
 * clears some of what's owed.
 */
export const MIN_WALLET_BALANCE_TO_GO_ONLINE = -100;
