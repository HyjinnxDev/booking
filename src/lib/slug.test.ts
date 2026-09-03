import { describe, it, expect } from 'vitest';
import { slugify, assignOfferingSlugs } from './slug';

const off = (name: string, locationId: string, locName: string | null = null) => ({
  slug: '',
  name,
  locationId,
  location: locName ? { name: locName } : null,
});

describe('slugify', () => {
  it('handles trailing digits and punctuation', () => {
    expect(slugify('Under 10')).toBe('under-10');
    expect(slugify('  Cardio Tennis!  ')).toBe('cardio-tennis');
  });
});

describe('assignOfferingSlugs (§2.9)', () => {
  it('disambiguates same-name offerings by location, deterministically', () => {
    const a = assignOfferingSlugs([off('Under 10', 'loc-b', 'North Courts'), off('Under 10', 'loc-a', 'South Courts')]);
    expect(a.map((o) => o.slug).sort()).toEqual(['under-10-north-courts', 'under-10-south-courts']);
  });

  it('is order-independent', () => {
    const s1 = assignOfferingSlugs([off('Private', 'l1', 'A'), off('Private', 'l2', 'B')]).map((o) => `${o.name}:${o.slug}`);
    const s2 = assignOfferingSlugs([off('Private', 'l2', 'B'), off('Private', 'l1', 'A')]).map((o) => `${o.name}:${o.slug}`);
    expect(new Set(s1)).toEqual(new Set(s2));
  });

  it('a unique name keeps the bare slug', () => {
    expect(assignOfferingSlugs([off('Cardio Tennis', 'l1', 'A')])[0].slug).toBe('cardio-tennis');
  });

  it('falls back to a numeric suffix when name+location both collide', () => {
    const out = assignOfferingSlugs([off('Squad', 'l1', 'A'), off('Squad', 'l2', 'A')]);
    expect(out.map((o) => o.slug).sort()).toEqual(['squad-a', 'squad-a-2']);
  });
});
