import { describe, it, expect } from 'vitest';
import { latestPerLiveSeries, weeklySeries } from './sessions';

describe('latestPerLiveSeries (§2.1)', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  const row = (series_id: string | null, start_at: string) => ({ series_id, start_at });

  it('picks the newest future occurrence per series', () => {
    const rows = [
      row('a', '2026-06-20T09:00:00Z'),
      row('a', '2026-06-27T09:00:00Z'),
      row('a', '2026-06-13T09:00:00Z'), // past — ignored
      row('b', '2026-07-01T18:00:00Z'),
    ];
    const out = latestPerLiveSeries(rows, now).sort((x, y) => x.series_id!.localeCompare(y.series_id!));
    expect(out).toEqual([row('a', '2026-06-27T09:00:00Z'), row('b', '2026-07-01T18:00:00Z')]);
  });

  it('a series whose last occurrence is in the past is dead — nothing returned', () => {
    const rows = [row('a', '2026-05-01T09:00:00Z'), row('a', '2026-06-08T09:00:00Z')];
    expect(latestPerLiveSeries(rows, now)).toEqual([]);
  });

  it('ignores rows with a null series_id', () => {
    expect(latestPerLiveSeries([row(null, '2026-07-01T09:00:00Z')], now)).toEqual([]);
  });
});

describe('weeklySeries across a DST boundary', () => {
  // Australia/Adelaide leaves DST 2026-04-05 03:00 (ACDT UTC+10:30 -> ACST UTC+9:30).
  it('keeps 18:00 local before and after the change', () => {
    const rows = weeklySeries('2026-03-29', '18:00', 60, '2026-04-12');
    // 2026-03-29 18:00 ACDT = 07:30 UTC ; 2026-04-12 18:00 ACST = 08:30 UTC
    expect(rows[0].start_at).toBe('2026-03-29T07:30:00.000Z');
    expect(rows.at(-1)!.start_at).toBe('2026-04-12T08:30:00.000Z');
    expect(rows).toHaveLength(3);
  });
});
