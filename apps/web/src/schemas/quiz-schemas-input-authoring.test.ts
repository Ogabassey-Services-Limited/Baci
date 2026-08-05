import { describe, expect, it } from 'vitest';
import {
  merchantQuizActivationRequestSchema,
  merchantQuizActivationV2RequestSchema,
  merchantQuizGenerationRequestSchema,
} from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const VARIANT_ID = '66666666-6666-4666-8666-666666666666';

describe('quiz authoring input schemas', () => {
  it('validates merchant quiz generation payloads', () => {
    const basePayload = {
      prizeCondition: 'new',
      prizeEffectiveStock: 2,
      prizeImageUrl: 'https://cdn.example.com/iphone.png',
      prizeProductId: PRODUCT_ID,
      questionCountPerTopic: 1,
      timeLimitSeconds: 30,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice'],
    };
    const parsePayload = (overrides: Record<string, unknown>) =>
      merchantQuizGenerationRequestSchema.parse({
        ...basePayload,
        ...overrides,
      });

    expect(
      merchantQuizGenerationRequestSchema.parse({
        difficulty: 'hard',
        prizeCondition: 'new',
        prizeEffectiveStock: 2,
        prizeImageUrl: 'https://cdn.example.com/iphone.png',
        prizeProductId: PRODUCT_ID,
        prizeVariantId: VARIANT_ID,
        questionCountPerTopic: '2',
        timeLimitSeconds: '45',
        title: 'Daily Phone Quiz',
        topics: [' iPhone buying advice ', 'Android trade-in'],
      })
    ).toEqual({
      difficulty: 'hard',
      maxAttempts: 10,
      mode: 'test',
      prizeCondition: 'new',
      prizeEffectiveStock: 2,
      prizeImageUrl: 'https://cdn.example.com/iphone.png',
      prizeProductId: PRODUCT_ID,
      prizeVariantId: VARIANT_ID,
      questionCountPerTopic: 2,
      timeLimitSeconds: 45,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice', 'Android trade-in'],
      variantsPerQuestion: 1,
    });

    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        prizeProductId: PRODUCT_ID,
        title: 'No',
        topics: ['iPhone buying advice'],
      })
    ).toThrow();
    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        prizeProductId: PRODUCT_ID,
        title: 'Daily Phone Quiz',
        topics: [],
      })
    ).toThrow();
    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        difficulty: 'expert',
        prizeProductId: PRODUCT_ID,
        title: 'Daily Phone Quiz',
        topics: ['iPhone buying advice'],
      })
    ).toThrow();

    expect(parsePayload({ title: 'T'.repeat(120) }).title).toBe(
      'T'.repeat(120)
    );
    expect(() => parsePayload({ title: 'T'.repeat(121) })).toThrow();
    expect(parsePayload({ topics: [' abc '] }).topics).toEqual(['abc']);
    expect(parsePayload({ topics: ['a'.repeat(80)] }).topics).toEqual([
      'a'.repeat(80),
    ]);
    expect(() => parsePayload({ topics: ['ab'] })).toThrow();
    expect(() => parsePayload({ topics: ['a'.repeat(81)] })).toThrow();
    expect(
      parsePayload({
        topics: Array.from({ length: 10 }, (_, index) => `topic ${index}`),
      }).topics
    ).toHaveLength(10);
    expect(() =>
      parsePayload({
        topics: Array.from({ length: 11 }, (_, index) => `topic ${index}`),
      })
    ).toThrow();

    expect(
      parsePayload({ questionCountPerTopic: 1 }).questionCountPerTopic
    ).toBe(1);
    expect(
      parsePayload({ questionCountPerTopic: 20 }).questionCountPerTopic
    ).toBe(20);
    expect(() => parsePayload({ questionCountPerTopic: 0 })).toThrow();
    expect(() => parsePayload({ questionCountPerTopic: 21 })).toThrow();
    expect(parsePayload({ timeLimitSeconds: 5 }).timeLimitSeconds).toBe(5);
    expect(parsePayload({ timeLimitSeconds: 60 }).timeLimitSeconds).toBe(60);
    expect(() => parsePayload({ timeLimitSeconds: 4 })).toThrow();
    expect(() => parsePayload({ timeLimitSeconds: 61 })).toThrow();
    expect(parsePayload({ prizeProductId: PRODUCT_ID }).prizeProductId).toBe(
      PRODUCT_ID
    );
    expect(parsePayload({ prizeVariantId: VARIANT_ID }).prizeVariantId).toBe(
      VARIANT_ID
    );
    expect(() =>
      parsePayload({ prizeProductId: 'not-a-product-id' })
    ).toThrow();
    expect(() =>
      parsePayload({ prizeVariantId: 'not-a-variant-id' })
    ).toThrow();
    expect(parsePayload({ publicationMode: 'draft' }).publicationMode).toBe(
      'draft'
    );
    expect(() => parsePayload({ publicationMode: 'live' })).toThrow();
    expect(() => parsePayload({ unexpected: true })).toThrow();
    expect(() => parsePayload({ topics: ['Phones', 'phones'] })).toThrow();
    expect(() =>
      parsePayload({
        questionCountPerTopic: 20,
        topics: ['Phones', 'Laptops', 'Tablets'],
      })
    ).toThrow();
    expect(
      parsePayload({
        maxAttempts: 1,
        mode: 'live',
        variantsPerQuestion: 3,
      })
    ).toMatchObject({
      maxAttempts: 1,
      mode: 'live',
      variantsPerQuestion: 3,
    });
    expect(() => parsePayload({ maxAttempts: 2, mode: 'live' })).toThrow();
    expect(() =>
      parsePayload({ mode: 'live', variantsPerQuestion: 1 })
    ).toThrow();
  });

  it('requires an explicit confirmation flag to activate a draft quiz', () => {
    const activation = {
      answerKeyReview: { questions: [{ correctOptionId: 'a', position: 1 }] },
      confirmActivation: true as const,
      eventId: EVENT_ID,
    };

    expect(merchantQuizActivationRequestSchema.parse(activation)).toEqual(
      activation
    );
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        answerKeyReview: activation.answerKeyReview,
        eventId: EVENT_ID,
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        ...activation,
        confirmActivation: false,
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        confirmActivation: true,
        eventId: EVENT_ID,
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        ...activation,
        answerKeyReview: { questions: [] },
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationRequestSchema.safeParse({
        ...activation,
        eventId: 'not-a-uuid',
      }).success
    ).toBe(false);
  });

  it('requires strict v2 activation timing, rules, and mode policy', () => {
    const input = {
      answerKeyReview: { questions: [{ correctOptionId: 'a', position: 1 }] },
      confirmActivation: true as const,
      eventId: EVENT_ID,
      maxAttempts: 10,
      mode: 'test' as const,
      rulesVersion: 'test-v1',
      timePerQuestionSeconds: 10,
      timeZone: 'Africa/Lagos',
      timing: { kind: 'immediate' as const, liveWindowSeconds: 10 },
      variantsPerQuestion: 1,
    };

    expect(merchantQuizActivationV2RequestSchema.parse(input)).toEqual(input);
    expect(
      merchantQuizActivationV2RequestSchema.safeParse({
        ...input,
        maxAttempts: 2,
        mode: 'live',
        variantsPerQuestion: 3,
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationV2RequestSchema.safeParse({
        ...input,
        timing: {
          endsAt: '2026-08-04T12:00:00.000Z',
          kind: 'scheduled',
          startsAt: '2026-08-04T12:05:00.000Z',
        },
      }).success
    ).toBe(false);
    expect(
      merchantQuizActivationV2RequestSchema.safeParse({
        ...input,
        unexpected: true,
      }).success
    ).toBe(false);
  });
});
