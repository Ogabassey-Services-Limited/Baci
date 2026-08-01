import { builderConfigSchema } from '@/schemas/builder';

export function hasPublishedHero(value: unknown): boolean {
  const parsed = builderConfigSchema.safeParse(value);
  if (!parsed.success) return false;

  const zoneContent = Object.values(parsed.data.zones).flatMap((zone) =>
    Array.isArray(zone) ? zone : []
  );

  return [...parsed.data.content, ...zoneContent].some(
    (component) =>
      typeof component === 'object' &&
      component !== null &&
      'type' in component &&
      (component.type === 'Hero' ||
        component.type === 'HeroCarousel' ||
        component.type === 'OgabasseyHero')
  );
}
