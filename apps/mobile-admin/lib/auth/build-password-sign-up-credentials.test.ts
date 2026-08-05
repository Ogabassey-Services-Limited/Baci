import { describe, expect, it } from 'vitest';
import { buildPasswordSignUpCredentials } from './build-password-sign-up-credentials';

describe('buildPasswordSignUpCredentials', () => {
  it('normalizes names and persists only safe signup monitoring context', () => {
    expect(
      buildPasswordSignUpCredentials({
        attemptId: '123e4567-e89b-42d3-a456-426614174000',
        email: 'merchant@example.com',
        firstName: 'aDA',
        lastName: 'lOVELACE',
        password: 'not-logged',
        signupFlow: 'merchant',
      })
    ).toEqual({
      email: 'merchant@example.com',
      password: 'not-logged',
      options: {
        data: {
          first_name: 'Ada',
          full_name: 'Ada Lovelace',
          last_name: 'Lovelace',
          signup_attempt_id: '123e4567-e89b-42d3-a456-426614174000',
          signup_flow: 'merchant',
        },
      },
    });
  });
});
