import { describe, expect, it } from 'vitest';
import { PAYMENT_INGRESS_AND_PROVENANCE_PENDING_SOURCES } from './expected-pending-payment-ingress-sources.test-support';

describe('payment ingress and provenance pending sources', () => {
  it('keeps the payment companion between issuance and operation scoping', () => {
    const paths = PAYMENT_INGRESS_AND_PROVENANCE_PENDING_SOURCES.map(
      ({ repositoryPath }) => repositoryPath
    );
    expect(
      paths.indexOf(
        'supabase/migrations/20260801130000_bound_product_description_attestation_issuance.sql'
      )
    ).toBeLessThan(
      paths.indexOf(
        'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql'
      )
    );
    expect(
      paths.indexOf(
        'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql'
      )
    ).toBeLessThan(
      paths.indexOf(
        'supabase/migrations/20260801160000_scope_product_description_attestation_operation_ids.sql'
      )
    );
  });
});
