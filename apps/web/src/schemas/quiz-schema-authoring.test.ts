import { describe, expect, it } from 'vitest';
import { merchantQuizGenerationRequestSchema } from './quiz-schema-authoring';

describe('quiz authoring schema', () => {
  it('accepts a complete draft-generation request', () => {
    expect(
      merchantQuizGenerationRequestSchema.safeParse({
        difficulty: 'standard',
        mode: 'test',
        prizeCondition: 'new',
        prizeEffectiveStock: 2,
        prizeImageUrl: 'https://cdn.example.com/phone.png',
        prizeProductId: '55555555-5555-4555-8555-555555555555',
        questionCountPerTopic: 1,
        timeLimitSeconds: 10,
        title: 'Phone quiz',
        topics: ['Phones'],
      }).success
    ).toBe(true);
  });
});
