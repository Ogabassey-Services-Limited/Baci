import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewCard } from './review-card';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const baseReview = {
  id: 'review-1',
  rating: 5,
  title: 'Great product',
  body: 'Works well.',
  verified_purchase: true,
  helpful_count: 0,
  created_at: '2026-05-28T00:00:00.000Z',
};

describe('ReviewCard', () => {
  it('prefers customer name when rendering the reviewer identity', () => {
    render(
      <ReviewCard
        review={{
          ...baseReview,
          customer_name: 'Jane Buyer',
        }}
      />
    );

    expect(screen.getByText('Jane Buyer')).toBeInTheDocument();
  });

  it('falls back to the email username when customer name is absent', () => {
    render(
      <ReviewCard
        review={{
          ...baseReview,
          customer_email: 'john.doe@example.com',
        }}
      />
    );

    expect(screen.getByText('john.doe')).toBeInTheDocument();
  });

  it('does not show the email username when customer name is available', () => {
    render(
      <ReviewCard
        review={{
          ...baseReview,
          customer_name: 'Jane Buyer',
          customer_email: 'john.doe@example.com',
        }}
      />
    );

    expect(screen.getByText('Jane Buyer')).toBeInTheDocument();
    expect(screen.queryByText('john.doe')).not.toBeInTheDocument();
  });

  it('does not require public review payloads to include customer email', () => {
    render(
      <ReviewCard
        review={{
          ...baseReview,
          customer_email: null,
        }}
      />
    );

    expect(screen.getByText('Verified customer')).toBeInTheDocument();
  });

  it('renders review titles at the product-section heading level', () => {
    render(<ReviewCard review={baseReview} />);

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Great product',
      })
    ).toBeInTheDocument();
  });
});
