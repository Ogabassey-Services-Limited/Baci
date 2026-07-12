import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = { captureException: vi.fn() };

beforeEach(() => {
  vi.resetModules();
});

describe('loadPostHogBrowserSdk', () => {
  it('loads the browser SDK through a dynamic import', async () => {
    vi.doMock('posthog-js', () => ({ default: posthog }));
    const { loadPostHogBrowserSdk } = await import('./posthog-sdk-loader');

    await expect(loadPostHogBrowserSdk()).resolves.toEqual({
      default: posthog,
    });
  });

  it('propagates an SDK chunk import failure to the caller', async () => {
    const importError = new Error('posthog chunk unavailable');
    vi.doMock('posthog-js', () => {
      throw importError;
    });
    const { loadPostHogBrowserSdk } = await import('./posthog-sdk-loader');

    await expect(loadPostHogBrowserSdk()).rejects.toThrow();
  });
});
