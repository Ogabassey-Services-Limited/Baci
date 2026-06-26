import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CommerceLayout, { metadata } from './layout';

describe('CommerceLayout', () => {
  it('leaves anonymous commerce routes outside CustomerAuthLayout', () => {
    render(
      <CommerceLayout>
        <div>Commerce content</div>
      </CommerceLayout>
    );

    expect(screen.getByText('Commerce content')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-auth-layout')).toBeNull();
  });

  it('returns children without adding a page-owned loading fallback', () => {
    const node = CommerceLayout({
      children: <div>Commerce content</div>,
    });

    render(node);

    expect(screen.getByText('Commerce content')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it('marks commerce routes noindex so cart, checkout, wallet, and wishlist stay out of SEO crawls', () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
    });
  });
});
