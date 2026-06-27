import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogPageviewTracker } from './posthog-pageview-tracker';

let pathname = '/';
let searchParams = new URLSearchParams();

const mocks = vi.hoisted(() => ({
  capturePostHogPageview: vi.fn(),
  capturePublicBlogPageview: vi.fn(),
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogPageview: mocks.capturePostHogPageview,
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

vi.mock('@/lib/posthog/public-blog-pageview', () => ({
  capturePublicBlogPageview: mocks.capturePublicBlogPageview,
}));

describe('PostHogPageviewTracker', () => {
  beforeEach(() => {
    pathname = '/';
    searchParams = new URLSearchParams();
    mocks.capturePostHogPageview.mockClear();
    mocks.capturePublicBlogPageview.mockClear();
    mocks.initializePostHogBrowser.mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('captures a pageview after mount', async () => {
    render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledWith(
        'http://localhost:3000/'
      );
    });
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      }),
      console,
      {
        lightweight: false,
        pathname: '/',
        hostname: 'localhost',
      }
    );
  });

  it('captures a pageview when the pathname changes', async () => {
    const { rerender } = render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledTimes(1);
    });

    pathname = '/pricing';
    window.history.pushState(null, '', '/pricing?plan=starter');
    rerender(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledWith(
        'http://localhost:3000/pricing?plan=starter'
      );
    });
  });

  it('captures public blog pageviews with the lightweight beacon only', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    window.history.replaceState(null, '', pathname);

    render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePublicBlogPageview).toHaveBeenCalledWith(
        expect.objectContaining({
          NODE_ENV: expect.any(String),
        }),
        'http://localhost:3000/ogabassey/blog/phone-guide'
      );
    });
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });

  it('captures after a client navigation from blog to a non-blog page', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    window.history.replaceState(null, '', pathname);
    const { rerender } = render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePublicBlogPageview).toHaveBeenCalledWith(
        expect.objectContaining({
          NODE_ENV: expect.any(String),
        }),
        'http://localhost:3000/ogabassey/blog/phone-guide'
      );
    });
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();

    pathname = '/ogabassey/laptops/macbook-pro';
    window.history.pushState(null, '', pathname);
    rerender(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledWith(
        'http://localhost:3000/ogabassey/laptops/macbook-pro'
      );
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });
    expect(mocks.initializePostHogBrowser).toHaveBeenLastCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      }),
      console,
      {
        lightweight: false,
        pathname: '/ogabassey/laptops/macbook-pro',
        hostname: 'localhost',
      }
    );
  });

  it('captures a pageview when only public blog search params change', async () => {
    pathname = '/ogabassey/blog';
    searchParams = new URLSearchParams('page=1');
    window.history.replaceState(null, '', `${pathname}?${searchParams}`);
    const { rerender } = render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePublicBlogPageview).toHaveBeenCalledWith(
        expect.objectContaining({
          NODE_ENV: expect.any(String),
        }),
        'http://localhost:3000/ogabassey/blog?page=1'
      );
    });

    searchParams = new URLSearchParams('page=2');
    window.history.pushState(null, '', `${pathname}?${searchParams}`);
    rerender(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePublicBlogPageview).toHaveBeenCalledWith(
        expect.objectContaining({
          NODE_ENV: expect.any(String),
        }),
        'http://localhost:3000/ogabassey/blog?page=2'
      );
    });
    expect(mocks.capturePublicBlogPageview).toHaveBeenCalledTimes(2);
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });
});
