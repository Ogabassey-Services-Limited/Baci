import { describe, expect, it, vi } from 'vitest';
import { getQuizIntegrityTierOverridesJson } from '@/env';
import {
  getQuizIntegrityTierOverride,
  normalizeQuizIntegrityTier,
  QUIZ_INTEGRITY_TIER_RANKS,
} from '@/lib/quiz-integrity-verify';

vi.mock('@/env', () => ({
  getQuizIntegrityTierOverridesJson: vi.fn(),
}));

describe('quiz integrity tier normalization', () => {
  it('normalizes known tiers and exposes explicit ranks', () => {
    expect(normalizeQuizIntegrityTier('basic')).toBe('basic');
    expect(normalizeQuizIntegrityTier('device')).toBe('device');
    expect(normalizeQuizIntegrityTier('strong')).toBe('strong');
    expect(normalizeQuizIntegrityTier(' BASIC ')).toBe('basic');
    expect(normalizeQuizIntegrityTier(' DeViCe ')).toBe('device');
    expect(QUIZ_INTEGRITY_TIER_RANKS).toEqual({
      basic: 1,
      device: 2,
      strong: 3,
    });
  });

  it('rejects unknown tiers', () => {
    expect(() => normalizeQuizIntegrityTier('rooted')).toThrow(
      'unknown_quiz_integrity_tier:"rooted"'
    );
    expect(() => normalizeQuizIntegrityTier(null)).toThrow(
      'unknown_quiz_integrity_tier:null'
    );
    expect(() => normalizeQuizIntegrityTier(undefined)).toThrow(
      'unknown_quiz_integrity_tier:undefined'
    );
    expect(() => normalizeQuizIntegrityTier('   ')).toThrow(
      'unknown_quiz_integrity_tier:"   "'
    );
    expect(() => normalizeQuizIntegrityTier(123)).toThrow(
      'unknown_quiz_integrity_tier:123'
    );
    expect(() => normalizeQuizIntegrityTier({})).toThrow(
      'unknown_quiz_integrity_tier:{}'
    );
  });

  it('coerces primitive tier values before normalization', () => {
    expect(normalizeQuizIntegrityTier(new String(' strong '))).toBe('strong');
  });

  it('parses optional override JSON and rejects invalid override tiers', () => {
    expect(getQuizIntegrityTierOverride('event-1', '')).toBeUndefined();
    expect(getQuizIntegrityTierOverride('event-1', '   ')).toBeUndefined();
    expect(
      getQuizIntegrityTierOverride('event-1', '{"event-1":"strong"}')
    ).toBe('strong');
    expect(
      getQuizIntegrityTierOverride('event-1', '{"event-1":" DEVICE "}')
    ).toBe('device');
    expect(
      getQuizIntegrityTierOverride('event-2', '{"event-1":"strong"}')
    ).toBeUndefined();

    expect(() =>
      getQuizIntegrityTierOverride('event-1', '{"event-1":"rooted"}')
    ).toThrow('unknown_quiz_integrity_tier:"rooted"');
    expect(() =>
      getQuizIntegrityTierOverride('event-1', '{"event-1":1}')
    ).toThrow('unknown_quiz_integrity_tier:1');
    expect(() =>
      getQuizIntegrityTierOverride('event-1', '{"event-1":true}')
    ).toThrow('unknown_quiz_integrity_tier:true');
    expect(() => getQuizIntegrityTierOverride('event-1', '{bad')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
    expect(() => getQuizIntegrityTierOverride('event-1', 'null')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
    expect(() => getQuizIntegrityTierOverride('event-1', '1')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
    expect(() => getQuizIntegrityTierOverride('event-1', 'true')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
    expect(getQuizIntegrityTierOverride('event-1', '{}')).toBeUndefined();
    expect(() => getQuizIntegrityTierOverride('event-1', '[]')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
    expect(() => getQuizIntegrityTierOverride('event-1', '"strong"')).toThrow(
      'invalid_quiz_integrity_tier_overrides_json'
    );
  });

  it('reads the current default override JSON when raw JSON is omitted', () => {
    vi.mocked(getQuizIntegrityTierOverridesJson).mockReturnValue({
      'event-default': 'strong',
    });

    expect(getQuizIntegrityTierOverride('event-default')).toBe('strong');
    expect(getQuizIntegrityTierOverridesJson).toHaveBeenCalled();
  });

  it('returns undefined when the current default override JSON is empty', () => {
    vi.mocked(getQuizIntegrityTierOverridesJson).mockReturnValue(undefined);

    expect(getQuizIntegrityTierOverride('event-default')).toBeUndefined();
    expect(getQuizIntegrityTierOverridesJson).toHaveBeenCalled();
  });
});
