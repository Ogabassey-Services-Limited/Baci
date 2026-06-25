import { describe, expectTypeOf, it } from 'vitest';
import type {
  Policy,
  PolicyFetchResult,
  PolicyItemsInsured,
} from './insurance-policy-types';

describe('insurance policy type contracts', () => {
  it('keeps policy item metadata extensible and nullable', () => {
    expectTypeOf<PolicyItemsInsured>().toMatchTypeOf<{
      imei?: string | null;
      product_id?: string | null;
      product_name?: string | null;
      [key: string]: unknown;
    }>();
  });

  it('keeps fetched policy results explicit about missing policy states', () => {
    expectTypeOf<PolicyFetchResult>().toEqualTypeOf<{
      policy: Policy | null;
      error: string;
    }>();
  });
});
