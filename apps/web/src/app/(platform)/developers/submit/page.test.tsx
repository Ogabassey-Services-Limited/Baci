import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitTemplatePage, { metadata } from './page';

vi.mock('./client-page', () => ({
  default: () => <main>Submit template client</main>,
}));

describe('SubmitTemplatePage metadata wrapper', () => {
  it('declares public developer submission metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Submit a Storefront Template - Baci Developers',
      description:
        'Submit a storefront template for review and help African merchants launch better Baci commerce experiences.',
    });
  });

  it('keeps public SEO metadata indexable with a canonical URL', () => {
    expect(metadata).not.toHaveProperty('robots');
    expect(metadata.alternates).toMatchObject({
      canonical: expect.stringContaining('/developers/submit'),
    });
  });

  it('renders the client page boundary', () => {
    render(<SubmitTemplatePage />);

    expect(screen.getByRole('main')).toHaveTextContent(
      'Submit template client'
    );
  });

  it('emits parsable WebPage JSON-LD for the public submit page', () => {
    render(<SubmitTemplatePage />);

    const script = document.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script?.textContent ?? '{}');

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Submit a Storefront Template - Baci Developers',
      url: expect.stringContaining('/developers/submit'),
    });
  });
});
