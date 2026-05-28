import { headers } from 'next/headers';
import { type ReactElement, Suspense } from 'react';
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
  it('renders the content boundary and opts its content into request-time rendering', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      custom_domain: 'ogabassey.com',
      pages: { terms: 'Terms copy' },
      template_id: 'default',
      updated_at: '2026-01-01T00:00:00.000Z',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const element = TermsPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    }) as ReactElement<{ children: ReactElement }>;
    const content = element.props.children;

    expect(element.type).toBe(Suspense);
    await expect(
      (content.type as (props: unknown) => Promise<unknown>)(content.props)
    ).resolves.toBeTruthy();

    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces request-time connection failures to the route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('Connection failed'));

    const element = TermsPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    }) as ReactElement<{ children: ReactElement }>;
    const content = element.props.children;

    await expect(
      (content.type as (props: unknown) => Promise<unknown>)(content.props)
    ).rejects.toThrow('Connection failed');
    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
