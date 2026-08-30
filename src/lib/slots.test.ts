import { describe, it, expect } from 'vitest';
import { computeSlots, weekdayOf, type AvailabilityRule } from './slots';

// SLOT_MINUTES is 60 (see config.ts).
const FIXED_NOW = new Date('2020-01-01T00:00:00Z'); // far in the past -> nothing filtered

function run(dateStr: string, tz: string, rules: AvailabilityRule[], extra: Partial<Parameters<typeof computeSlots>[0]> = {}) {
  return computeSlots({ dateStr, tz, rules, bookedStartsUtc: [], isBlackout: false, now: FIXED_NOW, ...extra });
}

describe('weekdayOf', () => {
  it('is timezone independent', () => {
    expect(weekdayOf('2026-03-08')).toBe(0); // Sunday
    expect(weekdayOf('2026-03-09')).toBe(1); // Monday
  });
});

describe('DST — America/New_York', () => {
  const tz = 'America/New_York';
  const sundayRule: AvailabilityRule[] = [{ weekday: 0, start_time: '09:00', end_time: '11:00' }];

  it('EST before spring-forward: 09:00 local = 14:00 UTC', () => {
    const slots = run('2026-03-01', tz, sundayRule);
    expect(slots[0].startAt).toBe('2026-03-01T14:00:00.000Z');
    expect(slots[1].startAt).toBe('2026-03-01T15:00:00.000Z');
  });

  it('EDT after spring-forward (DST began 2026-03-08 02:00): 09:00 local = 13:00 UTC', () => {
    const slots = run('2026-03-08', tz, sundayRule);
    expect(slots[0].startAt).toBe('2026-03-08T13:00:00.000Z');
    expect(slots.map((s) => s.endAt)).toEqual([
      '2026-03-08T14:00:00.000Z',
      '2026-03-08T15:00:00.000Z',
    ]);
  });

  it('fall-back day (2026-11-01): a window crossing 01:00–02:00 stays monotonic', () => {
    const slots = run('2026-11-01', tz, [{ weekday: 0, start_time: '00:00', end_time: '05:00' }]);
    const times = slots.map((s) => new Date(s.startAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
    // 5 one-hour slots requested; the repeated wall hour collapses one.
    expect(slots.length).toBeGreaterThanOrEqual(4);
  });
});

describe('DST — Australia/Sydney', () => {
  const tz = 'Australia/Sydney';
  // DST ends 2026-04-05 03:00 (AEDT +11 -> AEST +10).
  const sundayRule: AvailabilityRule[] = [{ weekday: 0, start_time: '08:00', end_time: '10:00' }];

  it('AEDT before: 08:00 local = 21:00 UTC previous day', () => {
    const slots = run('2026-03-29', tz, sundayRule);
    expect(slots[0].startAt).toBe('2026-03-28T21:00:00.000Z');
  });

  it('AEST after DST ends: 08:00 local = 22:00 UTC previous day', () => {
    const slots = run('2026-04-05', tz, sundayRule);
    expect(slots[0].startAt).toBe('2026-04-04T22:00:00.000Z');
  });
});

describe('exclusions', () => {
  const tz = 'America/New_York';
  const rule: AvailabilityRule[] = [{ weekday: 1, start_time: '09:00', end_time: '12:00' }];

  it('removes already-booked starts', () => {
    const all = run('2026-03-09', tz, rule);
    const withoutFirst = run('2026-03-09', tz, rule, { bookedStartsUtc: [all[0].startAt] });
    expect(withoutFirst.map((s) => s.startAt)).toEqual(all.slice(1).map((s) => s.startAt));
  });

  it('blackout day yields no slots', () => {
    expect(run('2026-03-09', tz, rule, { isBlackout: true })).toEqual([]);
  });

  it('filters slots at or before now', () => {
    const slots = run('2026-03-09', tz, rule, { now: new Date('2026-03-09T15:00:00.000Z') });
    // 09:00 & 10:00 EDT (13:00, 14:00 UTC) are past; 11:00 EDT (15:00 UTC) is not > now.
    expect(slots).toEqual([]);
  });

  it('dedupes overlapping availability rules', () => {
    const overlapping: AvailabilityRule[] = [
      { weekday: 1, start_time: '09:00', end_time: '11:00' },
      { weekday: 1, start_time: '10:00', end_time: '12:00' },
    ];
    const slots = run('2026-03-09', tz, overlapping);
    expect(slots.map((s) => s.startAt)).toEqual([
      '2026-03-09T13:00:00.000Z',
      '2026-03-09T14:00:00.000Z',
      '2026-03-09T15:00:00.000Z',
    ]);
  });
});
