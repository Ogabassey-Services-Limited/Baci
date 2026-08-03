import { parseBrandColors } from '@/schemas/brand-colors';
import type {
  CuratedStorefrontInput,
  GenerateInitialTemplateParams,
} from './curated-storefront-types';

const ROOT_RELATIVE_LOGO_BASE = 'https://curated-storefront.invalid';

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function normalizeLogoUrl(value: string): string | undefined {
  if (hasControlCharacter(value)) return undefined;

  try {
    if (value.startsWith('/') && !value.startsWith('//')) {
      const url = new URL(value, ROOT_RELATIVE_LOGO_BASE);
      if (url.origin !== ROOT_RELATIVE_LOGO_BASE) return undefined;

      const decoded = decodeURIComponent(
        `${url.pathname}${url.search}${url.hash}`
      );
      if (hasControlCharacter(decoded)) return undefined;

      return `${url.pathname}${url.search}${url.hash}`;
    }

    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      url.hostname &&
      !url.username &&
      !url.password
    ) {
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function toCuratedStorefrontInput(
  params: GenerateInitialTemplateParams
): CuratedStorefrontInput {
  const merchant = params.merchant ?? {};
  const logoUrl =
    typeof merchant.logo_url === 'string'
      ? normalizeLogoUrl(merchant.logo_url)
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
