import {
  mapDateOfBirthError,
  mapUsernameError,
} from './auth-store-error-messages';

describe('mapUsernameError', () => {
  it.each([
    ['username_taken', 'That username is already taken. Try another.'],
    ['reserved_username', 'That username is not available.'],
    ['customer_not_found', 'No shopper account found for this store.'],
    ['not_authenticated', 'Please sign in to choose a username.'],
  ])('maps %s to friendly copy', (code, message) => {
    expect(mapUsernameError(code)).toBe(message);
  });

  it('falls back to a generic message for an unmapped code', () => {
    expect(mapUsernameError('some_unmapped_code')).toBe(
      'Could not set username'
    );
  });
});

describe('mapDateOfBirthError', () => {
  it.each([
    ['invalid_date_of_birth', 'Enter a valid date of birth.'],
    ['customer_not_found', 'No shopper account found for this store.'],
    ['not_authenticated', 'Please sign in to continue.'],
  ])('maps %s to friendly copy', (code, message) => {
    expect(mapDateOfBirthError(code)).toBe(message);
  });

  it('falls back to a generic message for an unmapped code', () => {
    expect(mapDateOfBirthError('some_unmapped_code')).toBe(
      'Could not save date of birth'
    );
  });
});
