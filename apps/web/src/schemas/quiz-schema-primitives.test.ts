import { describe, expect, it } from 'vitest';
import {
  quizIntegrityTierSchema,
  quizTopicSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

describe('quiz primitive schemas', () => {
  it('validates identifiers, integrity tiers, and bounded topics', () => {
    expect(
      quizUuidSchema.safeParse('55555555-5555-4555-8555-555555555555').success
    ).toBe(true);
    expect(quizIntegrityTierSchema.safeParse('strong').success).toBe(true);
    expect(quizTopicSchema.safeParse('').success).toBe(false);
  });
});
