import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capturePostHogPageview: vi.fn(),
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogPageview: mocks.capturePostHogPageview,
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

function importPostHogClientBootstrap() {
  return import('./posthog-client-bootstrap');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('PostHogClientBootstrap', () => {
  it('initializes PostHog when the browser module loads', async () => {
    const { PostHogClientBootstrap } = await importPostHogClientBootstrap();

    render(<PostHogClientBootstrap />);

    expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      })
    );
    expect(mocks.capturePostHogPageview).toHaveBeenCalledOnce();
  });
});
