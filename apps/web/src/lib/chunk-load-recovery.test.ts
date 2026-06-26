import { describe, expect, it, vi } from 'vitest';
import { createChunkLoadRecoveryHandlers } from './chunk-load-recovery';

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

    addEventListenerSpy.mockRestore();
  });
});
