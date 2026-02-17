import { describe, expect, it } from 'vitest';
import { changePasswordSchema, setPasswordSchema } from './account-security';

const strongPassword = 'MyStr0ngP@ssword2026!';

describe('setPasswordSchema', () => {
  it('parses valid matching passwords', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: strongPassword,
      confirmPassword: strongPassword,
    });
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: 'Ab1!xyz',
      confirmPassword: 'Ab1!xyz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password (strength < 2)', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: 'abcdefgh',
      confirmPassword: 'abcdefgh',
    });
    expect(result.success).toBe(false);
  });

  it('rejects common password', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: strongPassword,
      confirmPassword: 'SomethingElse!2026',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  it('rejects empty confirmPassword', () => {
    const result = setPasswordSchema.safeParse({
      newPassword: strongPassword,
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('parses valid payload with current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword!1',
      newPassword: strongPassword,
      confirmPassword: strongPassword,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: strongPassword,
      confirmPassword: strongPassword,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('currentPassword');
    }
  });

  it('rejects weak new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword!1',
      newPassword: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword!1',
      newPassword: strongPassword,
      confirmPassword: 'Mismatch!2026',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });
});
