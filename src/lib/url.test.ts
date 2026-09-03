import { describe, it, expect } from 'vitest';
import { safeNext } from './url';

describe('safeNext (§1.5)', () => {
  it('keeps a same-site absolute path', () => {
    expect(safeNext('/coach/schedule')).toBe('/coach/schedule');
    expect(safeNext('/bookings?saved=1')).toBe('/bookings?saved=1');
  });
  it('rejects off-site and scheme-relative targets', () => {
    for (const bad of ['//evil.com', 'https://evil.com', 'http://x', '\\\\evil.com', 'evil', '', null]) {
      expect(safeNext(bad)).toBe('/bookings');
    }
  });
  it('honours a custom fallback', () => {
    expect(safeNext('//evil', '/')).toBe('/');
  });
});
