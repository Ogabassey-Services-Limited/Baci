import { describe, expect, it } from 'vitest';
import { onboardingCountrySchema } from './onboarding-country';

describe('onboardingCountrySchema', () => {
  it('accepts an ISO-2 code and passes it through unchanged', () => {
    const result = onboardingCountrySchema.safeParse('NG');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('NG');
    }
  });

  it('normalizes a lowercase, padded code', () => {
    const result = onboardingCountrySchema.safeParse(' ng ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('NG');
    }
  });

  it('normalizes a full country name to its ISO-2 code', () => {
    const result = onboardingCountrySchema.safeParse('Nigeria');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('NG');
    }
  });

  it('normalizes a common alias (USA) to its ISO-2 code', () => {
    const result = onboardingCountrySchema.safeParse('USA');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('US');
    }
  });

  it('rejects missing (undefined) country with a required message', () => {
    const result = onboardingCountrySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = onboardingCountrySchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please select a supported country.'
      );
    }
  });

  it('rejects unrecognizable input with an unsupported-country message', () => {
    const result = onboardingCountrySchema.safeParse('Atlantis');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please select a supported country.'
      );
    }
  });

  it('never returns null on success (type-narrowing refine holds at runtime)', () => {
    const result = onboardingCountrySchema.safeParse('NG');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
    }
  });
});
