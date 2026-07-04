import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capturePostHogPageview: vi.fn(),
  initializeChunkLoadRecovery: vi.fn(),
  initializePostHogBrowser: vi.fn(),
  scheduleIdleBoot: vi.fn((_callback: () => void) => () => undefined),
}));

vi.mock('@/lib/chunk-load-recovery', () => ({
  initializeChunkLoadRecovery: mocks.initializeChunkLoadRecovery,
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogPageview: mocks.capturePostHogPageview,
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

// The idle-boot mechanics (requestIdleCallback / load / first interaction /
// timeout) are covered in schedule-idle-boot.test.ts. Here the helper is mocked
// so the deferred boot can be triggered deterministically.
vi.mock('@/lib/posthog/schedule-idle-boot', () => ({
  scheduleIdleBoot: mocks.scheduleIdleBoot,
}));

function importInstrumentationClient() {
  return import('./instrumentation-client');
}

/** Runs the callback the module handed to the (mocked) idle-boot scheduler. */
function fireDeferredBoot() {
  const scheduledBoot = mocks.scheduleIdleBoot.mock.calls[0]?.[0];
  scheduledBoot?.();
}

async function flushPostHogMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.clearAllMocks();
  mocks.scheduleIdleBoot.mockImplementation(() => () => undefined);
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('instrumentation-client', () => {
  it('initializes chunk-load recovery eagerly but defers the PostHog boot', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });

    await importInstrumentationClient();

    expect(mocks.initializeChunkLoadRecovery).toHaveBeenCalledOnce();
    expect(mocks.scheduleIdleBoot).toHaveBeenCalledOnce();
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });

  it('initializes browser PostHog instrumentation once the deferred boot fires', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });

    await importInstrumentationClient();
    fireDeferredBoot();

    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({ NODE_ENV: expect.any(String) })
    );
    expect(mocks.capturePostHogPageview).toHaveBeenCalledOnce();
  });

  it('owns the landing pageview: captures it exactly once, after the boot', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });

    await importInstrumentationClient();
    fireDeferredBoot();

    await vi.waitFor(() => {
      expect(mocks.capturePostHogPageview).toHaveBeenCalledOnce();
    });
    // The tracker no longer captures the landing view before boot, so this is
    // the sole capture — and it must run after init so posthog-js can buffer it.
    const [initOrder] = mocks.initializePostHogBrowser.mock.invocationCallOrder;
    const [captureOrder] =
      mocks.capturePostHogPageview.mock.invocationCallOrder;
    expect(initOrder).toBeLessThan(captureOrder);
  });

  it('does not initialize if imported without a browser window', async () => {
    vi.stubGlobal('window', undefined);

    await importInstrumentationClient();
    fireDeferredBoot();
    await flushPostHogMicrotasks();

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });

  it('skips PostHog on public blog pages even after the deferred boot fires', async () => {
    vi.stubGlobal('location', {
      pathname: '/blog/phone-guide',
      href: 'https://ogabassey.com/blog/phone-guide',
    });

    await importInstrumentationClient();
    fireDeferredBoot();
    await flushPostHogMicrotasks();

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });

  it('initializes after an explicit client transition away from a skipped blog page', async () => {
    vi.stubGlobal('location', {
      pathname: '/blog/phone-guide',
      href: 'https://ogabassey.com/blog/phone-guide',
    });

    const { initializePostHogInstrumentationIfAllowed } =
      await importInstrumentationClient();
    fireDeferredBoot();
    await flushPostHogMicrotasks();
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();

    initializePostHogInstrumentationIfAllowed('/products/macbook-pro');

    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });
    expect(mocks.capturePostHogPageview).toHaveBeenCalledOnce();
  });
});
