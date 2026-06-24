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
});
