import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppError from './error';

const mockCaptureClientException = vi.fn();

vi.mock('@/lib/posthog/client-exceptions', () => ({
  captureClientException: (...args: unknown[]) =>
    mockCaptureClientException(...args),
}));

describe('AppError', () => {
  beforeEach(() => {
    mockCaptureClientException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a recoverable application error with inline shell styles', () => {
    const reset = vi.fn();

    render(<AppError error={new Error('boom')} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({
      position: 'fixed',
      minHeight: '100vh',
    });
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });

  it('reports the client exception for observability', () => {
    const error = Object.assign(new Error('tracked'), { digest: 'abc123' });

    render(<AppError error={error} reset={vi.fn()} />);

    expect(mockCaptureClientException).toHaveBeenCalledWith(error, {
      route_surface: 'app',
      digest: 'abc123',
    });
  });
});
