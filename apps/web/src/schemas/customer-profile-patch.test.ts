import { describe, expect, it } from 'vitest';
import { customerProfilePatchSchema } from './customer-profile-patch';

describe('customerProfilePatchSchema', () => {
  it('accepts a minimal valid body (merchantSlug only)', () => {
    expect(
      customerProfilePatchSchema.safeParse({ merchantSlug: 'ogabassey' })
        .success
    ).toBe(true);
  });

  it('rejects a body missing merchantSlug', () => {
    expect(customerProfilePatchSchema.safeParse({}).success).toBe(false);
  });

  it('accepts expected_user_id alongside a date of birth', () => {
    const result = customerProfilePatchSchema.safeParse({
      merchantSlug: 'ogabassey',
      date_of_birth: '1990-06-15',
      expected_user_id: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty expected_user_id', () => {
    expect(
      customerProfilePatchSchema.safeParse({
        merchantSlug: 'ogabassey',
        expected_user_id: '',
      }).success
    ).toBe(false);
  });

  it('rejects a saved address that is missing required fields', () => {
    expect(
      customerProfilePatchSchema.safeParse({
        merchantSlug: 'ogabassey',
        saved_addresses: [{ label: 'Home' }],
      }).success
    ).toBe(false);
  });
});
