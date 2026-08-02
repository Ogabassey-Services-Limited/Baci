import { describe, expect, it } from 'vitest';
import { auditEventQuerySchema } from './audit-event-query';

const MERCHANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CURSOR_ID = '7b82d5d9-1aa3-4f2d-a8d4-0b0d9f830001';
const CURSOR_OCCURRED_AT = '2026-07-29T12:34:56.789Z';
const CURSOR_OCCURRED_AT_WITH_UTC_OFFSET = '2026-07-29T12:34:56.789+00:00';

describe('auditEventQuerySchema', () => {
  it('requires a valid merchant id', () => {
    // Arrange
    const missingMerchant = {};
    const invalidMerchant = { merchantId: 'not-a-uuid' };

    // Act
    const missingResult = auditEventQuerySchema.safeParse(missingMerchant);
    const invalidResult = auditEventQuerySchema.safeParse(invalidMerchant);

    // Assert
    expect(missingResult.success).toBe(false);
    expect(invalidResult.success).toBe(false);
  });

  it('defaults the public page size to fifty and accepts its inclusive bounds', () => {
    // Arrange
    const baseQuery = { merchantId: MERCHANT_ID };

    // Act
    const defaulted = auditEventQuerySchema.parse(baseQuery);
    const minimum = auditEventQuerySchema.parse({ ...baseQuery, limit: '1' });
    const maximum = auditEventQuerySchema.parse({ ...baseQuery, limit: '100' });

    // Assert
    expect(defaulted.limit).toBe(50);
    expect(minimum.limit).toBe(1);
    expect(maximum.limit).toBe(100);
  });

  it('rejects page sizes outside the public range', () => {
    // Arrange
    const baseQuery = { merchantId: MERCHANT_ID };

    // Act
    const zero = auditEventQuerySchema.safeParse({ ...baseQuery, limit: '0' });
    const overMaximum = auditEventQuerySchema.safeParse({
      ...baseQuery,
      limit: '101',
    });
    const fractional = auditEventQuerySchema.safeParse({
      ...baseQuery,
      limit: '1.5',
    });

    // Assert
    expect(zero.success).toBe(false);
    expect(overMaximum.success).toBe(false);
    expect(fractional.success).toBe(false);
  });

  it('requires the cursor timestamp and UUID together', () => {
    // Arrange
    const baseQuery = { merchantId: MERCHANT_ID };

    // Act
    const timestampOnly = auditEventQuerySchema.safeParse({
      ...baseQuery,
      cursorOccurredAt: CURSOR_OCCURRED_AT,
    });
    const idOnly = auditEventQuerySchema.safeParse({
      ...baseQuery,
      cursorId: CURSOR_ID,
    });
    const malformedTimestamp = auditEventQuerySchema.safeParse({
      ...baseQuery,
      cursorOccurredAt: 'not-a-timestamp',
      cursorId: CURSOR_ID,
    });
    const malformedId = auditEventQuerySchema.safeParse({
      ...baseQuery,
      cursorOccurredAt: CURSOR_OCCURRED_AT,
      cursorId: 'not-a-uuid',
    });
    const cursorWithUtcOffset = auditEventQuerySchema.safeParse({
      ...baseQuery,
      cursorOccurredAt: CURSOR_OCCURRED_AT_WITH_UTC_OFFSET,
      cursorId: CURSOR_ID,
    });

    // Assert
    expect(timestampOnly.success).toBe(false);
    expect(idOnly.success).toBe(false);
    expect(malformedTimestamp.success).toBe(false);
    expect(malformedId.success).toBe(false);
    expect(cursorWithUtcOffset).toMatchObject({
      success: true,
      data: {
        ...baseQuery,
        cursorOccurredAt: CURSOR_OCCURRED_AT_WITH_UTC_OFFSET,
        cursorId: CURSOR_ID,
        limit: 50,
      },
    });
  });

  it('normalizes empty optional fields and accepts valid combined filters', () => {
    // Arrange
    const query = {
      merchantId: MERCHANT_ID,
      resourceType: 'merchant_feature_settings',
      action: 'merchant.feature.update',
      cursorOccurredAt: CURSOR_OCCURRED_AT,
      cursorId: CURSOR_ID,
    };

    // Act
    const combined = auditEventQuerySchema.parse(query);
    const emptyOptionals = auditEventQuerySchema.parse({
      merchantId: MERCHANT_ID,
      action: ' ',
      cursorId: '',
      cursorOccurredAt: '',
      resourceType: '',
    });

    // Assert
    expect(combined).toEqual({ ...query, limit: 50 });
    expect(emptyOptionals).toEqual({ merchantId: MERCHANT_ID, limit: 50 });
  });

  it('rejects unbounded, wildcard, and unknown filters', () => {
    // Arrange
    const baseQuery = { merchantId: MERCHANT_ID };

    // Act
    const resourceTooLong = auditEventQuerySchema.safeParse({
      ...baseQuery,
      resourceType: 'r'.repeat(81),
    });
    const actionTooLong = auditEventQuerySchema.safeParse({
      ...baseQuery,
      action: 'a'.repeat(101),
    });
    const wildcard = auditEventQuerySchema.safeParse({
      ...baseQuery,
      action: 'merchant.%',
    });
    const unknown = auditEventQuerySchema.safeParse({
      ...baseQuery,
      unknown: 'value',
    });

    // Assert
    expect(resourceTooLong.success).toBe(false);
    expect(actionTooLong.success).toBe(false);
    expect(wildcard.success).toBe(false);
    expect(unknown.success).toBe(false);
  });
});
