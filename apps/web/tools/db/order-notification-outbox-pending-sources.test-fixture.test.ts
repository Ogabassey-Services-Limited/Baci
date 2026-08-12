import { describe, expect, it } from 'vitest';
import { ORDER_NOTIFICATION_OUTBOX_PENDING_SOURCES } from './order-notification-outbox-pending-sources.test-fixture';

describe('order notification outbox pending sources fixture', () => {
  it('binds the outbox claim grant revocation migration', () => {
    expect(ORDER_NOTIFICATION_OUTBOX_PENDING_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryPath:
            'supabase/migrations/20260724153014_revoke_order_notification_outbox_claim_public_grants.sql',
        }),
      ])
    );
  });
});
