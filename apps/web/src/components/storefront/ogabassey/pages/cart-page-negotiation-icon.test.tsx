import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartPageNegotiationIcon } from './cart-page-negotiation-icon';

describe('CartPageNegotiationIcon', () => {
  it('renders the app negotiation glyph at the requested size', () => {
    const { container } = render(
      <CartPageNegotiationIcon className="text-store-primary" size={18} />
    );

    const icon = container.querySelector('svg');

    expect(icon).toHaveAttribute('viewBox', '0 0 512 512');
    expect(icon).toHaveAttribute('height', '18');
    expect(icon).toHaveClass('text-store-primary');
  });
});
