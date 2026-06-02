import z from 'zod';

/**
 * Zod Schema for normalizing merchant feature settings (2026 Core Pillar)
 * Supabase joins return feature_settings as an array [object].
 * This schema automatically transforms it into a single object or null.
 */
export const FeatureSettingsSchema = z
  .unknown()
  .transform((val) => {
    if (Array.isArray(val)) return val[0] || null;
    return val;
  })
  .pipe(z.record(z.string(), z.unknown()).nullable());
