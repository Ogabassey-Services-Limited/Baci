import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('@/lib/posthog/browser', () => ({
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

function importInstrumentationClient() {
  return import('./instrumentation-client');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('instrumentation-client', () => {
  it('initializes browser PostHog instrumentation', async () => {
    await importInstrumentationClient();

    expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      })
    );
  });
});
