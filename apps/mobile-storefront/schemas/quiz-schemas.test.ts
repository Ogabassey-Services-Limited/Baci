import { describe, expect, it } from '@jest/globals';
import type { ZodSafeParseResult } from 'zod';
import {
  quizAttemptSchema,
  quizEventSchema,
  quizEventsResponseSchema,
  quizOptionSchema,
  quizQuestionSchema,
  quizResultSchema,
} from './quiz-schemas';

const validOption = {
  id: 'option-1',
  label: 'Lagos',
};

const validQuestion = {
  id: 'question-1',
  prompt: 'Which city is the capital of Lagos State?',
  options: [validOption],
  timeLimitSeconds: 30,
  index: 1,
  total: 3,
};

const validEvent = {
  id: 'event-1',
  title: 'Daily Prize Quiz',
  prizeName: 'N50,000 store credit',
  startsAt: '2026-05-20T10:00:00.000Z',
  endsAt: '2026-05-20T10:10:00.000Z',
  status: 'open',
  questionCount: 3,
};

const validAttempt = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  remainingLoyaltyPoints: 4,
  question: validQuestion,
};

const completedResult = {
  attemptId: 'attempt-1',
  status: 'completed',
  correctAnswers: 2,
  totalQuestions: 3,
  prizeEligible: true,
};

function expectInvalidIssue(
  parseResult: ZodSafeParseResult<unknown>,
  path: Array<string | number>
) {
  expect(parseResult.success).toBe(false);
  if (!parseResult.success) {
    expect(parseResult.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })])
    );
  }
}

