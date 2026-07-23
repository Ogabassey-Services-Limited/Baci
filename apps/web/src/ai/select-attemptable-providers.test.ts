import { beforeEach, describe, expect, it } from 'vitest';
import {
  recordProviderFailure,
  resetProviderCooldowns,
} from './provider-cooldown';
import { selectAttemptableProviders } from './select-attemptable-providers';
import type { TextProvider } from './text-provider-chain';

function provider(name: string, opportunistic = false): TextProvider {
  return {
    name,
    model: { id: name } as unknown as TextProvider['model'],
    opportunistic,
  };
}

const cerebras = provider('cerebras:gemma-4-31b');
const groq = provider('groq:openai/gpt-oss-120b');
const gemini = provider('google:gemini-2.5-flash');
const openRouter = provider('openrouter:free', true);

beforeEach(() => {
  resetProviderCooldowns();
});

describe('selectAttemptableProviders', () => {
  it('drops opportunistic providers', () => {
    const selected = selectAttemptableProviders([cerebras, gemini, openRouter]);

    expect(selected.map((p) => p.name)).toEqual([
      'cerebras:gemma-4-31b',
      'google:gemini-2.5-flash',
    ]);
  });

  it('skips a provider parked by a rate-limit cooldown', () => {
    recordProviderFailure('cerebras:gemma-4-31b', new Error('rate limit'));

    const selected = selectAttemptableProviders([cerebras, groq, gemini]);

    expect(selected.map((p) => p.name)).toEqual([
      'groq:openai/gpt-oss-120b',
      'google:gemini-2.5-flash',
    ]);
  });

  it('keeps a provider that failed for a non-rate-limit reason', () => {
    recordProviderFailure('cerebras:gemma-4-31b', new Error('503 upstream'));

    const selected = selectAttemptableProviders([cerebras, gemini]);

    expect(selected.map((p) => p.name)).toEqual([
      'cerebras:gemma-4-31b',
      'google:gemini-2.5-flash',
    ]);
  });

  it('falls back to the full chain when every provider is cooling down', () => {
    recordProviderFailure('cerebras:gemma-4-31b', new Error('rate limit'));
    recordProviderFailure('groq:openai/gpt-oss-120b', new Error('rate limit'));
    recordProviderFailure('google:gemini-2.5-flash', new Error('rate limit'));

    const selected = selectAttemptableProviders([cerebras, groq, gemini]);

    // Cooldowns are a per-instance heuristic and can be stale — attempting a
    // doomed-looking chain still beats failing the request without trying.
    expect(selected.map((p) => p.name)).toEqual([
      'cerebras:gemma-4-31b',
      'groq:openai/gpt-oss-120b',
      'google:gemini-2.5-flash',
    ]);
  });

  it('returns an empty list when the chain has no non-opportunistic providers', () => {
    expect(selectAttemptableProviders([openRouter])).toEqual([]);
  });
});
