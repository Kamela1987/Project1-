import { haversineKm } from './geo.util';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(-16.39, 27.48, -16.39, 27.48)).toBe(0);
  });

  it('matches a known distance (Monze to Lusaka, ~180km)', () => {
    const distance = haversineKm(-16.39, 27.48, -15.4067, 28.2833);
    expect(distance).toBeGreaterThan(120);
    expect(distance).toBeLessThan(150);
  });

  it('is symmetric', () => {
    const a = haversineKm(-16.39, 27.48, -16.4, 27.49);
    const b = haversineKm(-16.4, 27.49, -16.39, 27.48);
    expect(a).toBeCloseTo(b, 10);
  });

  it('scales roughly linearly for small distances', () => {
    // ~0.01 degrees latitude is close to 1.11km near the equator-ish band Zambia sits in.
    const distance = haversineKm(-16.39, 27.48, -16.4, 27.48);
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(1.2);
  });
});
