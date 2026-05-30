import { describe, expect, it } from 'vitest';
import {
  agenticActionCheckoutSessionsSchema,
  agenticActionHealthPayloadSchema,
  agenticActionIdempotencySchema,
  agenticActionRequestRecordSchema,
  agenticActionSchema,
} from '@/schemas/agentic-action-health';

const validAction = {
  code: 'AGENTIC_PAYMENT_PENDING',
  count: 1,
  message: 'Agentic checkouts are waiting for payment confirmation.',
  next_step:
    'Confirm payment provider webhook status if pending payments do not settle.',
  next_step_url: '/dashboard/orders?source=agentic',
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
      agenticActionSchema.safeParse({ ...validAction, next_step: '' }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, next_step: '   ' })
        .success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, next_step: null }).success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, next_step_url: '   ' })
        .success
    ).toBe(false);
    expect(
      agenticActionSchema.safeParse({ ...validAction, next_step_url: null })
        .success
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
  it('accepts valid action payloads with optional generated_at and session counts', () => {
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
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        checkout_sessions: {
          claiming_payment_count: 1,
          order_finalizing_count: 2,
          payment_pending_count: 3,
          payment_setup_failed_count: 4,
          recent_count: 5,
          records: [],
          stale_payment_pending_count: 1,
        },
      }).success
    ).toBe(true);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        idempotency: {
          active_in_progress_count: 1,
          in_progress_count: 1,
          recent_count: 2,
          records: [
            {
              created_at: '2026-05-15T03:00:00.000Z',
              expires_at: '2026-05-15T03:10:00.000Z',
              route: 'checkout_sessions.complete',
              state: 'server_error',
              status_code: 502,
              updated_at: '2026-05-15T03:01:00.000Z',
            },
          ],
          stale_in_progress_count: 0,
          terminal_error_count: 1,
        },
      }).success
    ).toBe(true);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        request_controls: {
          allowlist_count: 2,
          denylist_count: 1,
          fetch_error: false,
          is_agentic_checkout_enabled: true,
        },
        requests: {
          recent_count: 1,
          records: [
            {
              api_version: '2026-04-30',
              created_at: '2026-05-15T03:00:00.000Z',
              expires_at: '2026-05-15T03:10:00.000Z',
              route: 'orders.read',
              status_code: 503,
            },
          ],
        },
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
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        request_controls: {
          allowlist_count: -1,
          denylist_count: 0,
          fetch_error: false,
          is_agentic_checkout_enabled: true,
        },
      }).success
    ).toBe(false);
    expect(
      agenticActionHealthPayloadSchema.safeParse({
        actions: [validAction],
        requests: {
          recent_count: 1,
          records: [
            {
              api_version: '2026-04-30',
              created_at: 'not-a-date',
              expires_at: '2026-05-15T03:10:00.000Z',
              route: 'checkout_sessions.create',
            },
          ],
        },
      }).success
    ).toBe(false);
  });
});

describe('agenticActionCheckoutSessionsSchema', () => {
  it('rejects invalid checkout session count fields', () => {
    expect(
      agenticActionCheckoutSessionsSchema.safeParse({
        claiming_payment_count: -1,
      }).success
    ).toBe(false);
    expect(
      agenticActionCheckoutSessionsSchema.safeParse({
        payment_setup_failed_count: 1.5,
      }).success
    ).toBe(false);
    expect(
      agenticActionCheckoutSessionsSchema.safeParse({
        payment_pending_count: Number.POSITIVE_INFINITY,
      }).success
    ).toBe(false);
    expect(
      agenticActionCheckoutSessionsSchema.safeParse({
        order_finalizing_count: '1',
      }).success
    ).toBe(false);
    expect(
      agenticActionCheckoutSessionsSchema.safeParse({
        stale_payment_pending_count: -1,
      }).success
    ).toBe(false);
  });
});

describe('agenticActionIdempotencySchema', () => {
  it('accepts well-formed idempotency counters and records', () => {
    expect(
      agenticActionIdempotencySchema.safeParse({
        active_in_progress_count: 1,
        in_progress_count: 2,
        recent_count: 3,
        records: [
          {
            created_at: '2026-05-15T03:00:00.000Z',
            expires_at: '2026-05-15T03:10:00.000Z',
            route: 'checkout_sessions.complete',
            state: 'completed',
            status_code: 200,
            updated_at: '2026-05-15T03:01:00.000Z',
          },
        ],
        stale_in_progress_count: 0,
        terminal_error_count: 0,
      }).success
    ).toBe(true);
  });

  it('rejects malformed idempotency records and counters', () => {
    expect(
      agenticActionIdempotencySchema.safeParse({
        active_in_progress_count: -1,
      }).success
    ).toBe(false);
    expect(
      agenticActionIdempotencySchema.safeParse({
        terminal_error_count: 1.5,
      }).success
    ).toBe(false);
    expect(
      agenticActionIdempotencySchema.safeParse({
        records: [
          {
            created_at: '2026-05-15T03:00:00.000Z',
            expires_at: '2026-05-15T03:10:00.000Z',
            route: 'checkout_sessions.complete',
            state: 'unknown',
            status_code: 502,
            updated_at: '2026-05-15T03:01:00.000Z',
          },
        ],
      }).success
    ).toBe(false);
    expect(
      agenticActionIdempotencySchema.safeParse({
        records: [
          {
            created_at: '2026-05-15T03:00:00.000Z',
            expires_at: '2026-05-15T03:10:00.000Z',
            route: '   ',
            state: 'in_progress',
            status_code: null,
            updated_at: '2026-05-15T03:01:00.000Z',
          },
        ],
      }).success
    ).toBe(false);
  });
});

describe('agenticActionRequestRecordSchema', () => {
  it('validates recorded request outcome status codes', () => {
    const validRecord = {
      api_version: '2026-04-30',
      created_at: '2026-05-15T03:00:00.000Z',
      expires_at: '2026-05-15T03:10:00.000Z',
      route: 'orders.read',
      status_code: 503,
    };

    expect(
      agenticActionRequestRecordSchema.safeParse(validRecord).success
    ).toBe(true);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: null,
      }).success
    ).toBe(true);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: undefined,
      }).success
    ).toBe(true);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: 503.5,
      }).success
    ).toBe(false);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: 99,
      }).success
    ).toBe(false);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: 600,
      }).success
    ).toBe(false);
    expect(
      agenticActionRequestRecordSchema.safeParse({
        ...validRecord,
        status_code: 'server-error',
      }).success
    ).toBe(false);
  });
});
