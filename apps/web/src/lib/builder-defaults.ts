import { generateInitialTemplate } from './initial-template-generator';
import type { CuratedStorefrontData } from './storefront-defaults/curated-storefront-types';

/**
 * Generate default Puck config from merchant's existing template
 * This is used when no draft or published config exists
 */
// biome-ignore lint/suspicious/useAwait: Interface consistency
export async function generateDefaultConfig(
  merchant: Record<string, unknown>
): Promise<CuratedStorefrontData> {
  return generateInitialTemplate({
    businessName: (merchant?.business_name as string) || 'Your Store',
    businessType: (merchant?.business_type as string) || 'other',
    brandColors: (merchant?.brand_colors as {
      primary: string;
      background: string;
      accent: string;
    }) || {
      primary: '#3F51B5',
      background: '#FFFFFF',
      accent: '#FF5722',
    },
    merchant,
  });
}
