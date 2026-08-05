import {
  isMissingUsernameChangedAtColumn,
  LEGACY_CUSTOMER_SELECT_COLUMNS,
} from './auth-customer-schema-compat';

describe('customer schema compatibility', () => {
  it('recognizes the pre-quiz username timestamp schema', () => {
    expect(
      isMissingUsernameChangedAtColumn({
        code: '42703',
        message: 'column customers.username_changed_at does not exist',
      })
    ).toBe(true);
    expect(LEGACY_CUSTOMER_SELECT_COLUMNS).not.toContain('username_changed_at');
  });

  it('does not hide unrelated database errors', () => {
    expect(
      isMissingUsernameChangedAtColumn({
        code: '42501',
        message: 'permission denied',
      })
    ).toBe(false);
  });
});