describe('quiz response schemas', () => {
  it('parses valid fixtures for every exported quiz schema', () => {
    expect(quizOptionSchema.parse(validOption)).toEqual(validOption);
    expect(quizQuestionSchema.parse(validQuestion)).toEqual(validQuestion);
    expect(quizEventSchema.parse(validEvent)).toEqual(validEvent);
    expect(quizEventsResponseSchema.parse({ events: [validEvent] })).toEqual({
      events: [validEvent],
    });
    expect(quizAttemptSchema.parse(validAttempt)).toEqual(validAttempt);
    expect(quizResultSchema.parse(completedResult)).toEqual(completedResult);
  });

  it('rejects empty string identity and display fields', () => {
    const invalidFields = [
      [quizOptionSchema.safeParse({ ...validOption, id: '' }), ['id']],
      [quizOptionSchema.safeParse({ ...validOption, label: '' }), ['label']],
      [quizQuestionSchema.safeParse({ ...validQuestion, id: '' }), ['id']],
      [
        quizQuestionSchema.safeParse({ ...validQuestion, prompt: '' }),
        ['prompt'],
      ],
      [quizEventSchema.safeParse({ ...validEvent, id: '' }), ['id']],
      [quizEventSchema.safeParse({ ...validEvent, title: '' }), ['title']],
      [
        quizEventSchema.safeParse({ ...validEvent, prizeName: '' }),
        ['prizeName'],
      ],
      [
        quizAttemptSchema.safeParse({ ...validAttempt, attemptId: '' }),
        ['attemptId'],
      ],
      [
        quizAttemptSchema.safeParse({ ...validAttempt, eventId: '' }),
        ['eventId'],
      ],
      [
        quizResultSchema.safeParse({ ...completedResult, attemptId: '' }),
        ['attemptId'],
      ],
    ] as const;

    for (const [result, path] of invalidFields) {
      expectInvalidIssue(result, [...path]);
    }
  });

  it('enforces question array and numeric boundaries', () => {
    const invalidFields = [
      [
        quizQuestionSchema.safeParse({ ...validQuestion, options: [] }),
        ['options'],
      ],
      [
        quizQuestionSchema.safeParse({ ...validQuestion, timeLimitSeconds: 0 }),
        ['timeLimitSeconds'],
      ],
      [quizQuestionSchema.safeParse({ ...validQuestion, index: 0 }), ['index']],
      [quizQuestionSchema.safeParse({ ...validQuestion, total: 0 }), ['total']],
      [
        quizEventSchema.safeParse({ ...validEvent, questionCount: 0 }),
        ['questionCount'],
      ],
      [
        quizResultSchema.safeParse({ ...completedResult, correctAnswers: -1 }),
        ['correctAnswers'],
      ],
      [
        quizResultSchema.safeParse({ ...completedResult, totalQuestions: 0 }),
        ['totalQuestions'],
      ],
      [
        quizResultSchema.safeParse({
          ...completedResult,
          correctAnswers: 4,
          totalQuestions: 3,
        }),
        ['correctAnswers'],
      ],
      [
        quizAttemptSchema.safeParse({
          ...validAttempt,
          examPassPointsSpent: 2,
        }),
        ['examPassPointsSpent'],
      ],
      [
        quizAttemptSchema.safeParse({
          ...validAttempt,
          remainingLoyaltyPoints: -1,
        }),
        ['remainingLoyaltyPoints'],
      ],
    ] as const;

    for (const [result, path] of invalidFields) {
      expectInvalidIssue(result, [...path]);
    }
  });

  it('accepts zero remaining loyalty points after spending the exam pass', () => {
    expect(
      quizAttemptSchema.safeParse({
        ...validAttempt,
        remainingLoyaltyPoints: 0,
      }).success
    ).toBe(true);
  });

  it('accepts only supported event and result statuses', () => {
    expect(
      quizEventSchema.safeParse({ ...validEvent, status: 'scheduled' }).success
    ).toBe(true);
    expect(
      quizEventSchema.safeParse({ ...validEvent, status: 'closed' }).success
    ).toBe(true);
    expectInvalidIssue(
      quizEventSchema.safeParse({ ...validEvent, status: 'paused' }),
      ['status']
    );

    expect(
      quizResultSchema.safeParse({
        ...completedResult,
        status: 'in_progress',
        question: validQuestion,
      }).success
    ).toBe(true);
    expectInvalidIssue(
      quizResultSchema.safeParse({ ...completedResult, status: 'failed' }),
      ['status']
    );
  });

  it('requires ISO 8601 datetimes for event windows', () => {
    expect(
      quizEventSchema.safeParse({
        ...validEvent,
        endsAt: null,
        startsAt: null,
      }).success
    ).toBe(true);
    expectInvalidIssue(
      quizEventSchema.safeParse({ ...validEvent, startsAt: 'tomorrow' }),
      ['startsAt']
    );
    expectInvalidIssue(
      quizEventSchema.safeParse({ ...validEvent, endsAt: '2026-05-20' }),
      ['endsAt']
    );
  });

  it('accepts Supabase timestamptz values with numeric offsets', () => {
    expect(
      quizEventSchema.safeParse({
        ...validEvent,
        startsAt: '2026-05-20T10:00:00.123456+00:00',
        endsAt: '2026-05-20T10:10:00+01:00',
      }).success
    ).toBe(true);
  });

  it('rejects datetime strings without a timezone offset', () => {
    expectInvalidIssue(
      quizEventSchema.safeParse({
        ...validEvent,
        startsAt: '2026-05-20T10:00:00',
      }),
      ['startsAt']
    );
    expectInvalidIssue(
      quizEventSchema.safeParse({
        ...validEvent,
        endsAt: '2026-05-20T10:10:00.123',
      }),
      ['endsAt']
    );
  });

  it('allows completed results without a next question', () => {
    expect(quizResultSchema.safeParse(completedResult).success).toBe(true);
  });

  it('requires a next question for in-progress results', () => {
    expectInvalidIssue(
      quizResultSchema.safeParse({
        ...completedResult,
        status: 'in_progress',
      }),
      ['question']
    );
    expect(
      quizResultSchema.safeParse({
        ...completedResult,
        status: 'in_progress',
        question: validQuestion,
      }).success
    ).toBe(true);
  });
});
