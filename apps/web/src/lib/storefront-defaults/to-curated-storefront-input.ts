import { parseBrandColors } from '@/schemas/brand-colors';
import type {
  CuratedStorefrontInput,
  GenerateInitialTemplateParams,
} from './curated-storefront-types';

export function toCuratedStorefrontInput(
  params: GenerateInitialTemplateParams
): CuratedStorefrontInput {
  const merchant = params.merchant ?? {};
  let logoUrl: string | undefined;
  if (typeof merchant.logo_url === 'string') {
    try {
      const url = new URL(merchant.logo_url);
      if (
        url.protocol === 'https:' &&
        url.hostname &&
        !url.username &&
        !url.password
      )
        logoUrl = url.toString();
    } catch {
      logoUrl = undefined;
    }
  }
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
