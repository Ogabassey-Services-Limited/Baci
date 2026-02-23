import { describe, expect, it } from 'vitest';
import { ZodError, ZodIssueCode } from 'zod';
import { formatZodErrors, reorderSuggestionActionSchema } from './inventory';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

describe('reorderSuggestionActionSchema', () => {
  it('accepts valid "accept" action', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'accept',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid "reject" action', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'reject',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid "ordered" action with orderedQuantity', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'ordered',
      orderedQuantity: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects "ordered" action without orderedQuantity', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'ordered',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('orderedQuantity');
    }
  });

  it('rejects invalid UUID format for suggestionId', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: 'not-a-uuid',
      action: 'accept',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing suggestionId', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      action: 'accept',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action values', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects orderedQuantity of zero', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'ordered',
      orderedQuantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative orderedQuantity', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'ordered',
      orderedQuantity: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer orderedQuantity', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'ordered',
      orderedQuantity: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('does not mutate a valid UUID through sanitization', () => {
    const result = reorderSuggestionActionSchema.safeParse({
      suggestionId: VALID_UUID,
      action: 'accept',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestionId).toBe(VALID_UUID);
    }
  });
});

describe('formatZodErrors', () => {
  it('joins nested paths with dots', () => {
    const result = reorderSuggestionActionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      // suggestionId and action are both at root-level paths
      expect(errors).toHaveProperty('suggestionId');
      expect(errors).toHaveProperty('action');
      expect(Array.isArray(errors.suggestionId)).toBe(true);
      expect(errors.suggestionId.length).toBeGreaterThan(0);
    }
  });

  it('uses "_root" as fallback for empty path', () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.custom,
        message: 'Root level error',
        path: [],
      },
    ]);
    const errors = formatZodErrors(error);
    expect(errors).toHaveProperty('_root');
    expect(errors._root).toContain('Root level error');
  });

  it('aggregates multiple messages for the same path', () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.custom,
        message: 'First error',
        path: ['field'],
      },
      {
        code: ZodIssueCode.custom,
        message: 'Second error',
        path: ['field'],
      },
    ]);
    const errors = formatZodErrors(error);
    expect(errors.field).toHaveLength(2);
    expect(errors.field).toContain('First error');
    expect(errors.field).toContain('Second error');
  });
});
