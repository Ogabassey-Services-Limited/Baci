import { describe, expect, it } from 'vitest';
import {
  BranchSchema,
  BranchScopeSchema,
  CreateBranchSchema,
  serializeBranchScope,
} from './branch';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const validBranchRow = {
  id: uuid,
  merchant_id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Lagos main',
  address: null,
  city: 'Lagos',
  state: 'Lagos',
  phone: null,
  manager_id: null,
  is_default: true,
  active: true,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

describe('mobile branch schemas', () => {
  it('parses active branch rows from Supabase', () => {
    const result = BranchSchema.safeParse(validBranchRow);

    expect(result.success).toBe(true);
  });

  it('rejects missing required branch row fields', () => {
    const missingRequiredFields = { ...validBranchRow } as Partial<
      typeof validBranchRow
    >;
    delete missingRequiredFields.id;
    delete missingRequiredFields.merchant_id;
    delete missingRequiredFields.name;
    const result = BranchSchema.safeParse(missingRequiredFields);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['id', 'merchant_id', 'name'])
      );
    }
  });

  it('rejects invalid branch row UUIDs', () => {
    const result = BranchSchema.safeParse({
      ...validBranchRow,
      id: 'not-a-uuid',
      merchant_id: 'also-not-a-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['id', 'merchant_id'])
      );
    }
  });

  it('rejects malformed branch row timestamps', () => {
    const result = BranchSchema.safeParse({
      ...validBranchRow,
      created_at: 'May 1st',
      updated_at: 'yesterday',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['created_at', 'updated_at'])
      );
    }
  });

  it('accepts Supabase timestamps with timezone offsets', () => {
    const utcResult = BranchSchema.safeParse({
      ...validBranchRow,
      created_at: '2026-05-07T10:36:08+00:00',
      updated_at: '2026-05-07T10:36:08+00:00',
    });
    const offsetResult = BranchSchema.safeParse({
      ...validBranchRow,
      created_at: '2026-05-07T10:36:08+01:00',
      updated_at: null,
    });

    expect(utcResult.success).toBe(true);
    expect(offsetResult.success).toBe(true);
  });

  it('rejects incorrect branch row field types', () => {
    const result = BranchSchema.safeParse({
      ...validBranchRow,
      is_default: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toContain(
        'is_default'
      );
    }
  });

  it('validates mobile create payloads using camelCase API fields', () => {
    const result = CreateBranchSchema.safeParse({
      name: 'Abuja branch',
      address: '1 Central Area',
      city: 'Abuja',
      state: 'FCT',
      phone: '+2348012345678',
      managerId: uuid,
      isDefault: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects snake_case create payloads before they reach the web API', () => {
    const result = CreateBranchSchema.safeParse({
      name: 'Abuja branch',
      address: '1 Central Area',
      city: 'Abuja',
      state: 'FCT',
      phone: '+2348012345678',
      manager_id: uuid,
      is_default: true,
    });

    expect(result.success).toBe(false);
  });

  it('supports all-location and concrete branch scopes', () => {
    expect(BranchScopeSchema.safeParse({ type: 'all' }).success).toBe(true);
    expect(
      BranchScopeSchema.safeParse({ type: 'branch', branchId: uuid }).success
    ).toBe(true);
    expect(
      BranchScopeSchema.safeParse({ type: 'branch', branchId: 'bad' }).success
    ).toBe(false);
  });

  it('serializes all-location scope as null and branch scope as branch id', () => {
    expect(serializeBranchScope({ type: 'all' })).toBeNull();
    expect(serializeBranchScope({ type: 'branch', branchId: uuid })).toBe(uuid);
  });
});
