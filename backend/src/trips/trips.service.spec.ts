import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripStatus } from '../entities/trip.entity';
import { PaymentMethod } from '../entities/payment-method.enum';
import { VehicleType } from '../entities/vehicle.entity';

function makeTrip(overrides: Partial<any> = {}) {
  return {
    id: 'trip-1',
    riderId: 'rider-1',
    driverId: null,
    pickupLat: -16.39,
    pickupLng: 27.48,
    dropoffLat: -16.4,
    dropoffLng: 27.49,
    status: TripStatus.REQUESTED,
    townId: null,
    paymentMethod: PaymentMethod.CASH,
    requestedAt: new Date(),
    ...overrides,
  };
}

describe('TripsService', () => {
  let trips: any;
  let events: any;
  let driversService: any;
  let usersService: any;
  let paymentsService: any;
  let zonesService: any;
  let fareRulesService: any;
  let townsService: any;
  let referralsService: any;
  let service: TripsService;

  beforeEach(() => {
    trips = {
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (data: any) => data),
      find: jest.fn(),
      findOneBy: jest.fn(),
      count: jest.fn(),
    };
    events = {
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => data),
    };
    driversService = { getByUserId: jest.fn() };
    usersService = { findById: jest.fn() };
    paymentsService = { recordCashPayment: jest.fn(), initiateMobileMoneyPayment: jest.fn() };
    zonesService = { findContainingPoint: jest.fn() };
    fareRulesService = { findOne: jest.fn() };
    townsService = { findContainingPoint: jest.fn() };
    referralsService = { rewardReferrerForFirstTrip: jest.fn() };

    service = new TripsService(
      trips,
      events,
      driversService,
      usersService,
      paymentsService,
      zonesService,
      fareRulesService,
      townsService,
      referralsService,
    );
  });

  describe('estimateFare', () => {
    const dto = { pickupLat: -16.39, pickupLng: 27.48, dropoffLat: -16.4, dropoffLng: 27.49 };

    it('returns no zone/estimates when the pickup is outside every configured zone', async () => {
      zonesService.findContainingPoint.mockResolvedValue(null);
      const result = await service.estimateFare(dto);
      expect(result.zoneId).toBeNull();
      expect(result.estimates).toEqual([]);
      expect(result.distanceKm).toBeGreaterThan(0);
    });

    it('returns one estimate per vehicle type priced in the zone', async () => {
      zonesService.findContainingPoint.mockResolvedValue({ id: 'zone-1', name: 'Town Center' });
      fareRulesService.findOne.mockImplementation(async (_zoneId: string, vehicleType: VehicleType) =>
        vehicleType === VehicleType.SEDAN ? { baseFare: '10', perKmRate: '3', perMinRate: '0.5' } : null,
      );
      const result = await service.estimateFare(dto);
      expect(result.zoneId).toBe('zone-1');
      expect(result.estimates).toHaveLength(1);
      expect(result.estimates[0].vehicleType).toBe(VehicleType.SEDAN);
      expect(result.estimates[0].fare).toBeGreaterThan(10); // base fare plus distance/time components
    });

    it('narrows to a single vehicle type when one is requested', async () => {
      zonesService.findContainingPoint.mockResolvedValue({ id: 'zone-1', name: 'Town Center' });
      fareRulesService.findOne.mockResolvedValue({ baseFare: '5', perKmRate: '1.5', perMinRate: '0.25' });
      await service.estimateFare({ ...dto, vehicleType: VehicleType.MOTORBIKE });
      expect(fareRulesService.findOne).toHaveBeenCalledTimes(1);
      expect(fareRulesService.findOne).toHaveBeenCalledWith('zone-1', VehicleType.MOTORBIKE);
    });
  });

  describe('request', () => {
    const dto = { pickupLat: -16.39, pickupLng: 27.48, dropoffLat: -16.4, dropoffLng: 27.49 };

    it('tags the trip with the pickup town when one is found', async () => {
      townsService.findContainingPoint.mockResolvedValue({ id: 'town-1', name: 'Monze' });
      const trip = await service.request('rider-1', dto as any);
      expect(trip.townId).toBe('town-1');
      expect(trips.save).toHaveBeenCalled();
      expect(events.save).toHaveBeenCalled();
    });

    it('leaves townId null when the pickup is outside every configured town', async () => {
      townsService.findContainingPoint.mockResolvedValue(null);
      const trip = await service.request('rider-1', dto as any);
      expect(trip.townId).toBeNull();
    });
  });

  describe('listAvailable', () => {
    it('returns the chronological list unfiltered when no driver location is known', async () => {
      const list = [makeTrip({ id: 'a' }), makeTrip({ id: 'b' })];
      trips.find.mockResolvedValue(list);
      const result = await service.listAvailable();
      expect(result).toBe(list);
      expect(townsService.findContainingPoint).not.toHaveBeenCalled();
    });

    it('sorts by distance to the driver when a location is known', async () => {
      const near = makeTrip({ id: 'near', pickupLat: -16.391, pickupLng: 27.481 });
      const far = makeTrip({ id: 'far', pickupLat: -17.0, pickupLng: 28.0 });
      trips.find.mockResolvedValue([far, near]);
      townsService.findContainingPoint.mockResolvedValue(null);

      const result = await service.listAvailable(-16.39, 27.48);
      expect(result.map((t) => t.id)).toEqual(['near', 'far']);
      expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm!);
    });

    it('scopes to the driver\'s own town, never hiding town-less trips', async () => {
      const inTown = makeTrip({ id: 'in-town', townId: 'town-1' });
      const otherTown = makeTrip({ id: 'other-town', townId: 'town-2' });
      const noTown = makeTrip({ id: 'no-town', townId: null });
      trips.find.mockResolvedValue([inTown, otherTown, noTown]);
      townsService.findContainingPoint.mockResolvedValue({ id: 'town-1', name: 'Monze' });

      const result = await service.listAvailable(-16.39, 27.48);
      const ids = result.map((t) => t.id).sort();
      expect(ids).toEqual(['in-town', 'no-town']);
    });

    it('applies no town scoping when the driver is outside every configured town', async () => {
      const list = [makeTrip({ id: 'a', townId: 'town-1' }), makeTrip({ id: 'b', townId: 'town-2' })];
      trips.find.mockResolvedValue(list);
      townsService.findContainingPoint.mockResolvedValue(null);

      const result = await service.listAvailable(-16.39, 27.48);
      expect(result.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('cancel', () => {
    it('cancels a trip the requesting rider owns while still requested', async () => {
      trips.findOneBy.mockResolvedValue(makeTrip({ status: TripStatus.REQUESTED }));
      const result = await service.cancel('trip-1', 'rider-1');
      expect(result.status).toBe(TripStatus.CANCELLED);
    });

    it('rejects cancellation by someone other than the requesting rider', async () => {
      trips.findOneBy.mockResolvedValue(makeTrip({ riderId: 'rider-1' }));
      await expect(service.cancel('trip-1', 'someone-else')).rejects.toThrow(ForbiddenException);
    });

    it('rejects cancelling a trip already in progress', async () => {
      trips.findOneBy.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS }));
      await expect(service.cancel('trip-1', 'rider-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('rewards the referrer only on the rider\'s first completed trip', async () => {
      driversService.getByUserId.mockResolvedValue({ id: 'driver-1', vehicle: { type: VehicleType.SEDAN } });
      trips.findOneBy.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS, driverId: 'driver-1' }));
      trips.count.mockResolvedValue(1); // this trip is their first ever completed one

      await service.complete('trip-1', 'driver-user-1', { fareAmount: 50 } as any);

      expect(referralsService.rewardReferrerForFirstTrip).toHaveBeenCalledWith('rider-1', 'trip-1');
    });

    it('does not reward on a rider\'s second completed trip', async () => {
      driversService.getByUserId.mockResolvedValue({ id: 'driver-1', vehicle: { type: VehicleType.SEDAN } });
      trips.findOneBy.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS, driverId: 'driver-1' }));
      trips.count.mockResolvedValue(2); // already had one before this

      await service.complete('trip-1', 'driver-user-1', { fareAmount: 50 } as any);

      expect(referralsService.rewardReferrerForFirstTrip).not.toHaveBeenCalled();
    });

    it('rejects completing a trip assigned to a different driver', async () => {
      driversService.getByUserId.mockResolvedValue({ id: 'driver-1' });
      trips.findOneBy.mockResolvedValue(
        makeTrip({ status: TripStatus.IN_PROGRESS, driverId: 'some-other-driver' }),
      );
      await expect(service.complete('trip-1', 'driver-user-1', { fareAmount: 50 } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('settles cash fares immediately via PaymentsService', async () => {
      driversService.getByUserId.mockResolvedValue({ id: 'driver-1', vehicle: { type: VehicleType.SEDAN } });
      trips.findOneBy.mockResolvedValue(
        makeTrip({ status: TripStatus.IN_PROGRESS, driverId: 'driver-1', paymentMethod: PaymentMethod.CASH }),
      );
      trips.count.mockResolvedValue(1);

      await service.complete('trip-1', 'driver-user-1', { fareAmount: 50 } as any);

      expect(paymentsService.recordCashPayment).toHaveBeenCalledWith(
        'trip-1',
        'driver-1',
        'rider-1',
        50,
        VehicleType.SEDAN,
      );
      expect(paymentsService.initiateMobileMoneyPayment).not.toHaveBeenCalled();
    });
  });
});
