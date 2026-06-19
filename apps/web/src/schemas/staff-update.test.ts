import { describe, expect, it } from 'vitest';
import { staffUpdateSchema } from './staff-update';

describe('staffUpdateSchema', () => {
  it('accepts valid staff update fields and strips unknown fields', () => {
    const parsed = staffUpdateSchema.safeParse({
      name: '  Ada Lovelace  ',
      role: 'blog_manager',
      status: 'active',
      permissions: {
        staff: { view: true, edit: false },
      },
      ignored: 'value',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      name: 'Ada Lovelace',
      role: 'blog_manager',
      status: 'active',
      permissions: {
        staff: { view: true, edit: false },
      },
    });
  });

  it('rejects invalid roles, statuses, names, and permission values', () => {
    expect(staffUpdateSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(staffUpdateSchema.safeParse({ status: 'disabled' }).success).toBe(
      false
    );
    expect(staffUpdateSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(
      staffUpdateSchema.safeParse({
        permissions: { staff: { edit: 'yes' } },
      }).success
    ).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(staffUpdateSchema.safeParse(null).success).toBe(false);
    expect(staffUpdateSchema.safeParse('name').success).toBe(false);
    expect(staffUpdateSchema.safeParse(['name']).success).toBe(false);
  });
});
