import { describe, expect, it } from 'vitest';
import {
  merchantQuizActivationRequestSchema,
  merchantQuizGenerationResponseSchema,
} from './quiz';

// Canonical-path coverage for the review-then-publish contract. The broader
// request/response parsing lives in quiz-schemas-input.test.ts and
// quiz-schemas-response.test.ts.
describe('merchantQuizActivationRequestSchema', () => {
  const eventId = '11111111-1111-4111-8111-111111111111';

  it('accepts an explicit activation confirmation', () => {
    const result = merchantQuizActivationRequestSchema.safeParse({
      answerKeyReview: {
        questions: [{ correctOptionId: 'a', position: 1 }],
      },
      confirmActivation: true,
      eventId,
    });

    expect(result.success).toBe(true);
  });

  it('rejects activation without the explicit confirmation flag', () => {
    expect(
      merchantQuizActivationRequestSchema.safeParse({ eventId }).success
    ).toBe(false);
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        confirmActivation: false,
        eventId,
      }).success
    ).toBe(false);
  });
});

describe('merchantQuizGenerationResponseSchema', () => {
  const baseQuestion = {
    correctOptionId: 'a',
    difficulty: 'standard' as const,
    explanation: 'Because the sky scatters blue light.',
    options: [
      { id: 'a', label: 'Blue' },
      { id: 'b', label: 'Green' },
    ],
    prompt: 'What colour is a clear daytime sky?',
    topic: 'general',
  };

  it('keeps the AI answer key in the admin generation response for review', () => {
    const result = merchantQuizGenerationResponseSchema.safeParse({
      event: { id: 'evt_1', slug: 'q', status: 'draft', title: 'Quiz' },
      questions: [baseQuestion],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questions[0].correctOptionId).toBe('a');
      expect(result.data.questions[0].explanation).toContain('scatters');
    }
  });

  it('rejects a question missing its correct-answer key', () => {
    const { correctOptionId: _omitted, ...withoutKey } = baseQuestion;
    const result = merchantQuizGenerationResponseSchema.safeParse({
      event: { id: 'evt_1', slug: 'q', status: 'draft', title: 'Quiz' },
      questions: [withoutKey],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a generated draft with no questions', () => {
    const result = merchantQuizGenerationResponseSchema.safeParse({
      event: { id: 'evt_1', slug: 'q', status: 'draft', title: 'Quiz' },
      questions: [],
    });

    expect(result.success).toBe(false);
  });
});
