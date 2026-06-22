import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogPageviewTracker } from './posthog-pageview-tracker';

let pathname = '/';

const mocks = vi.hoisted(() => ({
  capturePostHogPageview: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogPageview: mocks.capturePostHogPageview,
}));

async function flushPostHogEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PostHogPageviewTracker', () => {
  beforeEach(() => {
    pathname = '/';
    mocks.capturePostHogPageview.mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('captures a pageview after mount', async () => {
    render(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledWith(
        'http://localhost:3000/'
      );
    });
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

  it('skips public blog pageviews to keep blog pages light', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    window.history.replaceState(null, '', pathname);

    render(<PostHogPageviewTracker />);
    await flushPostHogEffects();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });

  it('captures after a client navigation from blog to a non-blog page', async () => {
    pathname = '/ogabassey/blog/phone-guide';
    window.history.replaceState(null, '', pathname);
    const { rerender } = render(<PostHogPageviewTracker />);

    await flushPostHogEffects();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();

    pathname = '/ogabassey/laptops/macbook-pro';
    window.history.pushState(null, '', pathname);
    rerender(<PostHogPageviewTracker />);

    await waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledWith(
        'http://localhost:3000/ogabassey/laptops/macbook-pro'
      );
    });
  });
});
