import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME,
  generateObjectWithChain,
} from './generate-object-with-chain';
import { resetProviderCooldowns } from './provider-cooldown';
import type { TextProvider } from './text-provider-chain';

vi.mock('ai', () => ({ generateObject: vi.fn() }));

const schema = z.object({
  name: z.string().min(1),
  price: z.number(),
});

function provider(name: string, opportunistic = false): TextProvider {
  return {
    name,
    model: { id: name } as unknown as TextProvider['model'],
    opportunistic,
  };
}

type Behavior = unknown | Error;

function respondByModel(map: Record<string, Behavior>) {
  vi.mocked(generateObject).mockImplementation(((opts: {
    model: { id: string };
  }) => {
    const behavior = map[opts.model.id];
    if (behavior instanceof Error) {
      return Promise.reject(behavior);
    }
    return Promise.resolve({ object: behavior });
  }) as unknown as typeof generateObject);
}

beforeEach(() => {
  vi.mocked(generateObject).mockReset();
  resetProviderCooldowns();
});

describe('generateObjectWithChain', () => {
  it('returns the schema-validated object from the first healthy provider', async () => {
    respondByModel({ a: { name: 'Sneaker', price: 25000 } });

    const result = await generateObjectWithChain({
      schema,
      chain: [provider('a')],
      prompt: 'make a product',
    });

    expect(result).toEqual({
      object: { name: 'Sneaker', price: 25000 },
      providerName: 'a',
    });
  });

  it('requests loose JSON mode with retries disabled', async () => {
    respondByModel({ a: { name: 'Sneaker', price: 25000 } });

    await generateObjectWithChain({
      schema,
      chain: [provider('a')],
      prompt: 'make a product',
    });

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'no-schema', maxRetries: 0 })
    );
  });

  it('falls through when a provider returns off-shape JSON', async () => {
    respondByModel({
      a: { name: '', price: 'not-a-number' },
      b: { name: 'Sneaker', price: 25000 },
    });

    const result = await generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'make a product',
    });

    expect(result.providerName).toBe('b');
  });

  it('falls through when a provider throws', async () => {
    respondByModel({
      a: new Error('quota exhausted'),
      b: { name: 'Sneaker', price: 25000 },
    });

    const result = await generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'make a product',
    });

    expect(result.providerName).toBe('b');
  });

  it('falls through when the semantic validate hook rejects the draft', async () => {
    respondByModel({
      a: { name: 'Sneaker', price: -5 },
      b: { name: 'Sneaker', price: 25000 },
    });

    const result = await generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'make a product',
      validate: (parsed) =>
        parsed.price <= 0 ? 'price must be positive' : null,
    });

    expect(result.providerName).toBe('b');
  });

  it('throws a named exhaustion error when every provider fails', async () => {
    respondByModel({
      a: new Error('down'),
      b: { name: '', price: Number.NaN },
    });

    const attempt = generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'make a product',
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME,
    });
  });

  it('skips a rate-limited provider on the NEXT call', async () => {
    respondByModel({
      a: Object.assign(new Error('rate limit exceeded'), { statusCode: 429 }),
      b: { name: 'Sneaker', price: 25000 },
    });

    await generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'first',
    });
    vi.mocked(generateObject).mockClear();

    const second = await generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'second',
    });

    expect(second.providerName).toBe('b');
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it('skips opportunistic providers entirely', async () => {
    respondByModel({
      a: new Error('down'),
      opp: { name: 'Sneaker', price: 25000 },
    });

    const attempt = generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('opp', true)],
      prompt: 'make a product',
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME,
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it('stops before starting a provider it cannot finish within overallTimeoutMs', async () => {
    // A slow first provider that burns the overall budget must not let the walk
    // start another provider, so the caller's fallback runs inside the route
    // deadline instead of the route timing out mid-attempt.
    let now = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(generateObject).mockImplementation(((opts: {
      model: { id: string };
    }) => {
      if (opts.model.id === 'a') {
        now += 600; // consume more than the 500ms overall budget
        return Promise.reject(new Error('slow provider failed'));
      }
      return Promise.resolve({ object: { name: 'Sneaker', price: 25000 } });
    }) as unknown as typeof generateObject);

    const attempt = generateObjectWithChain({
      schema,
      chain: [provider('a'), provider('b')],
      prompt: 'make a product',
      overallTimeoutMs: 500,
    });

    await expect(attempt).rejects.toMatchObject({
      name: ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME,
      message: expect.stringContaining('overall deadline exceeded'),
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
