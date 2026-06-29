import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartPageHeader } from './cart-page-header';

describe('CartPageHeader', () => {
  it('announces the cart page title and item count', () => {
    render(<CartPageHeader cartCount={3} />);

    expect(
      screen.getByRole('heading', { name: /cart\s+\(3\)/i })
    ).toBeInTheDocument();
  });
});
