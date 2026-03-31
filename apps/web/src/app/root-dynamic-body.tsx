import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';
import { Toaster } from '@/components/ui/toaster';
import { NonceProvider } from '@/contexts/NonceProvider';
import { Providers } from '@/contexts/providers';

// Keep this list in sync with top-level route directories under src/app.
export const NON_STOREFRONT_TOP_LEVEL_SEGMENTS = new Set([
  '.well-known',
  'about',
  'actions',
  'admin',
  'api',
  'auth',
  'blog',
  'builder',
  'cart',
  'checkout',
  'contact',
  'dashboard',
  'debug-auth',
  'demo',
  'developers',
  'features',
  'features.md',
  'index.html.md',
  'invite',
  'llms-full.txt',
  'llms.txt',
  'login',
  'onboarding',
  'onboarding.md',
  'pricing',
  'pricing.md',
  'privacy',
  'reset-password',
  'staff',
  'template-preview',
  'terms',
  'track',
]);

const PATHNAME_HEADER_CANDIDATES = [
  'x-pathname',
  'x-invoke-path',
  'x-matched-path',
  'next-url',
  'x-next-url',
] as const;

interface HeaderReader {
  get(name: string): string | null;
}

function getFirstPathSegment(pathname: string | null): string | null {
  if (!pathname) return null;

  const [pathWithoutQuery] = pathname.split('?');
  const normalized = pathWithoutQuery.trim();
  if (!normalized.startsWith('/')) return null;

  const [firstSegment] = normalized.split('/').filter(Boolean);
  if (!firstSegment) return null;
  if (firstSegment.startsWith('_') || firstSegment.includes('.')) return null;

  return firstSegment.toLowerCase();
}

export function isStorefrontRequest(headersList: HeaderReader): boolean {
  if (
    headersList.get('x-merchant-slug') ||
    headersList.get('x-custom-domain')
  ) {
    return true;
  }

  const pathname = PATHNAME_HEADER_CANDIDATES.map((headerName) =>
    headersList.get(headerName)
  ).find(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  const firstSegment = getFirstPathSegment(pathname ?? null);
  if (!firstSegment) return false;

  return !NON_STOREFRONT_TOP_LEVEL_SEGMENTS.has(firstSegment);
}

export function RootDynamicBody({
  children,
  forcedTheme,
  nonce,
}: {
  children: ReactNode;
  forcedTheme?: string;
  nonce?: string;
}) {
  return (
    <>
      <NonceProvider nonce={nonce}>
        <Providers forcedTheme={forcedTheme}>
          {children}
          <Toaster />
        </Providers>
      </NonceProvider>
      <WebVitalsReporter />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
