import { describe, expect, it } from 'vitest';
import {
  branchCreateSchema,
  branchIdParamSchema,
  branchUpdateSchema,
} from '@/schemas/branches';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('branch schemas', () => {
  it('accepts a valid branch create payload', () => {
    const result = branchCreateSchema.safeParse({
      name: 'Lagos main',
      address: '12 Marina Road',
      city: 'Lagos',
      state: 'Lagos',
      phone: '+2348012345678',
      managerId: uuid,
      isDefault: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'Lagos main',
        address: '12 Marina Road',
        city: 'Lagos',
        state: 'Lagos',
        phone: '+2348012345678',
        managerId: uuid,
        isDefault: true,
      });
    }
  });

  it('trims names and defaults isDefault to false on create', () => {
    const result = branchCreateSchema.safeParse({
      name: '  Abuja branch  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Abuja branch');
      expect(result.data.isDefault).toBe(false);
    }
  });

  it('rejects invalid branch create payloads', () => {
    const result = branchCreateSchema.safeParse({
      name: 'A',
      managerId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['name'],
            message: 'Branch name must be at least 2 characters',
          }),
          expect.objectContaining({
            path: ['managerId'],
            message: 'Invalid branch manager',
          }),
        ])
      );
    }
  });

  it('accepts nullable managerId on update', () => {
    const result = branchUpdateSchema.safeParse({
      managerId: null,
      isDefault: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects active mutations on update', () => {
    const activeResult = branchUpdateSchema.safeParse({
      active: false,
    });

    expect(activeResult.success).toBe(false);
  });

  it('rejects empty update payloads', () => {
    const result = branchUpdateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('validates route ids as UUIDs', () => {
    expect(branchIdParamSchema.safeParse({ id: uuid }).success).toBe(true);
    expect(branchIdParamSchema.safeParse({ id: 'branch-1' }).success).toBe(
      false
    );
  });
});
