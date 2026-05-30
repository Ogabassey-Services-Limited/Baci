import { describe, expect, it } from 'vitest';
import { getStaffDisplayIdentity } from './staff-screen-action-helpers';

describe('getStaffDisplayIdentity', () => {
  it('prefers a trimmed staff name', () => {
    expect(
      getStaffDisplayIdentity({
        email: 'ada@example.com',
        name: '  Ada  ',
      })
    ).toBe('Ada');
  });

  it('falls back to email and then unknown user', () => {
    expect(
      getStaffDisplayIdentity({
        email: '  ada@example.com  ',
        name: '   ',
      })
    ).toBe('ada@example.com');
    expect(getStaffDisplayIdentity({ email: '', name: '' })).toBe(
      'Unknown User'
    );
  });
});
