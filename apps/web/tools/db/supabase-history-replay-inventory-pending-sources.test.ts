import { describe, expect, it } from 'vitest';
import { INVENTORY_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-inventory-pending-sources';

describe('inventory pending replay sources', () => {
  it('registers the latest inventory corrective migrations', () => {
    expect(INVENTORY_PENDING_REPLAY_SOURCE_ROWS.split('\n')).toEqual([
      'd38466b8daa79ac75dd96d0ee5e52039c62074cfaabf1ee326cbf3fb7f9f9a03 20260825190000_bulk_inventory_forecast_dashboard.sql',
      'be508f6123591624d3296d770a011f3ac6a4c4838ad10ad74f870a07aef2a2cd 20260827110200_restore_inventory_forecast_effective_stock_priority.sql',
      'a8fcac98895d9114ceef91a9dce08d461d63fe9b36ebd651686f61297eabdcb0 20260827110100_preserve_zero_inventory_threshold.sql',
      '446ea5fe68b2d140405d810527ff8c5b8005b3ac73a607dfe85911a20c58b13b 20260826160000_prioritize_out_of_stock_inventory_forecast.sql',
      'e2812d6c8e27dca4e546453d9ae80a8096d82f2602b741fd3408d320a144ab03 20260827010000_use_effective_inventory_forecast_stock.sql',
      'f5bc90b0820af8924481b6518ee7949bedb6d73396a7522d8f8c4d24a47272db 20260827020000_prioritize_inventory_status_before_limit.sql',
    ]);
  });
});
