import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardError from './error';

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

describe('DashboardError', () => {
  beforeEach(() => {
    mockUseBoundaryErrorReport.mockReset();
    mockUseBoundaryErrorReport.mockReturnValue(false);
  });

  it('renders the dashboard error card and reports the error when no recovery is pending', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('dashboard boom'), {
      digest: 'digest-1',
    });

    render(<DashboardError error={error} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
    expect(
      screen.getByRole('link', { name: /dashboard home/i })
    ).toHaveAttribute('href', '/dashboard');
    expect(mockUseBoundaryErrorReport).toHaveBeenCalledWith(error, {
      routeSurface: 'dashboard',
      logLabel: 'Dashboard error',
    });
  });

  it('renders the chunk-recovery notice instead of the error card while a reload is pending', () => {
    mockUseBoundaryErrorReport.mockReturnValue(true);

    render(<DashboardError error={new Error('chunk boom')} reset={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /updating to the latest version/i
    );
    expect(
      screen.queryByRole('heading', { name: /something went wrong/i })
    ).not.toBeInTheDocument();
  });
});
