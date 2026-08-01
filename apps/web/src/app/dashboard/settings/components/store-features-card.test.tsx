import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreFeaturesCard } from './store-features-card';

const mockApiPatch = vi.fn();
const mockToast = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

describe('StoreFeaturesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPatch.mockResolvedValue({ blog_enabled: true });
  });

  it('persists the blog toggle through the cache-invalidating server route', async () => {
    render(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-1" />
    );

    fireEvent.click(screen.getByRole('switch', { name: /blogging system/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        blog_enabled: true,
        merchantId: 'merchant-1',
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Blog Enabled' })
    );
    expect(
      screen.getByRole('switch', { name: /blogging system/i })
    ).toBeChecked();
  });

  it('rolls back the switch and reports a destructive toast on failure', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('update failed'));
    render(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-1" />
    );

    fireEvent.click(screen.getByRole('switch', { name: /blogging system/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: /blogging system/i })
      ).not.toBeChecked();
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to update blog setting' })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Update Failed',
        variant: 'destructive',
      })
    );
  });

  it('resets to merchant B and ignores merchant A completion after a switch', async () => {
    let resolveRequest:
      | ((value: { blog_enabled: boolean }) => void)
      | undefined;
    mockApiPatch.mockReturnValue(
      new Promise<{ blog_enabled: boolean }>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { rerender } = render(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-a" />
    );
    const toggle = screen.getByRole('switch', { name: /blogging system/i });
    fireEvent.click(toggle);

    rerender(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-b" />
    );

    expect(toggle).not.toBeChecked();
    expect(toggle).not.toBeDisabled();

    if (!resolveRequest)
      throw new Error('Expected the toggle request to start');
    resolveRequest({ blog_enabled: true });

    await waitFor(() => {
      expect(toggle).not.toBeChecked();
    });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('ignores merchant A completion after switching A to B and back to A', async () => {
    let resolveRequest:
      | ((value: { blog_enabled: boolean }) => void)
      | undefined;
    mockApiPatch.mockReturnValue(
      new Promise<{ blog_enabled: boolean }>((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { rerender } = render(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-a" />
    );

    fireEvent.click(screen.getByRole('switch', { name: /blogging system/i }));
    rerender(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-b" />
    );
    rerender(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-a" />
    );

    resolveRequest?.({ blog_enabled: true });

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: /blogging system/i })
      ).not.toBeChecked();
    });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('ignores a completion after the card unmounts', async () => {
    let resolveRequest:
      | ((value: { blog_enabled: boolean }) => void)
      | undefined;
    mockApiPatch.mockReturnValue(
      new Promise<{ blog_enabled: boolean }>((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { unmount } = render(
      <StoreFeaturesCard initialBlogEnabled={false} merchantId="merchant-a" />
    );

    fireEvent.click(screen.getByRole('switch', { name: /blogging system/i }));
    unmount();
    await act(async () => {
      resolveRequest?.({ blog_enabled: true });
      await Promise.resolve();
    });

    expect(mockToast).not.toHaveBeenCalled();
  });
});
