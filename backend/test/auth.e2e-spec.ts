import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '../src/entities/user.entity';
import { createTestApp, FakeSmsService, uniquePhone } from './utils/test-app';
import { authHeader, signUp } from './utils/auth-helpers';

describe('Auth + referrals (e2e)', () => {
  let app: INestApplication;
  let sms: FakeSmsService;

  beforeAll(async () => {
    ({ app, sms } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user on first verify-otp and issues a JWT', async () => {
    const phoneNumber = uniquePhone();
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
    const otp = sms.lastCode(phoneNumber);

    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phoneNumber, otp, name: 'E2E New User', role: UserRole.RIDER })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set(...authHeader(res.body.accessToken))
      .expect(200);
    expect(me.body.phoneNumber).toBe(phoneNumber);
    expect(me.body.name).toBe('E2E New User');
    expect(me.body.role).toBe(UserRole.RIDER);
    // Assigned automatically at signup — see ReferralsService.generateUniqueCode.
    expect(me.body.referralCode).toMatch(/^[0-9A-F]{8}$/);
  });

  it('rejects verify-otp with the wrong code', async () => {
    const phoneNumber = uniquePhone();
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);

    await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phoneNumber, otp: '0000', name: 'Should Fail' })
      .expect(401);
  });

  it('rejects a second request-otp within the resend cooldown', async () => {
    const phoneNumber = uniquePhone();
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(429);
  });

  it('rejects self-registering as admin', async () => {
    const phoneNumber = uniquePhone();
    await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
    const otp = sms.lastCode(phoneNumber);

    await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phoneNumber, otp, name: 'Wannabe Admin', role: UserRole.ADMIN })
      .expect(403);
  });

  describe('referral linkage', () => {
    it('rejects signup with an unknown referral code', async () => {
      const phoneNumber = uniquePhone();
      await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
      const otp = sms.lastCode(phoneNumber);

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ phoneNumber, otp, name: 'Bad Referral', referralCode: 'NOTAREALCODE' })
        .expect(400);
    });

    it('links a new signup to the referrer and shows up in the referrer\'s /users/me/referrals', async () => {
      const referrer = await signUp(app, sms, { name: 'E2E Referrer', role: UserRole.RIDER });

      const referrerProfile = await request(app.getHttpServer())
        .get('/users/me')
        .set(...authHeader(referrer.token))
        .expect(200);
      const referralCode = referrerProfile.body.referralCode as string;

      const referred = await signUp(app, sms, {
        name: 'E2E Referred',
        role: UserRole.RIDER,
        referralCode,
      });

      const referredProfile = await request(app.getHttpServer())
        .get('/users/me')
        .set(...authHeader(referred.token))
        .expect(200);
      expect(referredProfile.body.referredByUserId).toBe(referrer.userId);

      const referrals = await request(app.getHttpServer())
        .get('/users/me/referrals')
        .set(...authHeader(referrer.token))
        .expect(200);
      expect(referrals.body.referredCount).toBeGreaterThanOrEqual(1);
      expect(referrals.body.referralCreditBalance).toBe(0); // no reward yet — that needs a completed trip, see trips.e2e-spec.ts
    });
  });
});
