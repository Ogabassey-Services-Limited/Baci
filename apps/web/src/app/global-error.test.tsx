import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

const mockUseBoundaryErrorReport = vi.fn();

vi.mock('@/hooks/use-boundary-error-report', () => ({
  useBoundaryErrorReport: (...args: unknown[]) =>
    mockUseBoundaryErrorReport(...args),
}));

describe('GlobalError', () => {
  beforeEach(() => {
    mockUseBoundaryErrorReport.mockReset();
    mockUseBoundaryErrorReport.mockReturnValue(false);
  });

  it('renders a critical error document with a self-contained stylesheet', () => {
    const { container } = render(<GlobalError error={new Error('critical')} />);

    expect(
      screen.getByRole('heading', { name: /critical error/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('baci-system-error-page');
    expect(container.querySelector('style')?.textContent).toContain(
      '@media (prefers-color-scheme: dark)'
    );
    expect(
      screen.getByRole('button', { name: /refresh application/i })
    ).toBeEnabled();
  });

  it('hands the caught error to the shared boundary error pipeline', () => {
    const error = Object.assign(new Error('tracked'), { digest: 'xyz789' });

    render(<GlobalError error={error} />);

    expect(mockUseBoundaryErrorReport).toHaveBeenCalledWith(error, {
      routeSurface: 'global',
      logLabel: 'Global application error',
    });
  });

  it('renders the chunk-recovery notice document instead of the error card while a reload is pending', () => {
    mockUseBoundaryErrorReport.mockReturnValue(true);

    render(<GlobalError error={new Error('chunk boom')} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /updating to the latest version/i
    );
    expect(
      screen.queryByRole('heading', { name: /critical error/i })
    ).not.toBeInTheDocument();
  });
});
