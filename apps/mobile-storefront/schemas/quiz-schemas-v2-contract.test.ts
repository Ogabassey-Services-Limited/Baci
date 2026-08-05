import { describe, expect, it } from '@jest/globals';
import {
  quizEventSchema,
  quizEventsResponseSchema,
  quizV2EventSchema,
  quizV2ResultResponseSchema,
} from './quiz-schemas';
import { validV2QuizEvent } from './quiz-schemas.test-support';

describe('quiz v2 client contracts', () => {
  it('parses v2 event metadata without applying legacy defaults', () => {
    expect(quizV2EventSchema.parse(validV2QuizEvent)).toEqual(validV2QuizEvent);
    expect(quizEventSchema.parse(validV2QuizEvent)).toEqual(validV2QuizEvent);
    expect(
      quizV2EventSchema.safeParse({
        ...validV2QuizEvent,
        rulesVersion: '',
      }).success
    ).toBe(false);
    expect(
      quizEventSchema.safeParse({
        ...validV2QuizEvent,
        prizeProduct: {
          ...validV2QuizEvent.prizeProduct,
          answerKey: 'private',
        },
      }).success
    ).toBe(false);
    expect(
      quizEventSchema.safeParse({
        ...validV2QuizEvent,
        complianceVerified: true,
      }).success
    ).toBe(false);
    expect(
      quizEventSchema.safeParse({
        ...validV2QuizEvent,
        contractVersion: undefined,
      }).success
    ).toBe(false);
  });

  it('keeps pending v2 results free of score and rank fields', () => {
    expect(
      quizV2ResultResponseSchema.parse({
        attemptId: 'attempt-v2',
        availability: 'pending',
        availableAt: null,
      })
    ).not.toHaveProperty('score');
    expect(
      quizV2ResultResponseSchema.safeParse({
        attemptId: 'attempt-v2',
        availability: 'final',
        availableAt: '2026-05-20T10:05:00.000Z',
        score: 3,
        totalQuestions: 3,
      }).success
    ).toBe(false);
    expect(
      quizV2ResultResponseSchema.safeParse({
        attemptId: 'attempt-v2',
        availability: 'pending',
        availableAt: null,
        rank: 1,
      }).success
    ).toBe(false);
  });

  it('validates the complete v2 paging contract whenever paging is present', () => {
    const response = {
      contractVersion: 2,
      entryMode: 'free-v1',
      events: [validV2QuizEvent],
      pagination: {
        hasMore: true,
        limit: 50,
        nextOffset: 50,
        offset: 0,
      },
      serverNow: '2026-08-04T12:00:00.000Z',
    };

    expect(quizEventsResponseSchema.safeParse(response).success).toBe(true);
    expect(
      quizEventsResponseSchema.safeParse({
        ...response,
        pagination: { hasMore: true, nextOffset: 50 },
      }).success
    ).toBe(false);
  });
});
