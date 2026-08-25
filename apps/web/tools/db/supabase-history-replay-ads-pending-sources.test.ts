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
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260824090000_replace_social_ads_spend_window.sql'
    );
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260824110000_account_aware_ads_sync_marker.sql'
    );
    expect(ADS_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260825130000_index_snapchat_ads_oauth_state_nonce_fks.sql'
    );
  });
});
