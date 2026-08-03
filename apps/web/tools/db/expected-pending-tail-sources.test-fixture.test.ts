import { describe, expect, it } from 'vitest';
import { EXPECTED_PENDING_TAIL_SOURCES } from './expected-pending-tail-sources.test-fixture';

describe('EXPECTED_PENDING_TAIL_SOURCES', () => {
  it('lists the expected pending-tail migration sources with integrity hashes', () => {
    expect(EXPECTED_PENDING_TAIL_SOURCES).toEqual({
      identity: [
        {
          repositoryPath:
            'supabase/migrations/20260729195913_guard_merchant_identity_updates.sql',
          sha256:
            '12c758bd0bfd54643076b0d5e4c2b48092808493b2c0fb7caed9c16eb35db185',
        },
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
      paymentWebhookEvidence: [
        {
          repositoryPath:
            'supabase/migrations/20260801150000_payment_webhook_evidence_foundation.sql',
          sha256:
            '640f72cd35c32b489409ffce05b76bf71730b9ec365bfb93989181e2ba85c2bc',
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
      storefrontShippingAndRepairs: [
        {
          repositoryPath:
            'supabase/migrations/20260802175837_harden_repair_booking_and_shipping_providers.sql',
          sha256:
            '845c3dab7b48495c6e0ed88cd72033f4d736139f3ca6239bb8e8c61abe54dcda',
        },
        {
          repositoryPath:
            'supabase/migrations/20260802220000_centralize_shipping_provider_policy.sql',
          sha256:
            'c0ec34bcd397263cf1f8d91fe94d0e3aa0edd4d600101dc9656ce261cd6bf2d1',
        },
        {
          repositoryPath:
            'supabase/migrations/20260803000000_add_repair_booking_rate_limit_index.sql',
          sha256:
            '846a37482ca4ea765f63c9ba1cf5bb747e81446f955c0c440dead034cd86fa11',
        },
        {
          repositoryPath:
            'supabase/migrations/20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql',
          sha256:
            '2fcb90a7746d88841ed00c86e2d46a7525674bb4e7aea04393f53bca3c0fef1c',
        },
        {
          repositoryPath:
            'supabase/migrations/20260803000200_fix_shipping_provider_and_repair_booking_regressions.sql',
          sha256:
            '068707fce641a6818521fcef448d8a35eccbeadad9ff785420a16be7133e3ceb',
        },
      ],
    });
  });
});
