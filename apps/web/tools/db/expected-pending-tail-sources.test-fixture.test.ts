import { describe, expect, it } from 'vitest';
import { EXPECTED_PENDING_TAIL_SOURCES } from './expected-pending-tail-sources.test-fixture';

describe('EXPECTED_PENDING_TAIL_SOURCES', () => {
  it('preserves the exact identity and payment-ingress migration bindings', () => {
    expect(EXPECTED_PENDING_TAIL_SOURCES).toEqual({
      identity: [
        {
          repositoryPath:
            'supabase/migrations/20260729195914_update_merchant_identity_settings.sql',
          sha256:
            '6e63f92629949491d21c2a5ca2e47367d91e398c061fa3d1419e2a7a0c3ff61b',
        },
      ],
      paymentIngressCompanion: [
        {
          repositoryPath:
            'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql',
          sha256:
            '55c1efce71726e1f1e0f9fa2b035cd52f040bae5ab1693ee6442e0e2e25ff70f',
        },
      ],
      paymentIngressFoundation: [
        {
          repositoryPath:
            'supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql',
          sha256:
            '1a390474d12890e9f641c72f743b35669798eee56a887a87720f4bd8b53a1705',
        },
      ],
    });
  });
});
