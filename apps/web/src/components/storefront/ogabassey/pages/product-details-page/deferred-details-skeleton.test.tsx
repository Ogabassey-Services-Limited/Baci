import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeferredDetailsSkeleton } from './deferred-details-skeleton';

describe('DeferredDetailsSkeleton', () => {
  it('renders the skeleton with proper accessibility attributes', () => {
    render(<DeferredDetailsSkeleton />);

    const container = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'true');
  });
});
