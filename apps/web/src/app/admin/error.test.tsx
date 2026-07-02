import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminError from './error';

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

describe('AdminError', () => {
  beforeEach(() => {
    mockUseBoundaryErrorReport.mockReset();
    mockUseBoundaryErrorReport.mockReturnValue(false);
  });

  it('renders the admin error card and reports the error when no recovery is pending', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('admin boom'), {
      digest: 'digest-1',
    });

    render(<AdminError error={error} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /admin panel error/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /admin home/i })).toHaveAttribute(
      'href',
      '/admin'
    );
    expect(mockUseBoundaryErrorReport).toHaveBeenCalledWith(error, {
      routeSurface: 'admin',
      logLabel: 'Admin error',
    });
  });

  it('renders the chunk-recovery notice instead of the error card while a reload is pending', () => {
    mockUseBoundaryErrorReport.mockReturnValue(true);

    render(<AdminError error={new Error('chunk boom')} reset={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /updating to the latest version/i
    );
    expect(
      screen.queryByRole('heading', { name: /admin panel error/i })
    ).not.toBeInTheDocument();
  });
});
