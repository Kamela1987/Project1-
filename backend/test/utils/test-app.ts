import { randomInt } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { SmsService } from '../../src/auth/sms.service';

/**
 * Stands in for the real SmsService at the one external-I/O boundary an
 * e2e test can't (and shouldn't) go through for real — no actual SMS
 * gateway call, just records the code so a test can read it back, the
 * same role `backend/server.log`-grepping played in this project's manual
 * verification all session, but deterministic instead of log-parsing.
 */
export class FakeSmsService {
  private readonly sent = new Map<string, string[]>();

  async send(phoneNumber: string, message: string): Promise<void> {
    const match = message.match(/code is (\d+)/);
    if (!match) {
      throw new Error(`FakeSmsService couldn't find an OTP in message: ${message}`);
    }
    const codes = this.sent.get(phoneNumber) ?? [];
    codes.push(match[1]);
    this.sent.set(phoneNumber, codes);
  }

  /** The most recently issued OTP for this phone number — throws if none was ever sent, so a test fails loudly instead of asserting against `undefined`. */
  lastCode(phoneNumber: string): string {
    const codes = this.sent.get(phoneNumber);
    if (!codes?.length) {
      throw new Error(`FakeSmsService has no OTP recorded for ${phoneNumber}`);
    }
    return codes[codes.length - 1];
  }
}

/**
 * Boots the real, full AppModule — real Postgres/PostGIS, real Redis, the
 * exact same ValidationPipe config main.ts uses — against a real HTTP
 * server (via supertest). The only override is SmsService (see
 * FakeSmsService above); everything else is the genuine wiring. Requires
 * DB_ and REDIS_ env vars pointing at a real, already-migrated database —
 * see backend-ci.yml's e2e test step, or run
 * `docker compose up -d && npm run migration:run` locally first.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  sms: FakeSmsService;
  moduleRef: TestingModule;
}> {
  const sms = new FakeSmsService();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SmsService)
    .useValue(sms)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, sms, moduleRef };
}

/**
 * A fresh, valid-format Zambian phone number per call — e2e tests each
 * need their own real users (OTP request/verify, referral linkage, ...),
 * and reusing a fixed number across tests would collide with
 * OtpStore's resend cooldown and each user's "already registered" state.
 */
export function uniquePhone(): string {
  const suffix = randomInt(0, 9999999).toString().padStart(7, '0');
  return `+26097${suffix}`;
}
