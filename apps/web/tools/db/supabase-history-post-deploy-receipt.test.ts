import { describe, expect, it } from 'vitest';
import { supabaseHistoryPostDeployReceipt } from './supabase-history-post-deploy-receipt';

describe('supabaseHistoryPostDeployReceipt', () => {
  it('pins the exact linked production ledger observed after deployment', () => {
    expect(supabaseHistoryPostDeployReceipt).toEqual({
      linkedInventorySha256:
        '1ddb8497e4d0cc692a4f8fd5c5dec7f5da16d49b4c45c0511d4f19e7646b8ffc',
      linkedRowCount: 442,
      linkedTailVersion: '20260714225503',
      localFileCount: 424,
      localUniqueVersionCount: 422,
    });
  });
});
