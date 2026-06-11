import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewForm } from './review-form';

const toastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe('ReviewForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastMock.mockClear();
    window.localStorage.clear();
  });

  it('keeps a live region mounted and marks the action busy while submitting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => undefined))
    );

    render(<ReviewForm productId="product-1" productName="Test Product" />);

    const submitButton = screen.getByRole('button', {
      name: 'Submit Review',
    });
    expect(submitButton).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 out of 5' }));
    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

    await waitFor(() => {
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(
        'Submitting review.'
      );
    });
  });
});
