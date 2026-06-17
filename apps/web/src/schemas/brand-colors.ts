import { colord } from 'colord';
import { z } from 'zod';
import type { BrandColors } from '@/types';

const brandColorValueSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => colord(value).isValid(), {
    message: 'Expected a valid CSS color value.',
  });

export const brandColorsSchema: z.ZodType<BrandColors> = z
  .object({
    primary: brandColorValueSchema,
    background: brandColorValueSchema,
    accent: brandColorValueSchema,
  })
  .strict();

export function parseBrandColors(value: unknown): BrandColors | null {
  const result = brandColorsSchema.safeParse(value);
  return result.success ? result.data : null;
}
