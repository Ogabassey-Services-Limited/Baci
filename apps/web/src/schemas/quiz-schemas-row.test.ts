import { describe, expect, it } from 'vitest';
import { quizEventRowSchema } from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';

describe('quiz database row schemas', () => {
  it('validates quiz event database rows at runtime', () => {
    expect(
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        quiz_question_slots: [
          {
            active: true,
            id: QUESTION_ID,
            quiz_question_variants: [
              {
                active: true,
                id: '44444444-4444-4444-4444-444444444444',
              },
            ],
          },
        ],
        settings: { prize_name: 'Store credit', time_limit_seconds: '30' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toEqual({
      ends_at: null,
      id: EVENT_ID,
      quiz_question_slots: [
        {
          active: true,
          id: QUESTION_ID,
          quiz_question_variants: [
            {
              active: true,
              id: '44444444-4444-4444-4444-444444444444',
            },
          ],
        },
      ],
      settings: { prize_name: 'Store credit', time_limit_seconds: 30 },
      starts_at: '2026-05-16T10:00:00.000Z',
      status: 'active',
      title: 'Daily quiz',
    });

    expect(
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        settings: { prize_name: 'Store credit', unexpected: true },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toMatchObject({
      settings: { prize_name: 'Store credit' },
    });
    expect(() =>
      quizEventRowSchema.parse({
        id: EVENT_ID,
        settings: null,
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: '2026-05-16 11:00:00',
        id: EVENT_ID,
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16 10:00:00',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: null,
        id: 'not-a-uuid',
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        quiz_question_slots: [
          {
            active: true,
            id: 'not-a-uuid',
            quiz_question_variants: [
              {
                active: true,
                id: '44444444-4444-4444-4444-444444444444',
              },
            ],
          },
        ],
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
  });
});
