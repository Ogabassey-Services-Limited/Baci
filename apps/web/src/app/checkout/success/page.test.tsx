import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SuccessPage, { metadata } from './page';

vi.mock('./client-page', () => ({
  default: () => <main>Checkout success client</main>,
}));

describe('checkout success metadata wrapper', () => {
  it('declares noindex checkout confirmation metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Order Confirmed - Baci Checkout',
      description:
        'Confirmation details for a completed Baci checkout session.',
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('renders the client page boundary', () => {
    render(<SuccessPage />);

    expect(screen.getByRole('main')).toHaveTextContent(
      'Checkout success client'
    );
  });
});
