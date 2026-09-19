import { HttpException, HttpStatus } from '@nestjs/common';
import { OtpStore } from './otp.store';

describe('OtpStore', () => {
  let store: OtpStore;

  beforeEach(() => {
    store = new OtpStore();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues a 4-digit numeric code', () => {
    const code = store.issue('+260970000001');
    expect(code).toMatch(/^\d{4}$/);
  });

  it('verifies a freshly issued code and consumes it', () => {
    const code = store.issue('+260970000001');
    expect(store.verify('+260970000001', code)).toBe(true);
    // Consumed — a repeat check with the same code now fails.
    expect(store.verify('+260970000001', code)).toBe(false);
  });

  it('rejects a wrong code', () => {
    store.issue('+260970000001');
    expect(store.verify('+260970000001', '0000')).toBe(false);
  });

  it('rejects a code for a phone number that never requested one', () => {
    expect(store.verify('+260970000099', '1234')).toBe(false);
  });

  it('rejects a code after it expires (5 minutes)', () => {
    const code = store.issue('+260970000001');
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(store.verify('+260970000001', code)).toBe(false);
  });

  it('accepts a code right up to the expiry boundary', () => {
    const code = store.issue('+260970000001');
    jest.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(store.verify('+260970000001', code)).toBe(true);
  });

  it('throws 429 on a resend within the 30s cooldown', () => {
    store.issue('+260970000001');
    expect(() => store.issue('+260970000001')).toThrow(HttpException);
    try {
      store.issue('+260970000001');
      fail('expected HttpException');
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('allows a resend once the cooldown has passed', () => {
    const first = store.issue('+260970000001');
    jest.advanceTimersByTime(30 * 1000 + 1);
    const second = store.issue('+260970000001');
    // The old code is invalidated by the new issue.
    expect(store.verify('+260970000001', first)).toBe(false);
    expect(store.verify('+260970000001', second)).toBe(true);
  });

  it('tracks cooldowns independently per phone number', () => {
    store.issue('+260970000001');
    expect(() => store.issue('+260970000002')).not.toThrow();
  });
});
