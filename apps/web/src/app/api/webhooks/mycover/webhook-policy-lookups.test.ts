import { describe, expect, it } from 'vitest';
import {
  getLookupFromRenewalDetails,
  getPolicyLookup,
  isPreLossInspectionApproved,
} from './webhook-policy-lookups';

describe('MyCover policy lookup helpers', () => {
  it('prefers explicit policy identifiers over purchase and data ids', () => {
    expect(
      getPolicyLookup({
        id: 'data-id',
        purchase_id: 'purchase-id',
        policy_id: 'policy-id',
      })
    ).toEqual({ column: 'mycover_policy_id', value: 'policy-id' });
  });

  it('can disable data.id fallback for renewal payloads', () => {
    expect(getPolicyLookup({ id: 'renewal-id' }, { dataIdColumn: null })).toBe(
      null
    );
  });

  it('extracts nested renewal detail identifiers', () => {
    expect(
      getLookupFromRenewalDetails({ data: { policy: { id: 'policy-123' } } })
    ).toEqual({ column: 'mycover_policy_id', value: 'policy-123' });
    expect(
      getLookupFromRenewalDetails({
        data: { purchase: { id: 'purchase-123' } },
      })
    ).toEqual({ column: 'mycover_purchase_id', value: 'purchase-123' });
  });

  it('normalizes truthy pre-loss approval flags', () => {
    expect(isPreLossInspectionApproved({ meta: { is_approved: 'yes' } })).toBe(
      true
    );
    expect(
      isPreLossInspectionApproved({ essential: { is_approved: 'no' } })
    ).toBe(false);
  });
});
