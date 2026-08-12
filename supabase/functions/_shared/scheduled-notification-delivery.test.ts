import { describe, expect, it, vi } from 'vitest';
import {
  isWithinQuietHours,
  parseExpoTicketResults,
  processScheduledNotificationClaims,
} from './scheduled-notification-delivery.ts';

describe('parseExpoTicketResults', () => {
  it('preserves each mixed Expo ticket result for its corresponding token', () => {
    const result = parseExpoTicketResults(
      {
        data: [
          { id: 'ticket-accepted', status: 'ok' },
          { details: { error: 'DeviceNotRegistered' }, status: 'error' },
        ],
      },
      2
    );

    expect(result).toEqual({
      errorCodes: ['', 'DeviceNotRegistered'],
      statuses: ['accepted', 'rejected'],
      ticketIds: ['ticket-accepted', ''],
    });
  });

  it('marks malformed or incomplete provider responses as unresolved', () => {
    expect(parseExpoTicketResults({ data: [{ status: 'ok' }] }, 2)).toBeNull();
    expect(
      parseExpoTicketResults({ data: [{ status: 'pending' }] }, 1)
    ).toBeNull();
    expect(
      parseExpoTicketResults({ data: [{ status: 'error' }] }, 1)
    ).toBeNull();
  });
});

describe('isWithinQuietHours', () => {
  it('handles overnight windows in the merchant timezone', () => {
    const atNight = new Date('2026-08-11T22:30:00.000Z');
    expect(isWithinQuietHours(atNight, '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours(atNight, '07:00', '22:00')).toBe(false);
  });

  it('uses the recipient timezone rather than the worker timezone', () => {
    const instant = new Date('2026-08-11T06:30:00.000Z');

    expect(
      isWithinQuietHours(instant, '22:00', '07:00', 'America/New_York')
    ).toBe(true);
    expect(isWithinQuietHours(instant, '22:00', '07:00', 'Africa/Lagos')).toBe(
      false
    );
  });
});

describe('processScheduledNotificationClaims', () => {
  it('defers a quiet-hour push without marking the broadcast sent or consuming a retry', async () => {
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
    const claim = {
      action_url: null,
      channels: ['push'],
      delivery_claim_token: '123e4567-e89b-42d3-a456-426614174008',
      expires_at: null,
      id: 'd8543bf1-5f03-4fd1-8a2a-2f7f1658c3f8',
      message: 'Quiet notification',
      target_merchant_ids: [],
      target_segment: null,
      target_type: 'all',
      title: 'Quiet',
    };
    const calls: Array<{ args?: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc: async (name: string, args?: Record<string, unknown>) => {
        calls.push({ args, name });
        if (name === 'get_scheduled_notification_recipient_page_v1') {
          return {
            data: [{ merchant_id: '456e4567-e89b-42d3-a456-426614174000' }],
            error: null,
          };
        }
        if (name === 'get_claimed_notification_push_tokens_v1') {
          return {
            data: [
              {
                push_token: 'ExponentPushToken[quiet-token]',
                quiet_hours_end: '23:59',
                quiet_hours_start: '00:00',
                quiet_hours_time_zone: 'Africa/Lagos',
              },
            ],
            error: null,
          };
        }
        return { data: true, error: null };
      },
    };

    const results = await processScheduledNotificationClaims(client, [claim]);

    expect(results).toEqual([{ id: claim.id, status: 'deferred' }]);
    expect(calls).toContainEqual({
      args: expect.objectContaining({ p_outcome: 'deferred' }),
      name: 'finalize_scheduled_admin_notification_v1',
    });
    expect(
      calls.some((call) => call.name === 'reserve_notification_push_batch_v1')
    ).toBe(false);
    vi.unstubAllGlobals();
  });

  it('finalizes as expired when expiry is reached after claim processing begins', async () => {
    const claim = {
      action_url: null,
      channels: ['in_app'],
      delivery_claim_token: '123e4567-e89b-42d3-a456-426614174099',
      expires_at: '2020-01-01T00:00:00.000Z',
      id: 'd8543bf1-5f03-4fd1-8a2a-2f7f1658c3f9',
      message: 'Expired notification',
      target_merchant_ids: [],
      target_segment: null,
      target_type: 'all',
      title: 'Expired',
    };
    const calls: Array<{ args?: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc: async (name: string, args?: Record<string, unknown>) => {
        calls.push({ args, name });
        return { data: true, error: null };
      },
    };

    const results = await processScheduledNotificationClaims(client, [claim]);

    expect(results).toEqual([{ id: claim.id, status: 'expired' }]);
    expect(calls).toContainEqual({
      args: expect.objectContaining({ p_outcome: 'expired' }),
      name: 'finalize_scheduled_admin_notification_v1',
    });
  });

  it('continues later claims when a renewal loses an earlier claim', async () => {
    const lostClaim = {
      action_url: null,
      channels: ['in_app'],
      delivery_claim_token: '123e4567-e89b-42d3-a456-426614174002',
      expires_at: null,
      id: 'd8543bf1-5f03-4fd1-8a2a-2f7f1658c3f1',
      message: 'First notification',
      target_merchant_ids: [],
      target_segment: null,
      target_type: 'all',
      title: 'First',
    };
    const validClaim = {
      ...lostClaim,
      delivery_claim_token: '123e4567-e89b-42d3-a456-426614174003',
      id: 'd8543bf1-5f03-4fd1-8a2a-2f7f1658c3f2',
      message: 'Second notification',
      title: 'Second',
    };
    const calls: Array<{ args?: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc: async (name: string, args?: Record<string, unknown>) => {
        calls.push({ args, name });
        if (name === 'renew_scheduled_notification_claim_v1') {
          return {
            data: args?.p_notification_id !== lostClaim.id,
            error: null,
          };
        }
        if (name === 'get_scheduled_notification_recipient_page_v1') {
          return { data: [], error: null };
        }
        if (name === 'get_notification_push_outbox_summary_v1') {
          return { data: {}, error: null };
        }
        if (name === 'finalize_scheduled_admin_notification_v1') {
          return {
            data: args?.p_notification_id !== lostClaim.id,
            error: null,
          };
        }
        return { data: null, error: null };
      },
    };

    const results = await processScheduledNotificationClaims(client, [
      lostClaim,
      validClaim,
    ]);

    expect(results).toEqual([
      { id: validClaim.id, recipients: 0, status: 'sent' },
    ]);
    expect(calls).not.toContainEqual({
      args: expect.objectContaining({
        p_notification_id: lostClaim.id,
        p_outcome: 'retry',
      }),
      name: 'finalize_scheduled_admin_notification_v1',
    });
  });
});
