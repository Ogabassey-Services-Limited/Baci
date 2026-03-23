import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(async () => null),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateFAQSchema: vi.fn(() => ({})),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('@/types/faq', () => ({
  parseLegacyFAQ: vi.fn(() => []),
}));

vi.mock('../pages/faq/faq-page-client', () => ({
  FAQPageClient: () => <div data-testid="faq-client">FAQ UI</div>,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const { default: FAQPage } = await import('./page');

describe('FAQPage', () => {
  const params = Promise.resolve({ slug: 'test-store' });

  it('renders H1 in the initial synchronous output', () => {
    render(<FAQPage params={params} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Frequently Asked Questions');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders Suspense fallback while content loads', () => {
    render(<FAQPage params={params} />);

    expect(screen.getByText('Loading FAQ...')).toBeInTheDocument();
  });
});
