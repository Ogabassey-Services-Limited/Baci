import { describe, expect, it } from 'vitest';
import {
  findRole,
  isModeConnected,
  isRecord,
  type PaymentCredentialStatusResponse,
  toVaultEnvironment,
} from './paypal-provider-status';

describe('toVaultEnvironment', () => {
  it('maps the live mode to the live vault environment', () => {
    // Arrange / Act
    const result = toVaultEnvironment('live');

    // Assert
    expect(result).toBe('live');
  });

  it('maps the sandbox mode to the test vault environment', () => {
    // Arrange / Act
    const result = toVaultEnvironment('sandbox');

    // Assert
    expect(result).toBe('test');
  });
});

describe('isRecord', () => {
  it('returns true for a plain object', () => {
    // Arrange / Act / Assert
    expect(isRecord({ foo: 'bar' })).toBe(true);
  });

  it('returns false for an array', () => {
    // Arrange / Act / Assert
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('returns false for null', () => {
    // Arrange / Act / Assert
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for a primitive', () => {
    // Arrange / Act / Assert
    expect(isRecord('not a record')).toBe(false);
  });
});

describe('findRole', () => {
  const status: PaymentCredentialStatusResponse = {
    configured: true,
    roles: [
      {
        role: 'secret_key',
        environment: 'test',
        last4: '6789',
        isActive: true,
        lastValidatedAt: '2026-07-08T00:00:00.000Z',
        lastValidationError: null,
      },
      {
        role: 'client_id',
        environment: 'live',
        last4: '4321',
        isActive: false,
        lastValidatedAt: null,
        lastValidationError: 'PayPal rejected these credentials.',
      },
    ],
  };

  it('finds a matching role + environment pair', () => {
    // Arrange / Act
    const role = findRole(status, 'secret_key', 'test');

    // Assert
    expect(role).toEqual(
      expect.objectContaining({ role: 'secret_key', last4: '6789' })
    );
  });

  it('returns null when no role matches the environment', () => {
    // Arrange / Act
    const role = findRole(status, 'secret_key', 'live');

    // Assert
    expect(role).toBeNull();
  });

  it('returns null when the status response is null', () => {
    // Arrange / Act
    const role = findRole(null, 'secret_key', 'test');

    // Assert
    expect(role).toBeNull();
  });
});

describe('isModeConnected', () => {
  function roleView(
    overrides: Partial<PaymentCredentialStatusResponse['roles'][number]> = {}
  ): PaymentCredentialStatusResponse['roles'][number] {
    return {
      role: 'secret_key',
      environment: 'test',
      last4: '6789',
      isActive: true,
      lastValidatedAt: '2026-07-08T00:00:00.000Z',
      lastValidationError: null,
      ...overrides,
    };
  }

  it('returns true when both roles are active with no validation error', () => {
    // Arrange
    const status: PaymentCredentialStatusResponse = {
      configured: true,
      roles: [
        roleView({ role: 'secret_key' }),
        roleView({ role: 'client_id', last4: '1234' }),
      ],
    };

    // Act / Assert
    expect(isModeConnected(status, 'sandbox')).toBe(true);
  });

  it('returns false when the requested mode has no credentials', () => {
    // Arrange: only the test environment is populated.
    const status: PaymentCredentialStatusResponse = {
      configured: true,
      roles: [
        roleView({ role: 'secret_key' }),
        roleView({ role: 'client_id', last4: '1234' }),
      ],
    };

    // Act / Assert: live has nothing connected.
    expect(isModeConnected(status, 'live')).toBe(false);
  });

  it('returns false when the secret carries a validation error', () => {
    // Arrange
    const status: PaymentCredentialStatusResponse = {
      configured: true,
      roles: [
        roleView({
          role: 'secret_key',
          lastValidationError: 'PayPal rejected these credentials.',
        }),
        roleView({ role: 'client_id', last4: '1234' }),
      ],
    };

    // Act / Assert
    expect(isModeConnected(status, 'sandbox')).toBe(false);
  });

  it('returns false when a role is inactive', () => {
    // Arrange
    const status: PaymentCredentialStatusResponse = {
      configured: true,
      roles: [
        roleView({ role: 'secret_key' }),
        roleView({ role: 'client_id', last4: '1234', isActive: false }),
      ],
    };

    // Act / Assert
    expect(isModeConnected(status, 'sandbox')).toBe(false);
  });

  it('returns false for a null status', () => {
    // Act / Assert
    expect(isModeConnected(null, 'sandbox')).toBe(false);
  });
});
