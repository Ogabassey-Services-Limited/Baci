import { headers } from 'next/headers';
import { Fragment, type ReactElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';

const mockConnection = vi.hoisted(() => vi.fn());

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('../pages/terms/terms-page-client', () => ({
  TermsPageClient: vi.fn(() => null),
}));

const { default: TermsPage, generateMetadata } = await import('./page');

beforeEach(() => {
  mockConnection.mockReset();
});

describe('terms metadata', () => {
  it('returns fallback title when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(metadata.title).toBe('Terms of Service');
  });

  it('prefers the request-scoped custom domain for canonical metadata', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      custom_domain: 'ogabassey.com',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.alternates?.canonical).toBe('https://ogabassey.com/terms');
    expect(metadata.openGraph?.url).toBe('https://ogabassey.com/terms');
  });
});

describe('terms page rendering', () => {
  it('renders the content boundary and request-time metadata marker', async () => {
    mockConnection.mockResolvedValueOnce(undefined);

    const element = TermsPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    }) as ReactElement<{ children: ReactElement[] }>;
    const [contentBoundary, markerBoundary] = element.props.children;

    expect(element.type).toBe(Fragment);
    expect(contentBoundary?.type).toBe(Suspense);
    const markerSuspense = (markerBoundary.type as () => ReactElement)();
    expect(markerSuspense.type).toBe(Suspense);
    const markerConnection = (
      markerSuspense.props as {
        children?: ReactElement;
      }
    ).children?.type as () => Promise<null>;

    await expect(markerConnection()).resolves.toBeNull();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces metadata marker connection failures to the route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('Connection failed'));

    const element = TermsPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    }) as ReactElement<{ children: ReactElement[] }>;
    const markerBoundary = element.props.children[1];
    const markerSuspense = (markerBoundary.type as () => ReactElement)();
    const markerConnection = (
      markerSuspense.props as {
        children?: ReactElement;
      }
    ).children?.type as () => Promise<null>;

    await expect(markerConnection()).rejects.toThrow('Connection failed');
    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
