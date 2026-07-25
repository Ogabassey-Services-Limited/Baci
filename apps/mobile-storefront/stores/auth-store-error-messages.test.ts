import { profileRpcErrorMessages } from './auth-store-error-messages';

describe('profileRpcErrorMessages.username', () => {
  it.each([
    ['username_taken', 'That username is already taken. Try another.'],
    ['reserved_username', 'That username is not available.'],
    ['customer_not_found', 'No shopper account found for this store.'],
    ['not_authenticated', 'Please sign in to choose a username.'],
  ])('maps %s to friendly copy', (code, message) => {
    expect(profileRpcErrorMessages.username(code)).toBe(message);
  });

  it('falls back to a generic message for an unmapped code', () => {
    expect(profileRpcErrorMessages.username('some_unmapped_code')).toBe(
      'Could not set username'
    );
  });
});

describe('profileRpcErrorMessages.dateOfBirth', () => {
  it.each([
    ['invalid_date_of_birth', 'Enter a valid date of birth.'],
    ['customer_not_found', 'No shopper account found for this store.'],
    ['not_authenticated', 'Please sign in to continue.'],
  ])('maps %s to friendly copy', (code, message) => {
    expect(profileRpcErrorMessages.dateOfBirth(code)).toBe(message);
  });

  it('falls back to a generic message for an unmapped code', () => {
    expect(profileRpcErrorMessages.dateOfBirth('some_unmapped_code')).toBe(
      'Could not save date of birth'
    );
  });
});
