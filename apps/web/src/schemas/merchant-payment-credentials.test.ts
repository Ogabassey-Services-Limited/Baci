import { describe, expect, it } from 'vitest';
import {
  merchantPaymentCredentialsDeleteSchema,
  merchantPaymentCredentialsSaveSchema,
  paymentCredentialEnvironmentSchema,
  paymentCredentialProviderSchema,
} from './merchant-payment-credentials';

describe('paymentCredentialProviderSchema', () => {
  it('accepts the paypal provider', () => {
    // Arrange / Act
    const result = paymentCredentialProviderSchema.safeParse('paypal');

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported provider with a clear, growable message', () => {
    // Arrange / Act
    const result = paymentCredentialProviderSchema.safeParse('stripe');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Unsupported payment provider. Only 'paypal' can be configured right now."
    );
  });
});

describe('paymentCredentialEnvironmentSchema', () => {
  it.each(['test', 'live'])('accepts the %s environment', (environment) => {
    // Arrange / Act
    const result = paymentCredentialEnvironmentSchema.safeParse(environment);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects an environment outside test/live', () => {
    // Arrange / Act
    const result = paymentCredentialEnvironmentSchema.safeParse('production');

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('merchantPaymentCredentialsSaveSchema', () => {
  const validPaypalInput = {
    provider: 'paypal' as const,
    environment: 'live' as const,
    clientId: 'AY-client-id-value-1234',
    secretKey: 'EL-secret-key-value-5678',
  };

  it('parses a valid paypal payload', () => {
    // Arrange / Act
    const result =
      merchantPaymentCredentialsSaveSchema.safeParse(validPaypalInput);

    // Assert
    expect(result.success).toBe(true);
  });

  it('trims clientId and secretKey before returning parsed data', () => {
    // Arrange
    const padded = {
      ...validPaypalInput,
      clientId: '   AY-client-id-value-1234   ',
      secretKey: '\tEL-secret-key-value-5678\n',
    };

    // Act
    const result = merchantPaymentCredentialsSaveSchema.safeParse(padded);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientId).toBe('AY-client-id-value-1234');
      expect(result.data.secretKey).toBe('EL-secret-key-value-5678');
    }
  });

  it('rejects a clientId shorter than the minimum length', () => {
    // Arrange / Act
    const result = merchantPaymentCredentialsSaveSchema.safeParse({
      ...validPaypalInput,
      clientId: 'short',
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('clientId must be at least 10 characters.');
    }
  });

  it('rejects a whitespace-only secretKey after trimming', () => {
    // Arrange / Act
    const result = merchantPaymentCredentialsSaveSchema.safeParse({
      ...validPaypalInput,
      secretKey: '          ',
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported provider via the discriminator', () => {
    // Arrange / Act
    const result = merchantPaymentCredentialsSaveSchema.safeParse({
      provider: 'stripe',
      environment: 'live',
      clientId: 'rk-client-id-value-1234',
      secretKey: 'rk-secret-key-value-5678',
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects a missing environment', () => {
    // Arrange
    const { environment: _environment, ...withoutEnvironment } =
      validPaypalInput;

    // Act
    const result =
      merchantPaymentCredentialsSaveSchema.safeParse(withoutEnvironment);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('merchantPaymentCredentialsDeleteSchema', () => {
  it('accepts a paypal delete request', () => {
    // Arrange / Act
    const result = merchantPaymentCredentialsDeleteSchema.safeParse({
      provider: 'paypal',
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects a delete request for an unsupported provider', () => {
    // Arrange / Act
    const result = merchantPaymentCredentialsDeleteSchema.safeParse({
      provider: 'razorpay',
    });

    // Assert
    expect(result.success).toBe(false);
  });
});
