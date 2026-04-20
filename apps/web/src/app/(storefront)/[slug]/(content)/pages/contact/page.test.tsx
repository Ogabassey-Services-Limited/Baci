import { describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/social', () => ({
  normalizeSocialUrl: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('./contact-page-client', () => ({
  ContactPageClient: vi.fn(() => null),
}));

const { generateMetadata } = await import('./page');

describe('pages/contact metadata', () => {
  it('returns fallback title when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(metadata.title).toBe('Contact Us');
  });

  it('returns merchant-specific title when merchant has a reachable channel', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      email: 'support@teststore.com',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.title).toBe('Contact Us | Test Store');
    expect(metadata.alternates?.canonical).toBe('/contact');
  });

  it('throws notFound when no contact channel is populated', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      pages: {},
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'test-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  // Intentionally does NOT treat a trust-profile WhatsApp-only merchant as a
  // reachable channel today: `ContactPageClient` does not yet render the
  // trust-profile WhatsApp CTA, so gating the page open would produce an
  // empty-looking page. When the client starts rendering that CTA, flip this
  // test to assert the merchant-specific title.
  it('throws notFound for trust-profile WhatsApp-only merchants (until UI renders CTA)', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      pages: {},
      trust_profile: {
        customer_service: { whatsapp_number: '+2348012345678' },
      },
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'test-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
