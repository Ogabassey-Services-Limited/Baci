import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';

const mocks = vi.hoisted(() => ({
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/lib/posthog/browser', () => ({
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

function importPostHogClientBootstrap() {
  return import('./posthog-client-bootstrap');
}

afterEach(() => {
  pathname = '/';
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('PostHogClientBootstrap', () => {
  it('initializes PostHog after mount on non-blog pages', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);
    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });

    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      })
    );
  });

  it('skips PostHog on public blog pages', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/blog/phone-guide',
    });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
  });

  it('initializes PostHog after a client navigation from blog to a non-blog page', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/blog/phone-guide',
    });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    const { rerender } = render(<PostHogClientBootstrap />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();

    pathname = '/ogabassey/laptops/macbook-pro';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/laptops/macbook-pro',
    });
    rerender(<PostHogClientBootstrap />);

    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });
  });
});
