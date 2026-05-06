import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredBannerCarousel } from './deferred-banner-carousel';

describe('DeferredBannerCarousel', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('loads the BannerCarousel module only after deferred activation', async () => {
    const loadBannerCarouselModule = vi.fn(() =>
      Promise.resolve({
        BannerCarousel: ({ className }: { className?: string }) => (
          <div data-testid="banner-carousel">{className}</div>
        ),
      })
    );

    render(
      <DeferredBannerCarousel
        className="h-52"
        fallback={<div>Reserved banner space</div>}
        loadBannerCarouselModule={loadBannerCarouselModule}
        timeoutMs={1800}
      />
    );

    expect(screen.getByText('Reserved banner space')).toBeInTheDocument();
    expect(loadBannerCarouselModule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1799);
    });
    expect(loadBannerCarouselModule).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadBannerCarouselModule).toHaveBeenCalledOnce();
    expect(screen.getByText('h-52')).toBeInTheDocument();
  });

  it('keeps the fallback visible and logs when the BannerCarousel import fails', async () => {
    const importError = new Error('banner chunk failed');
    const loadBannerCarouselModule = vi.fn(() => Promise.reject(importError));

    render(
      <DeferredBannerCarousel
        className="h-52"
        fallback={<div>Reserved banner space</div>}
        loadBannerCarouselModule={loadBannerCarouselModule}
        timeoutMs={1800}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(1800);
      await Promise.resolve();
    });

    expect(loadBannerCarouselModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Reserved banner space')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[DeferredBannerCarousel] Failed to load BannerCarousel module',
      importError
    );
  });

  it('does not import the BannerCarousel module after unmounting before activation', () => {
    const loadBannerCarouselModule = vi.fn(() =>
      Promise.resolve({
        BannerCarousel: ({ className }: { className?: string }) => (
          <div>{className}</div>
        ),
      })
    );

    const { unmount } = render(
      <DeferredBannerCarousel
        className="h-52"
        fallback={<div>Reserved banner space</div>}
        loadBannerCarouselModule={loadBannerCarouselModule}
        timeoutMs={1800}
      />
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(loadBannerCarouselModule).not.toHaveBeenCalled();
  });
});
