import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeferredDetailsSkeleton } from './deferred-details-skeleton';

describe('DeferredDetailsSkeleton', () => {
  it('renders the skeleton with proper accessibility attributes', () => {
    render(<DeferredDetailsSkeleton />);

    const container = screen.getByTestId(
      'deferred-product-details-placeholder'
    );
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'true');
    expect(container).toHaveAttribute(
      'aria-label',
      'Loading product details...'
    );
  });
});
