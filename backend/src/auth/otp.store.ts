import { Injectable } from '@nestjs/common';

interface OtpEntry {
  code: string;
  expiresAt: number;
}

/**
 * In-memory OTP store for Phase 1 development only.
 * Swap for Redis (with real SMS gateway dispatch) before launch — see
 * docs/MONZE_RIDE_ARCHITECTURE.md §3 (Real-time transport / SMS fallback).
 */
@Injectable()
export class OtpStore {
  private readonly entries = new Map<string, OtpEntry>();
  private readonly ttlMs = 5 * 60 * 1000;

  issue(phoneNumber: string): string {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.entries.set(phoneNumber, { code, expiresAt: Date.now() + this.ttlMs });
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
