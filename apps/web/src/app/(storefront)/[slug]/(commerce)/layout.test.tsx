import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CommerceLayout from './layout';

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
});
