export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * §2.9: deterministic, stable slugs. Sorts first so assignment doesn't depend on
 * DB row order, disambiguates same-name offerings by location name (readable +
 * stable across adding a location), then a numeric suffix as a last resort.
 * Mutates `slug` on each offering and returns the sorted array.
 */
export function assignOfferingSlugs<
  T extends { slug: string; name: string; locationId: string; location: { name: string } | null },
>(offerings: T[]): T[] {
  offerings.sort((a, b) => a.name.localeCompare(b.name) || a.locationId.localeCompare(b.locationId));
  const baseCount = new Map<string, number>();
  for (const g of offerings) {
    const base = slugify(g.name);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }
  const used = new Set<string>();
  for (const g of offerings) {
    const base = slugify(g.name);
    const slug =
      (baseCount.get(base) ?? 0) > 1 && g.location?.name ? `${base}-${slugify(g.location.name)}` : base;
    let candidate = slug;
    for (let i = 2; used.has(candidate); i++) candidate = `${slug}-${i}`;
    used.add(candidate);
    g.slug = candidate;
  }
  return offerings;
}
