import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readMigration(filename: string) {
  const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs(?=\/)/, '');
  return readFileSync(
    resolve(
      dirname(modulePath),
      `../../../../../supabase/migrations/${filename}`
    ),
    'utf8'
  );
}

describe('GIGL tenant reconciliation migration', () => {
  it('reconciles both update orders and recreates the newest eligible monitor', () => {
    const migration = readMigration(
      '20260802000700_finalize_gigl_monitor_tenant_reconciliation.sql'
    );

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION private.reconcile_gigl_monitor_tenant('
    );
    expect(migration).toContain(
      'outbox.merchant_id IS DISTINCT FROM v_order_merchant_id'
    );
    expect(migration).toContain("shipment.provider = 'GIGL'");
    expect(migration).toContain(
      'ORDER BY shipment.tracking_timeline_generation DESC'
    );
    expect(migration).toContain('ON CONFLICT (shipment_id) DO UPDATE SET');
    expect(migration).toContain('AFTER UPDATE OF merchant_id ON public.orders');
    expect(migration).toContain(
      'AFTER UPDATE OF merchant_id ON public.shipments'
    );
    expect(migration).toContain('AFTER UPDATE OF order_id ON public.shipments');
    expect(migration).toContain(
      'shipment.order_id IS DISTINCT FROM p_order_id'
    );
    expect(migration).toContain('outbox.shipment_id = NEW.id');
  });
});
