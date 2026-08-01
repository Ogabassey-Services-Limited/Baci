import { describe, expect, it } from 'vitest';
import { manifest } from './storefront-origin-budget.test-fixtures';
import { reconcileStorefrontDeliveryEvidence } from './storefront-origin-budget-reconciliation';

describe('reconcileStorefrontDeliveryEvidence', () => {
  it('accepts matching independent invocation and WAF source counts', () => {
    const reconciliation = reconcileStorefrontDeliveryEvidence(manifest());

    expect(reconciliation.independentSourceCountsReconciled).toBe(true);
    expect(reconciliation.trafficPartitionReconciled).toBe(true);
  });

  it('rejects a drifted independent invocation count', () => {
    const evidence = manifest();
    evidence.days[0].sourceEvidence.invocation.requestCount = 999;

    expect(
      reconcileStorefrontDeliveryEvidence(evidence)
        .independentSourceCountsReconciled
    ).toBe(false);
  });
});
