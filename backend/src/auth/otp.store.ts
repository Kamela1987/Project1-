import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface OtpEntry {
  code: string;
  expiresAt: number;
  issuedAt: number;
}

/**
 * In-memory OTP store for Phase 1. Still fine now that SMS delivery is a
 * real paid gateway (see sms.service.ts) — the process-local `resendCooldownMs`
 * throttle below is what actually matters for cost/abuse control, not
 * durability. Swap for Redis before running multiple backend instances,
 * since the in-memory map wouldn't be shared across them.
 */
@Injectable()
export class OtpStore {
  private readonly entries = new Map<string, OtpEntry>();
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly resendCooldownMs = 30 * 1000;

  issue(phoneNumber: string): string {
    const existing = this.entries.get(phoneNumber);
    if (existing && existing.issuedAt + this.resendCooldownMs > Date.now()) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.entries.set(phoneNumber, { code, expiresAt: Date.now() + this.ttlMs, issuedAt: Date.now() });
    return code;
  }

  verify(phoneNumber: string, code: string): boolean {
    const entry = this.entries.get(phoneNumber);
    if (!entry || entry.expiresAt < Date.now()) {
      return false;
    }
    const isValid = entry.code === code;
    if (isValid) {
      this.entries.delete(phoneNumber);
    }
    return isValid;
  }
}
