import { describe, expect, it } from 'vitest';
import { getBuilderAiSpecialOperationGuidance } from './get-builder-ai-special-operation-guidance';

describe('getBuilderAiSpecialOperationGuidance', () => {
  it('publishes all bounded special-operation strings', () => {
    expect(getBuilderAiSpecialOperationGuidance()).toEqual({
      updateCarouselSlide: {
        ctaLink: { maximumLength: 512 },
        ctaText: { maximumLength: 120 },
        subtitle: { maximumLength: 2000 },
        title: { maximumLength: 120 },
      },
      updateRoot: { title: { maximumLength: 120 } },
    });
  });
});
