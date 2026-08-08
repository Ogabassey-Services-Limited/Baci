import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';
import { safeStorefrontUrlSchema } from './safe-storefront-url';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);

export const heroCarouselSlidePatchFields = {
  ctaLink: safeStorefrontUrlSchema.optional(),
  ctaText: boundedLabel.optional(),
  subtitle: boundedCopy.optional(),
  title: boundedLabel.optional(),
};
