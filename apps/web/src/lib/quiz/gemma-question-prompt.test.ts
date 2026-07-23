import { describe, expect, it } from 'vitest';
import {
  buildQuizQuestionPrompt,
  getQuizQuestionCompletionTokenBudget,
} from './gemma-question-prompt';

describe('Gemma quiz question prompt', () => {
  it('builds the required JSON shape without absent product context', () => {
    const prompt = JSON.parse(
      buildQuizQuestionPrompt({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ) as Record<string, unknown>;

    expect(prompt).toMatchObject({
      difficulty: 'standard',
      merchantName: 'Ogabassey',
      questionCountPerTopic: 1,
      topics: ['Android buying advice'],
    });
    expect(prompt).not.toHaveProperty('productContext');
    expect(prompt).toHaveProperty('requiredJsonShape.questions');
  });

  it('includes explicit product context', () => {
    const prompt = JSON.parse(
      buildQuizQuestionPrompt({
        difficulty: 'hard',
        merchantName: 'Ogabassey',
        productContext: 'Galaxy S24 has a 4000 mAh battery.',
        questionCountPerTopic: 1,
        topics: ['Battery capacity'],
      })
    ) as Record<string, unknown>;

    expect(prompt.productContext).toBe('Galaxy S24 has a 4000 mAh battery.');
  });

  it('clamps completion tokens to the minimum and maximum budgets', () => {
    expect(
      getQuizQuestionCompletionTokenBudget({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ).toBe(2400);
    expect(
      getQuizQuestionCompletionTokenBudget({
        difficulty: 'hard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 5,
        topics: Array.from({ length: 10 }, (_, index) => `Topic ${index}`),
      })
    ).toBe(8192);
  });
});
