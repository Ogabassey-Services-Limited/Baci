import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CopilotTextProvider } from '@/ai/copilot-provider-chain';
import { withRetry } from '@/ai/provider';
import { aiBuilderConfigSchema } from './builder-config-shape';
import { isBuilderConfigShapeError } from './route-provider-errors';
import { runBuilderProviderChain } from './run-builder-provider-chain';

vi.mock('ai', () => ({ generateObject: vi.fn() }));
vi.mock('@/ai/provider', () => ({
  // Pass-through so we can assert WHICH providers are wrapped in a retry.
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

const validObject = {
  content: [{ type: 'Hero', props: { title: 'Generated' } }],
  root: { title: 'Home' },
  zones: {},
};

const currentConfig = aiBuilderConfigSchema.parse({
  content: [{ type: 'Hero', props: { title: 'Home' } }],
  root: { title: 'Home' },
  zones: {},
});

function provider(name: string, opportunistic = false): CopilotTextProvider {
  return {
    name,
    model: { id: name } as unknown as CopilotTextProvider['model'],
    opportunistic,
  };
}

type Behavior = 'valid' | 'offshape' | Error;

function respondByModel(map: Record<string, Behavior>) {
  vi.mocked(generateObject).mockImplementation(((opts: {
    model: { id: string };
  }) => {
    const behavior = map[opts.model.id];
    if (behavior instanceof Error) {
      return Promise.reject(behavior);
    }
    // `offshape` returns JSON with no `content` array — the in-code validator
    // rejects it as a shape error (a failed attempt).
    return Promise.resolve({
      object: behavior === 'offshape' ? { theme: {} } : validObject,
    });
  }) as unknown as typeof generateObject);
}

const baseOptions = () => ({
  builtPrompt: 'prompt',
  currentConfig,
  routeDeadlineMs: Date.now() + 25_000,
  abortSignal: new AbortController().signal,
  onProviderError: vi.fn(),
});

describe('runBuilderProviderChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the primary config and wraps the primary in a retry', async () => {
    respondByModel({ flash: 'valid' });

    const result = await runBuilderProviderChain({
      ...baseOptions(),
      providerChain: [provider('flash')],
    });

    expect(result.content).toHaveLength(1);
    // The PRIMARY (not just the last fallback) is retry-wrapped...
    expect(withRetry).toHaveBeenCalledTimes(1);
    // ...and the attempt's own AbortSignal + a quota classifier are threaded in
    // so withRetry can skip a doomed retry the moment that signal (budget/route
    // deadline) fires, and fail fast on an exhausted free pool.
    expect(withRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.anything(),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        isNonRetryable: expect.any(Function),
      })
    );
  });

  it('falls through to the reliable fallback when the primary has a transient failure', async () => {
    respondByModel({ flash: new Error('network blip'), lite: 'valid' });
    const onProviderError = vi.fn();

    const result = await runBuilderProviderChain({
      ...baseOptions(),
      providerChain: [provider('flash'), provider('lite')],
      onProviderError,
    });

    expect(result.content).toHaveLength(1);
    expect(onProviderError).toHaveBeenCalledTimes(1);
    expect(onProviderError).toHaveBeenCalledWith(
      'flash',
      expect.any(Error),
      false
    );
  });

  it('retries every RELIABLE provider but never the opportunistic tail', async () => {
    // flash + lite are reliable; the opportunistic OpenRouter link is not.
    respondByModel({
      flash: 'offshape',
      lite: 'offshape',
      openrouter: 'valid',
    });

    const result = await runBuilderProviderChain({
      ...baseOptions(),
      providerChain: [
        provider('flash'),
        provider('lite'),
        provider('openrouter', true),
      ],
    });

    expect(result.content).toHaveLength(1);
    // withRetry wraps flash + lite only — the opportunistic tail runs bare.
    expect(withRetry).toHaveBeenCalledTimes(2);
  });

  it('surfaces an early outage over a trailing shape error (503, not 502)', async () => {
    // Mixed failure: primary is a genuine outage, the last provider merely
    // returns off-shape JSON. The thrown cause must be the outage so the route
    // maps it to "unavailable", not "invalid output".
    respondByModel({ flash: new Error('upstream 503'), lite: 'offshape' });

    let thrown: unknown;
    try {
      await runBuilderProviderChain({
        ...baseOptions(),
        providerChain: [provider('flash'), provider('lite')],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(isBuilderConfigShapeError(thrown)).toBe(false);
    expect((thrown as Error).message).toContain('upstream 503');
  });

  it('throws a shape error when every provider returns off-shape JSON', async () => {
    respondByModel({ flash: 'offshape', lite: 'offshape' });

    let thrown: unknown;
    try {
      await runBuilderProviderChain({
        ...baseOptions(),
        providerChain: [provider('flash'), provider('lite')],
      });
    } catch (error) {
      thrown = error;
    }

    expect(isBuilderConfigShapeError(thrown)).toBe(true);
  });

  it('stops the chain immediately when the route deadline has aborted', async () => {
    respondByModel({ flash: new Error('aborted'), lite: 'valid' });
    const controller = new AbortController();
    controller.abort();
    const onProviderError = vi.fn();

    await expect(
      runBuilderProviderChain({
        ...baseOptions(),
        abortSignal: controller.signal,
        providerChain: [provider('flash'), provider('lite')],
        onProviderError,
      })
    ).rejects.toThrow('aborted');

    // The deadline fired: it must NOT keep trying the fallback or log a
    // per-provider failure — it bails so the timeout maps to the usual response.
    expect(onProviderError).not.toHaveBeenCalled();
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
});
