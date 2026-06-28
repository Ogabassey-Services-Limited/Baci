import { headers } from 'next/headers';
import {
  DEFAULT_STOREFRONT_APPEARANCE,
  resolveKnownStorefrontAppearance,
} from '@/components/storefront/storefront-appearance';
import { StorefrontThemeProvider } from '@/components/storefront/storefront-theme-provider';
import { StorefrontNotFoundContent } from './storefront-not-found-content';

function normalizeHostHeader(rawHost: string | null): string {
  return (
    rawHost?.split(',')[0]?.trim().replace(/:\d+$/, '').toLowerCase() ?? ''
  );
}

function getPathStorefrontIdentifier(pathname: string | null): string {
  return pathname?.split('/').filter(Boolean)[0] ?? '';
}

function resolveStorefrontNotFoundAppearance(headersList: Headers) {
  const candidates = [
    headersList.get('x-merchant-slug'),
    normalizeHostHeader(headersList.get('x-custom-domain')),
    getPathStorefrontIdentifier(headersList.get('x-pathname')),
    normalizeHostHeader(headersList.get('x-forwarded-host')),
    normalizeHostHeader(headersList.get('host')),
  ];

  for (const candidate of candidates) {
    const appearance = resolveKnownStorefrontAppearance(candidate);
    if (appearance) {
      return appearance;
    }
  }

  return { ...DEFAULT_STOREFRONT_APPEARANCE };
}

export default async function StorefrontNotFound() {
  const headersList = await headers();
  const appearance = resolveStorefrontNotFoundAppearance(headersList);

  return (
    <StorefrontThemeProvider appearance={appearance}>
      <StorefrontNotFoundContent />
    </StorefrontThemeProvider>
  );
}
