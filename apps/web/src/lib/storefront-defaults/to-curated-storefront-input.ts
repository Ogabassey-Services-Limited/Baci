import { isValidImageUrl } from '@/lib/image-utils';
import { parseBrandColors } from '@/schemas/brand-colors';
import type {
  CuratedStorefrontInput,
  GenerateInitialTemplateParams,
} from './curated-storefront-types';

export function toCuratedStorefrontInput(
  params: GenerateInitialTemplateParams
): CuratedStorefrontInput {
  const merchant = params.merchant ?? {};
  const logoUrl =
    typeof merchant.logo_url === 'string' && isValidImageUrl(merchant.logo_url)
      ? merchant.logo_url
      : undefined;
  return {
    businessName: params.businessName.trim() || 'Your Store',
    businessType: params.businessType.trim(),
    country:
      typeof merchant.country === 'string' ? merchant.country.trim() : '',
    brandColors: parseBrandColors(params.brandColors) ?? {
      primary: '#3F51B5',
      background: '#FFFFFF',
      accent: '#FF5722',
    },
    ...(logoUrl ? { logoUrl } : {}),
  };
}
