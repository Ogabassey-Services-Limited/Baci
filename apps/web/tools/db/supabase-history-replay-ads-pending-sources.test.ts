import { describe, expect, it } from 'vitest';
import { ADS_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-ads-pending-sources';

describe('supabase history replay ads pending sources', () => {
  it('registers the provider storage and reauthorization migrations', () => {
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260821180000_provider_neutral_ads_storage.sql'
    );
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260823210000_google_ads_reauth_clear_account.sql'
    );
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260823220000_google_ads_sync_consistency.sql'
    );
  });
});
