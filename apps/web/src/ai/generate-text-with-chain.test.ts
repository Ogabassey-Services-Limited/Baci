import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
  CHAIN_WALK_STOPPED_ERROR_NAME,
  generateTextWithChain,
} from './generate-text-with-chain';
import { resetProviderCooldowns } from './provider-cooldown';
import type { TextProvider } from './text-provider-chain';

vi.mock('ai', () => ({ generateText: vi.fn() }));

function provider(name: string, opportunistic = false): TextProvider {
  return {
    name,
    model: { id: name } as unknown as TextProvider['model'],
    opportunistic,
  };
}

type Behavior = string | Error;

function respondByModel(map: Record<string, Behavior>) {
  vi.mocked(generateText).mockImplementation(((opts: {
    model: { id: string };
  }) => {
    const behavior = map[opts.model.id];
    if (behavior instanceof Error) {
      return Promise.reject(behavior);
    }
    return Promise.resolve({ text: behavior });
  }) as unknown as typeof generateText);
}

beforeEach(() => {
  vi.mocked(generateText).mockReset();
  resetProviderCooldowns();
});

describe('generateTextWithChain', () => {
  it('returns the first provider result when it succeeds', async () => {
    respondByModel({ a: 'hello from a', b: 'hello from b' });

    const result = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
    });

    expect(result).toEqual({ text: 'hello from a', providerName: 'a' });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next provider when the first throws', async () => {
    respondByModel({ a: new Error('429 rate limited'), b: 'hello from b' });

    const result = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
    });

    expect(result).toEqual({ text: 'hello from b', providerName: 'b' });
  });

  it('treats an empty completion as a failed attempt', async () => {
    respondByModel({ a: '   ', b: 'real answer' });

    const result = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
    });

    expect(result.providerName).toBe('b');
  });

  it('falls through when acceptResult rejects a completion', async () => {
    respondByModel({ a: 'missing fields', b: 'complete answer' });

    const result = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
      acceptResult: (text) => text.includes('complete'),
    });

    expect(result.providerName).toBe('b');
  });

  it('throws a named exhaustion error aggregating every provider failure', async () => {
    respondByModel({
      a: new Error('cerebras down'),
      b: new Error('groq down'),
    });

    const attempt = generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
      message: expect.stringContaining('cerebras down'),
    });
  });

  it('skips opportunistic providers entirely', async () => {
    respondByModel({ a: new Error('down'), opp: 'should never be used' });

    const attempt = generateTextWithChain({
      chain: [provider('a'), provider('opp', true)],
      prompt: 'hi',
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('stops walking when the caller signal is already aborted', async () => {
    respondByModel({ a: 'never reached' });
    const controller = new AbortController();
    controller.abort();

    const attempt = generateTextWithChain({
      chain: [provider('a')],
      prompt: 'hi',
      abortSignal: controller.signal,
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
      message: expect.stringContaining('request aborted'),
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('reports provider errors with isLastProvider only on the final link', async () => {
    respondByModel({
      a: new Error('first down'),
      b: new Error('second down'),
    });
    const seen: [string, boolean][] = [];

    await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
      onProviderError: (name, _error, isLast) => {
        seen.push([name, isLast]);
      },
    }).catch(() => undefined);

    expect(seen).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('disables per-provider retries and Gemini thinking by default', async () => {
    respondByModel({ a: 'ok' });

    await generateTextWithChain({ chain: [provider('a')], prompt: 'hi' });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      })
    );
  });

  it('halts the walk with a stop error when shouldStopWalk returns true', async () => {
    respondByModel({
      a: new Error('failed after side effect'),
      b: 'should never be reached',
    });

    const attempt = generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
      shouldStopWalk: () => true,
    });

    await expect(attempt).rejects.toMatchObject({
      name: CHAIN_WALK_STOPPED_ERROR_NAME,
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('skips a rate-limited provider on the NEXT call instead of re-paying its 429', async () => {
    // Cerebras' free tier allows only 5 req/min, so a 429 there is routine —
    // the next request must not pay another doomed round-trip to it.
    respondByModel({
      a: Object.assign(new Error('rate limit exceeded'), { statusCode: 429 }),
      b: 'answer from b',
    });

    await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'first',
    });
    vi.mocked(generateText).mockClear();

    const second = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'second',
    });

    expect(second.providerName).toBe('b');
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateText).mock.calls[0][0].model).toMatchObject({
      id: 'b',
    });
  });

  it('does not park a provider that failed for a non-rate-limit reason', async () => {
    respondByModel({ a: new Error('503 upstream'), b: 'answer from b' });

    await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'first',
    });
    vi.mocked(generateText).mockClear();
    respondByModel({ a: 'a recovered', b: 'answer from b' });

    const second = await generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'second',
    });

    expect(second.providerName).toBe('a');
  });

  it('passes messages through instead of prompt when provided', async () => {
    respondByModel({ a: 'ok' });
    const messages = [{ role: 'user' as const, content: 'hello' }];

    await generateTextWithChain({ chain: [provider('a')], messages });

    const call = vi.mocked(generateText).mock.calls[0][0];
    expect(call.messages).toEqual(messages);
    expect(call).not.toHaveProperty('prompt');
  });

  it('stops before starting a provider it cannot finish within overallTimeoutMs', async () => {
    // A slow first provider that burns the whole budget must not let the walk
    // start another provider — the caller's fallback has to run inside the
    // route deadline. Advance a controllable clock while provider 'a' runs.
    let now = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(generateText).mockImplementation(((opts: {
      model: { id: string };
    }) => {
      if (opts.model.id === 'a') {
        now += 600; // consume more than the 500ms overall budget
        return Promise.reject(new Error('slow provider failed'));
      }
      return Promise.resolve({ text: 'from b' });
    }) as unknown as typeof generateText);

    const attempt = generateTextWithChain({
      chain: [provider('a'), provider('b')],
      prompt: 'hi',
      overallTimeoutMs: 500,
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
      message: expect.stringContaining('overall deadline exceeded'),
    });
    // 'b' is never attempted — the deadline check short-circuits the walk.
    expect(generateText).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
