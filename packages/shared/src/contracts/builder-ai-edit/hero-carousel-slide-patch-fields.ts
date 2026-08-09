import { z } from 'zod';
import { builderDesignCapabilityAdapter } from '../builder-design-capability-adapter';
import { safeStorefrontUrlSchema } from './safe-storefront-url';

function compileField(descriptor: { maximumLength?: number; type: string }) {
  if (descriptor.type === 'safe-link')
    return safeStorefrontUrlSchema.optional();
  if (descriptor.type === 'string') {
    return z
      .string()
      .trim()
      .min(1)
      .max(descriptor.maximumLength ?? Number.MAX_SAFE_INTEGER)
      .optional();
  }
  throw new Error(
    `Unsupported HeroCarousel descriptor type: ${descriptor.type}`
  );
}

const props =
  builderDesignCapabilityAdapter.getCapability('HeroCarousel')
    ?.specialOperations?.updateCarouselSlide;
if (!props)
  throw new Error('Missing HeroCarousel updateCarouselSlide contract');

export const heroCarouselSlidePatchFields: Record<string, z.ZodType> =
  Object.fromEntries(
    Object.entries(props).map(([property, descriptor]) => [
      property,
      compileField(descriptor),
    ])
  );
