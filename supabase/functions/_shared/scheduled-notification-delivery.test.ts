import { describe, expect, it } from 'vitest';
import {
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

describe('processScheduledNotificationClaims', () => {
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
