import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(async () => null),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('@/types/about-page', () => ({
  generateAboutPageJsonLd: vi.fn(() => ({})),
}));

vi.mock('../pages/about/about-page-client', () => ({
  AboutPageClient: () => <div data-testid="about-client">About UI</div>,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const { default: AboutPage } = await import('./page');

describe('AboutPage', () => {
  const params = Promise.resolve({ slug: 'test-store' });

  it('renders H1 in the initial synchronous output', () => {
    render(<AboutPage params={params} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('About Us');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders Suspense fallback while content loads', () => {
    render(<AboutPage params={params} />);

    expect(screen.getByText('Loading about page...')).toBeInTheDocument();
  });
});
