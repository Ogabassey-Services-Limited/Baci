import { describe, expect, it, vi } from 'vitest';
import { loadPostHogBrowserSdk } from './posthog-sdk-loader';

const posthog = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('posthog-js', () => ({ default: posthog }));

describe('loadPostHogBrowserSdk', () => {
  it('loads the browser SDK through a dynamic import', async () => {
    await expect(loadPostHogBrowserSdk()).resolves.toEqual({
      default: posthog,
    });
  });
});
