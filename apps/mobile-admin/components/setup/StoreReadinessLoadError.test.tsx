import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#111827',
      error: '#ef4444',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
    },
  }),
}));

import { StoreReadinessLoadError } from './StoreReadinessLoadError';

describe('StoreReadinessLoadError', () => {
  it('retries from an accessible control', () => {
    const onRetry = vi.fn();
    render(<StoreReadinessLoadError isRetrying={false} onRetry={onRetry} />);

    expect(
      screen.getByText('Unable to load store setup right now.')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading store setup' })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the retry button labelled and disabled while retrying', () => {
    render(<StoreReadinessLoadError isRetrying onRetry={vi.fn()} />);

    const retry = screen.getByRole('button', {
      name: 'Retry loading store setup',
    });
    expect(retry).toBeDisabled();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
