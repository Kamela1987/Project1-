import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '../src/entities/user.entity';
import { createTestApp, FakeSmsService } from './utils/test-app';
import { authHeader, seedAdmin, signUp } from './utils/auth-helpers';

describe('Zones + towns (e2e)', () => {
  let app: INestApplication;
  let sms: FakeSmsService;
  let moduleRef: TestingModule;
  let adminToken: string;

  // A real, non-trivial square boundary — proves PostGIS point-in-polygon
  // matching actually works, not just that the boundary column accepts data.
  // Offset well clear of the fixed coordinates other spec files use (all
  // around lng ~27.4x), by a per-run random amount, so this zone/town never
  // spatially collides with them — whether they run in the same process
  // (all spec files share one DB per `npm run test:e2e` invocation) or a
  // previous manual run against a persistent (non-CI-fresh) database.
  const offset = 50 + Math.random() * 10;
  const boundary: [number, number][] = [
    [27.47 + offset, -16.4],
    [27.49 + offset, -16.4],
    [27.49 + offset, -16.38],
    [27.47 + offset, -16.38],
    [27.47 + offset, -16.4],
  ];
  const insideBoundary = { lat: -16.39, lng: 27.48 + offset };
  const outsideBoundary = { lat: -18.0, lng: 26.0 };

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

  it('a non-admin cannot create a zone', async () => {
    const rider = await signUp(app, sms, { name: 'E2E Zone Rider', role: UserRole.RIDER });
    await request(app.getHttpServer())
      .post('/zones')
      .set(...authHeader(rider.token))
      .send({ name: `Should Fail Zone ${Date.now()}` })
      .expect(403);
  });

  it('rejects a boundary that is not a closed ring', async () => {
    await request(app.getHttpServer())
      .post('/zones')
      .set(...authHeader(adminToken))
      .send({ name: `Open Ring Zone ${Date.now()}`, boundary: boundary.slice(0, -1) })
      .expect(400);
  });

  it('creates a zone with a real boundary, and PostGIS correctly matches points against it', async () => {
    const zoneName = `E2E Town Center ${Date.now()}`;
    const zoneRes = await request(app.getHttpServer())
      .post('/zones')
      .set(...authHeader(adminToken))
      .send({ name: zoneName, boundary })
      .expect(201);
    const zoneId = zoneRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/zones/${zoneId}/fare-rules`)
      .set(...authHeader(adminToken))
      .send({ vehicleType: 'sedan', baseFare: 10, perKmRate: 3, perMinRate: 0.5 })
      .expect(201);

    const insideEstimate = await request(app.getHttpServer())
      .post('/trips/fare-estimate')
      .set(...authHeader(adminToken))
      .send({
        pickupLat: insideBoundary.lat,
        pickupLng: insideBoundary.lng,
        dropoffLat: insideBoundary.lat - 0.01,
        dropoffLng: insideBoundary.lng + 0.01,
        vehicleType: 'sedan',
      })
      .expect(201);
    expect(insideEstimate.body.zoneId).toBe(zoneId);
    expect(insideEstimate.body.estimates).toHaveLength(1);
    expect(insideEstimate.body.estimates[0].fare).toBeGreaterThan(10); // base fare plus distance/time

    const outsideEstimate = await request(app.getHttpServer())
      .post('/trips/fare-estimate')
      .set(...authHeader(adminToken))
      .send({
        pickupLat: outsideBoundary.lat,
        pickupLng: outsideBoundary.lng,
        dropoffLat: outsideBoundary.lat - 0.01,
        dropoffLng: outsideBoundary.lng + 0.01,
      })
      .expect(201);
    expect(outsideEstimate.body.zoneId).toBeNull();
    expect(outsideEstimate.body.estimates).toEqual([]);
  });

  it('creates a town with a boundary, and scopes a trip requested inside it', async () => {
    const townName = `E2E Town ${Date.now()}`;
    const townRes = await request(app.getHttpServer())
      .post('/towns')
      .set(...authHeader(adminToken))
      .send({ name: townName, boundary })
      .expect(201);
    const townId = townRes.body.id as string;

    const rider = await signUp(app, sms, { name: 'E2E Town Rider', role: UserRole.RIDER });
    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set(...authHeader(rider.token))
      .send({
        pickupLat: insideBoundary.lat,
        pickupLng: insideBoundary.lng,
        dropoffLat: insideBoundary.lat - 0.01,
        dropoffLng: insideBoundary.lng + 0.01,
      })
      .expect(201);
    expect(tripRes.body.townId).toBe(townId);

    const tripsInTown = await request(app.getHttpServer())
      .get(`/trips?townId=${townId}`)
      .set(...authHeader(adminToken))
      .expect(200);
    expect(tripsInTown.body.items.some((t: { id: string }) => t.id === tripRes.body.id)).toBe(true);
  });

  it('404s creating a zone with an unknown townId', async () => {
    await request(app.getHttpServer())
      .post('/zones')
      .set(...authHeader(adminToken))
      .send({ name: `Orphan Zone ${Date.now()}`, townId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });
});
