import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { firstValidationMessage } from './first-validation-message';

describe('firstValidationMessage', () => {
  it('surfaces the first actionable rule', () => {
    const result = z
      .string()
      .refine(() => false, 'Reserved slug')
      .safeParse('x');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstValidationMessage(result.error)).toBe('Reserved slug');
    }
  });

  it('falls back when the error has no issues', () => {
    expect(
      firstValidationMessage({ issues: [] } as unknown as z.ZodError)
    ).toBe('Invalid input');
  });
});
