import { describe, expect, it } from 'vitest';
import {
  getQuizRulesVersion,
  isQuizRulesVersionApprovedForLive,
  QUIZ_RULES_VERSION_REGISTRY,
} from './quiz-rules-version';

describe('quiz rules version registry', () => {
  it('makes the initial draft usable for test events only', () => {
    expect(getQuizRulesVersion('test-v1')).toMatchObject({
      approvedForLive: false,
      availableInTest: true,
      version: 'test-v1',
    });
    expect(isQuizRulesVersionApprovedForLive('test-v1')).toBe(false);
    expect(isQuizRulesVersionApprovedForLive('unknown-version')).toBe(false);
  });

  it('exposes immutable version metadata instead of treating presence as approval', () => {
    expect(Object.isFrozen(QUIZ_RULES_VERSION_REGISTRY)).toBe(true);
    expect(Object.isFrozen(QUIZ_RULES_VERSION_REGISTRY['test-v1'])).toBe(true);
    expect(QUIZ_RULES_VERSION_REGISTRY['test-v1'].approvedForLive).toBe(false);
  });

  it('registers live-v1 as the approved free-skill rules version', () => {
    expect(getQuizRulesVersion('live-v1')).toMatchObject({
      approvedForLive: true,
      availableInTest: false,
      version: 'live-v1',
    });
    expect(isQuizRulesVersionApprovedForLive('live-v1')).toBe(true);
    expect(Object.isFrozen(QUIZ_RULES_VERSION_REGISTRY['live-v1'])).toBe(true);
  });
});
