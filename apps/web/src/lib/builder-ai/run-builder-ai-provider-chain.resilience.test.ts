import { builderAiEditTestFixture } from '@baci/shared/test-fixtures/builder-ai-edit';
import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builderAiProviderCooldown } from './builder-ai-provider-cooldown';
import { runBuilderAiProviderChain } from './run-builder-ai-provider-chain';

const ai = vi.hoisted(() => {
  class NoObject extends Error {
    static isInstance(error: unknown): boolean {
      return error instanceof NoObject;
    }
  }
  return { NoObject };
});

vi.mock('ai', () => ({
  generateText: vi.fn(),
  NoObjectGeneratedError: ai.NoObject,
  Output: { json: vi.fn(() => 'json-output') },
}));

const providers = [
  { model: { id: 'cerebras' } as never, name: 'cerebras:gemma-4-31b' },
  { model: { id: 'groq' } as never, name: 'groq:openai/gpt-oss-120b' },
];
const validPlan = {
  operations: [
    {
      componentId: 'hero-1',
      kind: 'update_component',
      patch: { componentType: 'Hero', title: 'Safer title' },
    },
  ],
  status: 'proposed',
  summary: 'Update the hero title',
};

function run(): Promise<unknown> {
  return runBuilderAiProviderChain({
    currentConfig: builderAiEditTestFixture.request.currentConfig,
    deadlineAt: 5_000,
    now: () => 0,
    prompt: 'Update the hero',
    providerChain: providers,
    signal: new AbortController().signal,
  });
}

describe('runBuilderAiProviderChain resilience', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    builderAiProviderCooldown.resetForTests();
    vi.restoreAllMocks();
  });

  it('reserves a reliable-provider tail so Cerebras cannot consume Groq deadline', async () => {
    const timeouts: number[] = [];
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      timeouts.push(milliseconds);
      return new AbortController().signal;
    });
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        output: { operations: [], status: 'proposed', summary: '' },
      } as never)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(run()).resolves.toEqual(validPlan);

    expect(timeouts).toEqual([2_000, 4_000]);
  });

  it('recognizes a structured SDK 429, skips duplicate retries, and falls through', async () => {
    const quotaError = Object.assign(new Error('upstream rejected request'), {
      statusCode: 429,
    });
    vi.mocked(generateText)
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(run()).resolves.toEqual(validPlan);

    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('prefers a later operational failure over an earlier invalid shape', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        output: { operations: [], status: 'proposed', summary: '' },
      } as never)
      .mockRejectedValue(new Error('upstream outage'));

    await expect(run()).rejects.toEqual({ code: 'ai_provider_unavailable' });
  });

  it('does not retry a provider after a structured quota rejection', async () => {
    vi.mocked(generateText).mockRejectedValue(
      Object.assign(new Error('upstream rejected request'), { statusCode: 429 })
    );

    await expect(run()).rejects.toEqual({ code: 'ai_provider_rate_limited' });

    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('uses the production cooldown to skip a previously rate-limited provider', async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(
        Object.assign(new Error('upstream rejected request'), {
          statusCode: 429,
        })
      )
      .mockResolvedValueOnce({ output: validPlan } as never)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(run()).resolves.toEqual(validPlan);
    await expect(run()).resolves.toEqual(validPlan);

    expect(generateText).toHaveBeenCalledTimes(3);
    expect(vi.mocked(generateText).mock.calls[2]?.[0]?.model).toBe(
      providers[1]?.model
    );
  });
});
