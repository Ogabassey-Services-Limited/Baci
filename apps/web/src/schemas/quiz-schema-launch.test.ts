import { describe, expect, it } from 'vitest';
import { merchantQuizActivationV2RequestSchema } from './quiz-schema-launch';

describe('merchantQuizActivationV2RequestSchema', () => {
  it('accepts a reviewed test launch and rejects an inverted schedule', () => {
    const input = {
      answerKeyReview: { questions: [{ correctOptionId: 'a', position: 1 }] },
      confirmActivation: true,
      eventId: '11111111-1111-4111-8111-111111111111',
      maxAttempts: 10,
      mode: 'test',
      rulesVersion: 'test-v1',
      timePerQuestionSeconds: 10,
      timeZone: 'Africa/Lagos',
      timing: { kind: 'immediate', liveWindowSeconds: 300 },
      variantsPerQuestion: 1,
    };
    expect(merchantQuizActivationV2RequestSchema.safeParse(input).success).toBe(
      true
    );
    expect(
      merchantQuizActivationV2RequestSchema.safeParse({
        ...input,
        timing: {
          endsAt: '2026-08-05T09:00:00.000Z',
          kind: 'scheduled',
          startsAt: '2026-08-05T09:05:00.000Z',
        },
      }).success
    ).toBe(false);
  });
});
