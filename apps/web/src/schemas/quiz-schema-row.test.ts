import { describe, expect, it } from 'vitest';
import {
  quizEventQuestionCountRowSchema,
  quizEventRowSchema,
} from './quiz-schema-row';

describe('quiz row schemas', () => {
  it('validates the safe event question-count projection', () => {
    expect(
      quizEventQuestionCountRowSchema.safeParse({
        event_id: '55555555-5555-4555-8555-555555555555',
        question_count: 20,
      }).success
    ).toBe(true);
  });

  it('retains first-class regulatory columns for production guard projections', () => {
    const result = quizEventRowSchema.safeParse({
      ends_at: null,
      id: '55555555-5555-4555-8555-555555555555',
      regulatory_basis: 'free_skill_competition',
      regulatory_evidence_ref: 'COUNSEL-2026-08-05',
      regulatory_jurisdiction: 'NG-LA',
      settings: {},
      starts_at: null,
      status: 'active',
      title: 'Free skill quiz',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.regulatory_basis).toBe('free_skill_competition');
    expect(result.data.regulatory_evidence_ref).toBe('COUNSEL-2026-08-05');
    expect(result.data.regulatory_jurisdiction).toBe('NG-LA');
  });
});
