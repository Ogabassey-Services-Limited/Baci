import type { User } from '@supabase/supabase-js';
import { deriveCheckoutIdentity } from './checkout-identity';

function makeUser(
  overrides: Partial<User> & { user_metadata?: Record<string, unknown> } = {}
): User {
  return {
    id: 'user-1',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-04-01T00:00:00.000Z',
    email: 'signed-in@example.com',
    role: 'authenticated',
    updated_at: '2026-04-01T00:00:00.000Z',
    user_metadata: {},
    ...overrides,
  } as User;
}

describe('deriveCheckoutIdentity', () => {
  it('prefers hydrated customer fields when available', () => {
    expect(
      deriveCheckoutIdentity({
        customer: {
          id: 'customer-1',
          email: 'customer@example.com',
          first_name: 'Ada',
          last_name: 'Okafor',
          phone: '08012345678',
        },
        user: makeUser({
          email: 'fallback@example.com',
          user_metadata: {
            first_name: 'Grace',
            last_name: 'Hopper',
            phone: '08000000000',
          },
        }),
      })
    ).toEqual({
      email: 'customer@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      phone: '+2348012345678',
    });
  });

  it('falls back to auth user metadata when the customer record is missing', () => {
    expect(
      deriveCheckoutIdentity({
        customer: null,
        user: makeUser({
          email: 'signed-in@example.com',
          user_metadata: {
            first_name: 'Grace',
            last_name: 'Hopper',
            phone: '+234 801 234 5678',
          },
        }),
      })
    ).toEqual({
      email: 'signed-in@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '+2348012345678',
    });
  });

  it('splits full_name when granular metadata fields are unavailable', () => {
    expect(
      deriveCheckoutIdentity({
        customer: null,
        user: makeUser({
          email: 'signed-in@example.com',
          user_metadata: {
            full_name: 'Ada Lovelace',
            phone_number: '08012345678',
          },
        }),
      })
    ).toEqual({
      email: 'signed-in@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+2348012345678',
    });
  });

  it('returns blank defaults for guests', () => {
    expect(
      deriveCheckoutIdentity({
        customer: null,
        user: null,
      })
    ).toEqual({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
    });
  });
});
