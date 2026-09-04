import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('apply GIGL tracking for orderless repair pickups migration', () => {
  it('null-safes shipment identity and allows merchant-only orderless outbox rows', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260904190200_apply_gigl_tracking_orderless_repair_pickups.sql'
      ),
      'utf8'
    );

    expect(migration).toContain(
      'ALTER TABLE public.shipment_tracking_notification_outbox'
    );
    expect(migration).toContain('ALTER COLUMN order_id DROP NOT NULL');
    expect(migration).toContain(
      'shipment.order_id IS NOT DISTINCT FROM v_order_id'
    );
    expect(migration).toContain(
      "(shipment.order_id IS NOT NULL OR policy.audience = 'merchant')"
    );
  });
});
