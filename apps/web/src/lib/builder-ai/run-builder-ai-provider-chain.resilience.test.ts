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

  it('reserves an eight-second reliable tail while a hung primary advances the clock', async () => {
    const timeouts: number[] = [];
    const clock = [0, 12_000, 12_000];
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      timeouts.push(milliseconds);
      return new AbortController().signal;
    });
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        output: { operations: [], status: 'proposed', summary: '' },
      } as never)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(
      runBuilderAiProviderChain({
        currentConfig: builderAiEditTestFixture.request.currentConfig,
        deadlineAt: 25_000,
        now: () => clock.shift() ?? 12_000,
        prompt: 'Update the hero',
        providerChain: providers,
        signal: new AbortController().signal,
      })
    ).resolves.toEqual(validPlan);

    expect(timeouts).toEqual([4_000, 12_000]);
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

  it('returns invalid output only when every attempted provider is schema or semantic invalid', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        output: { operations: [], status: 'proposed', summary: '' },
      } as never)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(
      runBuilderAiProviderChain({
        currentConfig: builderAiEditTestFixture.request.currentConfig,
        deadlineAt: 20_000,
        now: () => 0,
        prompt: 'Update the hero',
        providerChain: providers,
        signal: new AbortController().signal,
        validateSemantics: () => false,
      })
    ).rejects.toEqual({ code: 'ai_builder_invalid_output' });
  });

  it('returns invalid output when every provider raises NoObjectGeneratedError', async () => {
    vi.mocked(generateText).mockRejectedValue(new ai.NoObject('invalid JSON'));

    await expect(run()).rejects.toEqual({ code: 'ai_builder_invalid_output' });
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('prefers unavailable for a mixed quota and outage exhaustion', async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(
        Object.assign(new Error('quota exhausted'), { status: 429 })
      )
      .mockRejectedValueOnce(new Error('provider refused connection'));

    await expect(run()).rejects.toEqual({ code: 'ai_provider_unavailable' });
  });

  it('logs safe fallback events for both schema-invalid and semantic-invalid results', async () => {
    const warn = vi.fn();
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        output: { operations: [], status: 'proposed', summary: '' },
      } as never)
      .mockResolvedValueOnce({ output: validPlan } as never);

    await expect(
      runBuilderAiProviderChain({
        currentConfig: builderAiEditTestFixture.request.currentConfig,
        deadlineAt: 20_000,
        logger: { warn },
        now: () => 0,
        prompt: 'Update the hero',
        providerChain: providers,
        signal: new AbortController().signal,
        validateSemantics: () => false,
      })
    ).rejects.toEqual({ code: 'ai_builder_invalid_output' });

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'builder_ai_provider_fallback',
        provider: providers[0]?.name,
      })
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'builder_ai_provider_fallback',
        provider: providers[1]?.name,
      })
    );
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
