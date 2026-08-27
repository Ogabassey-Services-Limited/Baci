import { describe, expect, it } from 'vitest';
import { INVENTORY_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-inventory-pending-sources';

describe('inventory pending replay sources', () => {
  it('registers all append-only serialized inventory migrations', () => {
    expect(INVENTORY_PENDING_REPLAY_SOURCE_ROWS.split('\n')).toEqual([
      'a24c3bdd3f5fc8c87bcb878d12463f4bcfbc64553ebcd41d104ac3c30fcf4f28 20260825111303_serialize_inventory_release_on_order.sql',
      '754d41bb57151cd31b21937d5bc6b00397de43c6ff1070dd3725c37982866448 20260825123500_fail_closed_missing_stock_rows.sql',
      '6e1d8936c5a69ab3c98825e93914a31fa9cf3689bd3984758e956fec1c0b7b7d 20260825173500_authorize_serialized_inventory_claims.sql',
      '0e4c28c67751b4ceb90b75d937fb6a2cc569a325380d75a660e8696622c4b533 20260825180500_authorize_inventory_confirmation.sql',
      'b48e1267c12f890c7eb7a51dddaf9aefacd2c635319334303b738707be999f20 20260825185000_scope_confirmation_reclaims_per_item.sql',
      '52ae196aa2a25d65d2cc8fc53109d3f3d20832a8221dab54dad6d93862eaf372 20260827120000_harden_serialized_inventory_release_reconciliation.sql',
    ]);
  });
});
