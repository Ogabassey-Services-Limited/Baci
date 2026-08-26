import { describe, expect, it } from 'vitest';
import { INVENTORY_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-inventory-pending-sources';

describe('inventory pending replay sources', () => {
  it('registers the latest inventory corrective migrations', () => {
    expect(INVENTORY_PENDING_REPLAY_SOURCE_ROWS.split('\n')).toEqual([
      'a8fcac98895d9114ceef91a9dce08d461d63fe9b36ebd651686f61297eabdcb0 20260826140000_preserve_zero_inventory_threshold.sql',
      '446ea5fe68b2d140405d810527ff8c5b8005b3ac73a607dfe85911a20c58b13b 20260826160000_prioritize_out_of_stock_inventory_forecast.sql',
    ]);
  });
});
