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

  it('renders the skeleton with overridden accessibility props', () => {
    render(
      <DeferredDetailsSkeleton
        aria-busy={false}
        aria-label="loading product details - fallback"
      />
    );

    const container = screen.getByRole('status', {
      name: /loading product details - fallback/i,
    });
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'false');
  });

  it('verifies the component\'s passive fallback semantics', () => {
    const { container } = render(
      <DeferredDetailsSkeleton
        role=""
        aria-live="off"
        aria-label=""
      />
    );

    // Assert the container does not expose an announcing role
    const statusElement = screen.queryByRole('status');
    expect(statusElement).toBeNull();

    // Verify element has aria-live="off" and empty/absent accessible name
    const divElement = container.firstChild;
    expect(divElement).toHaveAttribute('aria-live', 'off');
    expect(divElement).not.toHaveAttribute('role');
    expect(divElement).not.toHaveAttribute('aria-label');
  });
});
