import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChunkLoadRecoveryHandlers } from './chunk-load-recovery';

const NEXT_DEPLOYMENT_ID_GLOBAL = 'NEXT_DEPLOYMENT_ID';

function createRuntime() {
  const storage = new Map<string, string>();
  return {
    runtime: {
      getDeploymentId: () => 'deploy-1',
      getPathname: () => '/checkout',
      getSessionStorage: () => ({
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      }),
      reload: vi.fn(),
    },
  };
}

describe('chunk-load recovery', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, NEXT_DEPLOYMENT_ID_GLOBAL);
    delete document.documentElement.dataset.dplId;
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('reloads once for ChunkLoadError promise rejections', () => {
    const { runtime } = createRuntime();
    const handlers = createChunkLoadRecoveryHandlers(runtime);

    handlers.handleUnhandledRejection({
      reason: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
    });
    handlers.handleUnhandledRejection({
      reason: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
    });

    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads for named chunk loading failures', () => {
    const { runtime } = createRuntime();
    const handlers = createChunkLoadRecoveryHandlers(runtime);

    handlers.handleUnhandledRejection({
      reason: new Error('Loading chunk app/layout failed.'),
    });

    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload for unrelated runtime errors', () => {
    const { runtime } = createRuntime();
    const handlers = createChunkLoadRecoveryHandlers(runtime);

    handlers.handleWindowError({
      error: new Error('maximumFractionDigits value is out of range'),
      message: 'maximumFractionDigits value is out of range',
    });

    expect(runtime.reload).not.toHaveBeenCalled();
  });

  it('does not reload when sessionStorage cannot persist a loop guard', () => {
    const reload = vi.fn();
    const handlers = createChunkLoadRecoveryHandlers({
      getDeploymentId: () => 'deploy-1',
      getPathname: () => '/checkout',
      getSessionStorage: () => {
        throw new Error('storage unavailable');
      },
      reload,
    });

    handlers.handleUnhandledRejection({
      reason: 'Failed to load chunk /_next/static/chunks/app.js',
    });
    handlers.handleUnhandledRejection({
      reason: 'Failed to load chunk /_next/static/chunks/app.js',
    });

    expect(reload).not.toHaveBeenCalled();
  });

  it('initializes browser chunk recovery listeners once', async () => {
    vi.resetModules();
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => undefined);
    const { initializeChunkLoadRecovery } = await import(
      './chunk-load-recovery'
    );

    initializeChunkLoadRecovery();
    initializeChunkLoadRecovery();

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
  });

  it('keys browser recovery with loaded Next assets when no deployment id global remains', async () => {
    vi.resetModules();
    document.head.innerHTML = `
      <script src="/_next/static/chunks/app/checkout-abc123.js"></script>
      <link rel="stylesheet" href="https://cdn.example.com/_next/static/css/layout-def456.css" />
    `;

    const storage = new Map<string, string>();
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => undefined);
    window.history.pushState({}, '', '/checkout');
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        throw new Error('stop before jsdom navigation');
      },
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
    });
    const { initializeChunkLoadRecovery } = await import(
      './chunk-load-recovery'
    );

    initializeChunkLoadRecovery();
    const errorListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'error'
    )?.[1];
    expect(errorListener).toEqual(expect.any(Function));

    (errorListener as EventListener)({
      error: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
      message: 'ChunkLoadError',
    } as ErrorEvent);

    expect(Array.from(storage.keys())).toEqual([
      expect.stringMatching(
        /^baci:chunk-load-recovery:assets-[a-z0-9]+:\/checkout$/
      ),
    ]);
  });

  it('uses a stable dpl query value before asset hashing', async () => {
    vi.resetModules();
    document.head.innerHTML = `
      <script src="/_next/static/chunks/app/layout-abc123.js?dpl=deploy-123"></script>
      <script src="/_next/static/chunks/app/page-def456.js?dpl=deploy-123"></script>
    `;

    const storage = new Map<string, string>();
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => undefined);
    window.history.pushState({}, '', '/checkout');
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        throw new Error('stop before jsdom navigation');
      },
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
    });
    const { initializeChunkLoadRecovery } = await import(
      './chunk-load-recovery'
    );

    initializeChunkLoadRecovery();
    const errorListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'error'
    )?.[1];
    expect(errorListener).toEqual(expect.any(Function));

    (errorListener as EventListener)({
      error: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
      message: 'ChunkLoadError',
    } as ErrorEvent);

    expect(
      storage.has('baci:chunk-load-recovery:dpl:deploy-123:/checkout')
    ).toBe(true);
  });

  it('freezes the loaded-asset fallback at initialization', async () => {
    vi.resetModules();
    document.head.innerHTML = `
      <script src="/_next/static/chunks/app/initial-abc123.js"></script>
    `;

    const storage = new Map<string, string>();
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => undefined);
    window.history.pushState({}, '', '/checkout');
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        throw new Error('stop before jsdom navigation');
      },
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
    });
    const { initializeChunkLoadRecovery } = await import(
      './chunk-load-recovery'
    );

    initializeChunkLoadRecovery();
    document.head.insertAdjacentHTML(
      'beforeend',
      '<script src="/_next/static/chunks/app/later-def456.js?dpl=later-deploy"></script>'
    );
    const errorListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'error'
    )?.[1];
    expect(errorListener).toEqual(expect.any(Function));

    (errorListener as EventListener)({
      error: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
      message: 'ChunkLoadError',
    } as ErrorEvent);

    expect(Array.from(storage.keys())).toEqual([
      expect.stringMatching(
        /^baci:chunk-load-recovery:assets-[a-z0-9]+:\/checkout$/
      ),
    ]);
    expect(Array.from(storage.keys()).join(' ')).not.toContain('later-deploy');
  });

  it('keys browser recovery with Next deployment id after Next removes data-dpl-id', async () => {
    vi.resetModules();
    Object.defineProperty(globalThis, NEXT_DEPLOYMENT_ID_GLOBAL, {
      configurable: true,
      value: 'next-global-deploy',
    });

    const storage = new Map<string, string>();
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => undefined);
    window.history.pushState({}, '', '/checkout');
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        throw new Error('stop before jsdom navigation');
      },
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
    });
    const { initializeChunkLoadRecovery } = await import(
      './chunk-load-recovery'
    );

    initializeChunkLoadRecovery();
    const errorListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'error'
    )?.[1];
    expect(errorListener).toEqual(expect.any(Function));

    (errorListener as EventListener)({
      error: new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/app.js'
      ),
      message: 'ChunkLoadError',
    } as ErrorEvent);

    expect(
      storage.has('baci:chunk-load-recovery:next-global-deploy:/checkout')
    ).toBe(true);
  });
});
