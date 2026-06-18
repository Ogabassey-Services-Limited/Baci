import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('@/lib/posthog/browser', () => ({
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

import { PostHogClientBootstrap } from './posthog-client-bootstrap';

describe('PostHogClientBootstrap', () => {
  it('initializes PostHog when the browser module loads', () => {
    render(<PostHogClientBootstrap />);

    expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      })
    );
  });
});
