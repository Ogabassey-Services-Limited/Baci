import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';

const mocks = vi.hoisted(() => ({
  hasPostHogBrowserInitialized: vi.fn(() => false),
  initializePostHogBrowser: vi.fn(),
  initializePostHogInstrumentationIfAllowed: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/instrumentation-client', () => ({
  initializePostHogInstrumentationIfAllowed:
    mocks.initializePostHogInstrumentationIfAllowed,
}));

vi.mock('@/lib/posthog/browser-state', () => ({
  hasPostHogBrowserInitialized: mocks.hasPostHogBrowserInitialized,
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
  mocks.hasPostHogBrowserInitialized.mockReset();
  mocks.hasPostHogBrowserInitialized.mockReturnValue(false);
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('PostHogClientBootstrap', () => {
  it('initializes PostHog after mount on non-blog pages', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);

    // The boot is deferred off the render/critical path, so it is not called
    // synchronously during mount.
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });

    expect(
      mocks.initializePostHogInstrumentationIfAllowed
    ).toHaveBeenCalledWith('/');
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      }),
      console,
      {
        lightweight: false,
        pathname: '/',
        hostname: undefined,
      }
    );
  });

  it('does not initialize the full PostHog browser client on initial public blog pages', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/blog/phone-guide',
      hostname: 'usebaci.com',
    });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(
      mocks.initializePostHogInstrumentationIfAllowed
    ).not.toHaveBeenCalled();
  });

  it('reconfigures an already initialized PostHog browser client on public blog pages', async () => {
    mocks.hasPostHogBrowserInitialized.mockReturnValue(true);
    pathname = '/ogabassey/blog/phone-guide';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/blog/phone-guide',
      hostname: 'usebaci.com',
    });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);

    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      }),
      console,
      {
        lightweight: true,
        pathname: '/ogabassey/blog/phone-guide',
        hostname: 'usebaci.com',
      }
    );
    expect(
      mocks.initializePostHogInstrumentationIfAllowed
    ).not.toHaveBeenCalled();
  });

  it('initializes PostHog after a client navigation from blog to a non-blog page', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/blog/phone-guide',
      hostname: 'usebaci.com',
    });
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    const { rerender } = render(<PostHogClientBootstrap />);

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(
      mocks.initializePostHogInstrumentationIfAllowed
    ).not.toHaveBeenCalled();

    pathname = '/ogabassey/laptops/macbook-pro';
    vi.stubGlobal('location', {
      pathname,
      href: 'https://usebaci.com/ogabassey/laptops/macbook-pro',
      hostname: 'usebaci.com',
    });
    rerender(<PostHogClientBootstrap />);

    await vi.waitFor(() => {
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
        hostname: 'usebaci.com',
      }
    );
    expect(
      mocks.initializePostHogInstrumentationIfAllowed
    ).toHaveBeenCalledWith('/ogabassey/laptops/macbook-pro');
  });
});
