import { describe, expect, it } from 'vitest';
import {
  deleteJumiaConnectionQuerySchema,
  integrationIdSchema,
} from './marketplace';

describe('integrationIdSchema', () => {
  it('accepts a valid UUID', () => {
    const result = integrationIdSchema.safeParse(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    expect(result.success).toBe(true);
  });

  it('accepts another valid UUID (v4)', () => {
    const result = integrationIdSchema.safeParse(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    const result = integrationIdSchema.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'integrationId must be a valid UUID'
      );
    }
  });

  it('rejects an empty string', () => {
    const result = integrationIdSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'integrationId must be a valid UUID'
      );
    }
  });

  it('rejects a number', () => {
    const result = integrationIdSchema.safeParse(12345);
    expect(result.success).toBe(false);
  });

  it('rejects undefined', () => {
    const result = integrationIdSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe('deleteJumiaConnectionQuerySchema', () => {
  it('accepts a non-empty integration id', () => {
    const result = deleteJumiaConnectionQuerySchema.safeParse({
      id: 'int-123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a blank integration id', () => {
    const result = deleteJumiaConnectionQuerySchema.safeParse({
      id: '   ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Integration ID required');
    }
  });
});
