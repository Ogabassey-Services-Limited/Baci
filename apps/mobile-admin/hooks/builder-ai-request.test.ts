import { builderAiEditTestFixture } from '@baci/shared/test-fixtures/builder-ai-edit';
import { describe, expect, it } from 'vitest';
import {
  buildBuilderAiEditRequest,
  isCurrentBuilderAiRequest,
  type LegacyBuilderAiResponse,
  parseBuilderAiEditCandidate,
} from './builder-ai-request';

describe('isCurrentBuilderAiRequest', () => {
  it('rejects a prior request after a later request starts', () => {
    const sequence = { current: 2 };

    expect(isCurrentBuilderAiRequest(sequence, 1)).toBe(false);
    expect(isCurrentBuilderAiRequest(sequence, 2)).toBe(true);
  });
});

describe('dormant builder AI edit v1 adapters', () => {
  it('builds the exact shared versioned request shape without I/O', () => {
    expect(
      buildBuilderAiEditRequest({
        clientRequestId: builderAiEditTestFixture.request.clientRequestId,
        currentConfig: builderAiEditTestFixture.request.currentConfig,
        merchantId: builderAiEditTestFixture.request.merchantId,
        prompt: builderAiEditTestFixture.request.prompt,
      })
    ).toEqual(builderAiEditTestFixture.request);
  });

  it('accepts only a shared-valid candidate and rejects unknown response data', () => {
    expect(
      parseBuilderAiEditCandidate(builderAiEditTestFixture.candidate)
    ).toEqual(builderAiEditTestFixture.candidate);
    expect(() =>
      parseBuilderAiEditCandidate({
        ...builderAiEditTestFixture.candidate,
        extra: true,
      })
    ).toThrow();
  });

  it('keeps the legacy response source-compatible as a config object', () => {
    const legacy: LegacyBuilderAiResponse = {
      config: { content: [], root: { title: 'Home' } },
    };

    expect(legacy.config.root.title).toBe('Home');
  });
});
