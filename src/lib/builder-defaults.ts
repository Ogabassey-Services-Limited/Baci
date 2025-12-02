import type { Data } from '@measured/puck';
import { generateInitialTemplate } from './initial-template-generator';

/**
 * Generate default Puck config from merchant's existing template
 * This is used when no draft or published config exists
 */
export async function generateDefaultConfig(
  merchant: Record<string, unknown>
): Promise<Data> {
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
