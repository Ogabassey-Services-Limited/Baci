import { describe, expect, it } from 'vitest';
import {
  agenticActionHealthPayloadSchema,
  agenticActionSchema,
} from '@/schemas/agentic-action-health';

const validAction = {
  code: 'AGENTIC_PAYMENT_PENDING',
  count: 1,
  message: 'Agentic checkouts are waiting for payment confirmation.',
  severity: 'monitor',
};

describe('agenticActionSchema', () => {
  it('accepts only finite, well-formed action objects', () => {
    expect(agenticActionSchema.safeParse(validAction).success).toBe(true);

    expect(agenticActionSchema.safeParse(null).success).toBe(false);
    expect(agenticActionSchema.safeParse('action').success).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, code: 12 }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, count: Number.NaN })
        .success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({
        ...validAction,
        count: Number.POSITIVE_INFINITY,
      }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, count: -1 }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, count: 1.5 }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, message: null }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({
        ...validAction,
        severity: 'critical',
      }).success
    ).toBe(false);
  });
});

describe('agenticActionHealthPayloadSchema', () => {
  it('accepts valid action payloads with optional generated_at', () => {
    expect(
      agenticActionHealthPayloadSchema.safeParse({ actions: [validAction] })
        .success
    ).toBe(true);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        generated_at: '2026-05-15T03:00:00.000Z',
      }).success
    ).toBe(true);
  });

  it('rejects malformed action payloads', () => {
    expect(agenticActionHealthPayloadSchema.safeParse(null).success).toBe(
      false
    );
    expect(agenticActionHealthPayloadSchema.safeParse({}).success).toBe(false);
    expect(
      agenticActionHealthPayloadSchema.safeParse({ actions: validAction })
        .success
    ).toBe(false);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [{ ...validAction, severity: 'critical' }],
      }).success
    ).toBe(false);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        generated_at: 123,
      }).success
    ).toBe(false);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        generated_at: 'not-a-valid-date',
      }).success
    ).toBe(false);
  });
});
