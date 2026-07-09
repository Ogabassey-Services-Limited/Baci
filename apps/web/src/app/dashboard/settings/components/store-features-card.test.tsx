import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    render(<StoreFeaturesCard initialBlogEnabled={false} />);

    fireEvent.click(screen.getByRole('switch', { name: /blogging system/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        blog_enabled: true,
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
    render(<StoreFeaturesCard initialBlogEnabled={false} />);

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
});
