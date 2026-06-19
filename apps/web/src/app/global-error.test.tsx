import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

const mockCaptureClientException = vi.fn();

vi.mock('@/lib/posthog/client-exceptions', () => ({
  captureClientException: (...args: unknown[]) =>
    mockCaptureClientException(...args),
}));

describe('GlobalError', () => {
  beforeEach(() => {
    mockCaptureClientException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('reports the global exception for observability', () => {
    const error = Object.assign(new Error('tracked'), { digest: 'xyz789' });

    render(<GlobalError error={error} />);

    expect(mockCaptureClientException).toHaveBeenCalledWith(error, {
      route_surface: 'global',
      digest: 'xyz789',
    });
  });
});
