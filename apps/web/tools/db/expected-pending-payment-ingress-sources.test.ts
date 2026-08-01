import { describe, expect, it } from 'vitest';
import { PAYMENT_INGRESS_AND_PROVENANCE_PENDING_SOURCES } from './expected-pending-payment-ingress-sources.test-support';

describe('payment ingress and provenance pending sources', () => {
  it('keeps the payment companion between issuance and operation scoping', () => {
    const paths = PAYMENT_INGRESS_AND_PROVENANCE_PENDING_SOURCES.map(
      ({ repositoryPath }) => repositoryPath
    );
    const expectedPaths = [
      'supabase/migrations/20260731100000_harden_product_description_attestation_grants.sql',
      'supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql',
      'supabase/migrations/20260801090000_harden_product_description_provenance_retention.sql',
      'supabase/migrations/20260801130000_bound_product_description_attestation_issuance.sql',
      'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql',
      'supabase/migrations/20260801160000_scope_product_description_attestation_operation_ids.sql',
    ] as const;
    expect(paths).toEqual(expect.arrayContaining([...expectedPaths]));

    const grantIndex = paths.indexOf(expectedPaths[0]);
    const paymentFoundationIndex = paths.indexOf(expectedPaths[1]);
    const retentionIndex = paths.indexOf(expectedPaths[2]);
    const issuanceIndex = paths.indexOf(expectedPaths[3]);
    const companionIndex = paths.indexOf(expectedPaths[4]);
    const operationIdIndex = paths.indexOf(expectedPaths[5]);

    expect(grantIndex).toBeGreaterThanOrEqual(0);
    expect(paymentFoundationIndex).toBeGreaterThan(grantIndex);
    expect(retentionIndex).toBeGreaterThan(paymentFoundationIndex);
    expect(companionIndex).toBeGreaterThan(issuanceIndex);
    expect(companionIndex).toBeLessThan(operationIdIndex);
  });
});
