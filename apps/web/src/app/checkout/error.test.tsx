import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutError from './error';

const mockUseBoundaryErrorReport = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/hooks/use-boundary-error-report', () => ({
  useBoundaryErrorReport: (...args: unknown[]) =>
    mockUseBoundaryErrorReport(...args),
}));

describe('CheckoutError', () => {
  beforeEach(() => {
    mockUseBoundaryErrorReport.mockReset();
    mockUseBoundaryErrorReport.mockReturnValue(false);
  });

  it('renders the checkout error card and reports the error when no recovery is pending', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('checkout boom'), {
      digest: 'digest-1',
    });

    render(<CheckoutError error={error} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /checkout error/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
    expect(
      screen.getByRole('link', { name: /return to store/i })
    ).toHaveAttribute('href', '/');
    expect(mockUseBoundaryErrorReport).toHaveBeenCalledWith(error, {
      routeSurface: 'checkout',
      logLabel: 'Checkout error',
    });
  });

  it('renders the chunk-recovery notice instead of the error card while a reload is pending', () => {
    mockUseBoundaryErrorReport.mockReturnValue(true);

    render(<CheckoutError error={new Error('chunk boom')} reset={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /updating to the latest version/i
    );
    expect(
      screen.queryByRole('heading', { name: /checkout error/i })
    ).not.toBeInTheDocument();
  });
});
