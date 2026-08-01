import { describe, expect, it } from 'vitest';
import { isCurrentBuilderAiRequest } from './builder-ai-request';

describe('isCurrentBuilderAiRequest', () => {
  it('rejects a prior request after a later request starts', () => {
    const sequence = { current: 2 };

    expect(isCurrentBuilderAiRequest(sequence, 1)).toBe(false);
    expect(isCurrentBuilderAiRequest(sequence, 2)).toBe(true);
  });
});
