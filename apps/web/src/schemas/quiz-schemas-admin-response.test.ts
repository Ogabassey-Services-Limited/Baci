import { describe, expect, it } from 'vitest';
import {
  merchantQuizActivationResponseSchema,
  merchantQuizGenerationResponseSchema,
} from '@/schemas/quiz';

describe('quiz admin response schemas', () => {
  it('keeps the AI answer key in the admin generation response', () => {
    const generationResponse = {
      event: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'draft',
        title: 'Daily Phone Quiz',
      },
      questions: [
        {
          correctOptionId: 'b',
          difficulty: 'standard',
          explanation: 'USB-C arrived on iPhone 15.',
          options: [
            { id: 'a', label: 'iPhone 13' },
            { id: 'b', label: 'iPhone 15' },
          ],
          prompt: 'Which iPhone introduced USB-C?',
          topic: 'iPhone buying advice',
        },
      ],
    };

    expect(
      merchantQuizGenerationResponseSchema.parse(generationResponse)
    ).toMatchObject({
      questions: [{ correctOptionId: 'b', explanation: expect.any(String) }],
    });

    expect(() =>
      merchantQuizGenerationResponseSchema.parse({
        ...generationResponse,
        questions: [
          {
            difficulty: 'standard',
            options: generationResponse.questions[0].options,
            prompt: 'Which iPhone introduced USB-C?',
            topic: 'iPhone buying advice',
          },
        ],
      })
    ).toThrow();
  });

  it('validates the activation response contract', () => {
    expect(
      merchantQuizActivationResponseSchema.parse({
        event: {
          id: 'event-1',
          slug: 'daily-phone-quiz',
          status: 'active',
          title: 'Daily Phone Quiz',
        },
      })
    ).toMatchObject({ event: { status: 'active' } });

    expect(() =>
      merchantQuizActivationResponseSchema.parse({ event: { id: 'event-1' } })
    ).toThrow();
  });
});
