import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptsStateCard } from '@/app/(storefront)/[slug]/(customer)/receipts/receipts-state-card';

describe('ReceiptsStateCard', () => {
  it('renders the alert copy and fires its action button', () => {
    const onAction = vi.fn();

    render(
      <ReceiptsStateCard
        title="Unable to load documents"
        message="Please try again."
        actionLabel="Retry"
        onAction={onAction}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /unable to load documents/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onAction).toHaveBeenCalledOnce();
  });
});
