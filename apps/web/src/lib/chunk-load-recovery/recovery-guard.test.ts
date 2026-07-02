import { describe, expect, it, vi } from 'vitest';
import { evaluateRecoveryGuard, getRecoveryStorageKey } from './recovery-guard';

function createStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    storage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    },
  };
}

describe('evaluateRecoveryGuard with sessionStorage', () => {
  it('allows one reload per deployment/path key and commits the guard', () => {
    const { map, storage } = createStorage();
    const runtime = { getSessionStorage: () => storage };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'reload'
    );
    expect(map.get(getRecoveryStorageKey('deploy-1', '/checkout'))).toBe('1');
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'skipped-already-attempted'
    );
  });

  it('does not consume the guard when peeking without commit', () => {
    const { map, storage } = createStorage();
    const runtime = { getSessionStorage: () => storage };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', false)).toBe(
      'reload'
    );

    expect(map.size).toBe(0);
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'reload'
    );
  });

  it('allows reloads for a new deployment or path', () => {
    const { storage } = createStorage();
    const runtime = { getSessionStorage: () => storage };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'reload'
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-2', '/checkout', true)).toBe(
      'reload'
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-2', '/cart', true)).toBe(
      'reload'
    );
  });

  it('caps recovery reloads per session', () => {
    const { storage } = createStorage({
      'baci:chunk-load-recovery:reload-count': '3',
    });
    const runtime = { getSessionStorage: () => storage };

    expect(evaluateRecoveryGuard(runtime, 'deploy-9', '/new-path', true)).toBe(
      'skipped-session-cap'
    );
  });
});

describe('evaluateRecoveryGuard window.name fallback', () => {
  it('fails open once per key when sessionStorage is unavailable', () => {
    let windowName = 'existing-value';
    const runtime = {
      getSessionStorage: () => {
        throw new Error('storage unavailable');
      },
      getWindowName: () => windowName,
      setWindowName: (value: string) => {
        windowName = value;
      },
    };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'reload'
    );
    expect(windowName).toContain('existing-value');
    expect(windowName).toContain(
      getRecoveryStorageKey('deploy-1', '/checkout')
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'skipped-already-attempted'
    );
  });

  it('falls back to window.name when sessionStorage writes throw', () => {
    let windowName = '';
    const runtime = {
      getSessionStorage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('private mode');
        },
      }),
      getWindowName: () => windowName,
      setWindowName: (value: string) => {
        windowName = value;
      },
    };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'reload'
    );
    expect(windowName).toContain(
      getRecoveryStorageKey('deploy-1', '/checkout')
    );
  });

  it('caps window.name recovery attempts per session', () => {
    let windowName = '';
    const runtime = {
      getSessionStorage: () => undefined,
      getWindowName: () => windowName,
      setWindowName: (value: string) => {
        windowName = value;
      },
    };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/a', true)).toBe(
      'reload'
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/b', true)).toBe(
      'reload'
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/c', true)).toBe(
      'reload'
    );
    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/d', true)).toBe(
      'skipped-session-cap'
    );
  });

  it('reports storage-unavailable when no guard can persist', () => {
    const runtime = {
      getSessionStorage: () => undefined,
    };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'skipped-storage-unavailable'
    );
  });

  it('never throws when window.name access throws', () => {
    const runtime = {
      getSessionStorage: () => undefined,
      getWindowName: () => {
        throw new Error('window.name blocked');
      },
      setWindowName: vi.fn(),
    };

    expect(evaluateRecoveryGuard(runtime, 'deploy-1', '/checkout', true)).toBe(
      'skipped-storage-unavailable'
    );
  });
});
