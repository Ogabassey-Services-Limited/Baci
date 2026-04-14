import { describe, expect, it } from 'vitest';
import { formatInviteEmail } from '@/components/auth/format-invite-email';

describe('formatInviteEmail', () => {
  it('strips HTML and trims the invite email value', () => {
    expect(formatInviteEmail('  <b>staff@example.com</b>  ')).toEqual({
      value: 'staff@example.com',
      label: 'staff@example.com',
    });
  });

  it('truncates long invite email labels without truncating the form value', () => {
    const rawEmail = `${'a'.repeat(70)}@example.com`;
    const result = formatInviteEmail(rawEmail);

    expect(result.value).toBe(rawEmail);
    expect(result.label).toBe(`${'a'.repeat(61)}...`);
    expect(result.label).toHaveLength(64);
    expect(result.label.endsWith('...')).toBe(true);
  });
});
