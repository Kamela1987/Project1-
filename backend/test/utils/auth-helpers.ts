import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../src/entities/user.entity';
import { FakeSmsService, uniquePhone } from './test-app';

/**
 * Admin accounts have no signup API by design (AuthService.verifyOtp
 * refuses role: "admin" — see scripts/create-admin.ts, the real
 * out-of-band equivalent). Mirrors that script but via the TypeORM
 * repository instead of a raw DataSource, since the test app already has
 * one wired up.
 */
export async function seedAdmin(moduleRef: TestingModule, name = 'E2E Admin'): Promise<{ phoneNumber: string; userId: string }> {
  const users = moduleRef.get<Repository<User>>(getRepositoryToken(User));
  const phoneNumber = uniquePhone();
  const admin = await users.save(users.create({ phoneNumber, name, role: UserRole.ADMIN }));
  return { phoneNumber, userId: admin.id };
}

/** Full request-otp -> verify-otp signup flow over real HTTP, returning the new user's JWT, id, and phone. */
export async function signUp(
  app: INestApplication,
  sms: FakeSmsService,
  opts: { name: string; role?: UserRole; referralCode?: string },
): Promise<{ token: string; phoneNumber: string; userId: string }> {
  const phoneNumber = uniquePhone();
  await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
  const otp = sms.lastCode(phoneNumber);

  const res = await request(app.getHttpServer())
    .post('/auth/verify-otp')
    .send({ phoneNumber, otp, name: opts.name, role: opts.role, referralCode: opts.referralCode })
    .expect(201);

  const token = res.body.accessToken as string;
  const me = await request(app.getHttpServer())
    .get('/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return { token, phoneNumber, userId: me.body.id as string };
}

/** Logs an *already-existing* user back in (e.g. one seeded directly via the User repository, like an admin — see docs on why admin signup has no API path). */
export async function logIn(
  app: INestApplication,
  sms: FakeSmsService,
  phoneNumber: string,
): Promise<string> {
  await request(app.getHttpServer()).post('/auth/request-otp').send({ phoneNumber }).expect(201);
  const otp = sms.lastCode(phoneNumber);
  const res = await request(app.getHttpServer())
    .post('/auth/verify-otp')
    .send({ phoneNumber, otp })
    .expect(201);
  return res.body.accessToken as string;
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
