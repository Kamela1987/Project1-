import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '../src/entities/user.entity';
import { createTestApp, FakeSmsService } from './utils/test-app';
import { authHeader, seedAdmin, signUp } from './utils/auth-helpers';

describe('Trip lifecycle (e2e)', () => {
  let app: INestApplication;
  let sms: FakeSmsService;
  let moduleRef: TestingModule;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, sms, moduleRef } = await createTestApp());

    const admin = await seedAdmin(moduleRef);
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber: admin.phoneNumber }).expect(201);
    const otp = sms.lastCode(admin.phoneNumber);
    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phoneNumber: admin.phoneNumber, otp })
      .expect(201);
    adminToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Registers, and gets a driver approved + online, ready to accept trips. */
  async function onboardApprovedDriver(name: string) {
    const driver = await signUp(app, sms, { name, role: UserRole.DRIVER });

    await request(app.getHttpServer())
      .post('/drivers/register')
      .set(...authHeader(driver.token))
      .send({ licenseNumber: `LIC-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
      .expect(201);

    await request(app.getHttpServer())
      .post('/drivers/vehicle')
      .set(...authHeader(driver.token))
      .send({ type: 'sedan', plateNumber: `E2E-${Math.random().toString(36).slice(2, 7).toUpperCase()}` })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/drivers/me')
      .set(...authHeader(driver.token))
      .expect(200);
    const driverId = me.body.id as string;

    await request(app.getHttpServer())
      .patch(`/drivers/${driverId}/approve`)
      .set(...authHeader(adminToken))
      .expect(200);

    await request(app.getHttpServer())
      .patch('/drivers/online')
      .set(...authHeader(driver.token))
      .send({ isOnline: true })
      .expect(200);

    return { ...driver, driverId };
  }

  it('a driver cannot go online before being approved', async () => {
    const driver = await signUp(app, sms, { name: 'Unapproved Driver', role: UserRole.DRIVER });
    await request(app.getHttpServer())
      .post('/drivers/register')
      .set(...authHeader(driver.token))
      .send({ licenseNumber: `LIC-E2E-${Date.now()}` })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/drivers/online')
      .set(...authHeader(driver.token))
      .send({ isOnline: true })
      .expect(400);
  });

  it('runs a full cash trip end to end: request -> accept -> arrive -> start -> complete, with commission applied', async () => {
    const rider = await signUp(app, sms, { name: 'E2E Rider', role: UserRole.RIDER });
    const driver = await onboardApprovedDriver('E2E Cash Driver');

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set(...authHeader(rider.token))
      .send({
        pickupLat: -16.39,
        pickupLng: 27.48,
        pickupLandmark: 'E2E test pickup',
        dropoffLat: -16.4,
        dropoffLng: 27.49,
        dropoffLandmark: 'E2E test dropoff',
      })
      .expect(201);
    const tripId = tripRes.body.id as string;
    expect(tripRes.body.status).toBe('requested');

    const available = await request(app.getHttpServer())
      .get('/trips/available')
      .set(...authHeader(driver.token))
      .expect(200);
    expect(available.body.some((t: { id: string }) => t.id === tripId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/accept`)
      .set(...authHeader(driver.token))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/arrived`)
      .set(...authHeader(driver.token))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/start`)
      .set(...authHeader(driver.token))
      .expect(200);

    const completed = await request(app.getHttpServer())
      .patch(`/trips/${tripId}/complete`)
      .set(...authHeader(driver.token))
      .send({ fareAmount: 100 })
      .expect(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.fareAmount).toBe('100.00');

    // Sedan commission is 15% (COMMISSION_RATES) — a cash fare is a debt against the driver until settled.
    const wallet = await request(app.getHttpServer())
      .get('/drivers/me/wallet')
      .set(...authHeader(driver.token))
      .expect(200);
    expect(wallet.body.balance).toBe(-15);
    expect(wallet.body.entries[0]).toMatchObject({ type: 'commission', amount: '-15.00' });
  });

  it('only the trip\'s participants or an admin can view it', async () => {
    const rider = await signUp(app, sms, { name: 'E2E Private Rider', role: UserRole.RIDER });
    const outsider = await signUp(app, sms, { name: 'E2E Outsider', role: UserRole.RIDER });

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set(...authHeader(rider.token))
      .send({ pickupLat: -16.39, pickupLng: 27.48, dropoffLat: -16.4, dropoffLng: 27.49 })
      .expect(201);
    const tripId = tripRes.body.id as string;

    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set(...authHeader(rider.token))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set(...authHeader(outsider.token))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set(...authHeader(adminToken))
      .expect(200);
  });

  it('rewards the referrer once the referred rider completes their first trip', async () => {
    const referrer = await signUp(app, sms, { name: 'E2E Reward Referrer', role: UserRole.RIDER });
    const referrerProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set(...authHeader(referrer.token))
      .expect(200);

    const referredRider = await signUp(app, sms, {
      name: 'E2E Reward Referred',
      role: UserRole.RIDER,
      referralCode: referrerProfile.body.referralCode,
    });
    const driver = await onboardApprovedDriver('E2E Reward Driver');

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set(...authHeader(referredRider.token))
      .send({ pickupLat: -16.39, pickupLng: 27.48, dropoffLat: -16.4, dropoffLng: 27.49 })
      .expect(201);
    const tripId = tripRes.body.id as string;

    await request(app.getHttpServer()).patch(`/trips/${tripId}/accept`).set(...authHeader(driver.token)).expect(200);
    await request(app.getHttpServer()).patch(`/trips/${tripId}/arrived`).set(...authHeader(driver.token)).expect(200);
    await request(app.getHttpServer()).patch(`/trips/${tripId}/start`).set(...authHeader(driver.token)).expect(200);
    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/complete`)
      .set(...authHeader(driver.token))
      .send({ fareAmount: 40 })
      .expect(200);

    const referrals = await request(app.getHttpServer())
      .get('/users/me/referrals')
      .set(...authHeader(referrer.token))
      .expect(200);
    // Default REFERRAL_REWARD_AMOUNT — see config/referral.config.ts.
    expect(referrals.body.referralCreditBalance).toBe(20);
    expect(referrals.body.rewards).toHaveLength(1);
    expect(referrals.body.rewards[0]).toMatchObject({ tripId, referredUserId: referredRider.userId });
  });

  it('fare-estimate returns no zone/estimates when no zone is configured for the pickup', async () => {
    const res = await request(app.getHttpServer())
      .post('/trips/fare-estimate')
      .set(...authHeader(adminToken))
      .send({ pickupLat: -16.39, pickupLng: 27.48, dropoffLat: -16.4, dropoffLng: 27.49 })
      .expect(201);

    expect(res.body.zoneId).toBeNull();
    expect(res.body.estimates).toEqual([]);
    expect(res.body.distanceKm).toBeGreaterThan(0);
  });
});
