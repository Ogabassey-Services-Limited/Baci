import { z } from 'zod';

/**
 * Validation schemas for the merchant payment-credentials management API
 * (`/api/merchant/payment-credentials`). See
 * docs/payments/byok-payment-providers-plan.md Phase 2 (PayPal lane).
 *
 * Only `paypal` is accepted today. The provider list is a const tuple and the
 * save schema is a discriminated union so a new lane (Stripe `rk_`,
 * Flutterwave, …) slots in as one added entry + one added variant, without
 * loosening validation for the existing ones.
 */

export const SUPPORTED_PAYMENT_CREDENTIAL_PROVIDERS = ['paypal'] as const;

export type SupportedPaymentCredentialProvider =
  (typeof SUPPORTED_PAYMENT_CREDENTIAL_PROVIDERS)[number];

// PayPal issues ~80-character client IDs and secrets. A conservative floor
// rejects blank / truncated / typo'd pastes without risking a valid sandbox
// credential.
const MIN_PAYPAL_CREDENTIAL_LENGTH = 10;

/**
 * Standalone provider enum used where only the provider is supplied (the GET
 * query string and the DELETE body). Rejects unknown providers with a clear,
 * growable message.
 */
export const paymentCredentialProviderSchema = z.enum(
  SUPPORTED_PAYMENT_CREDENTIAL_PROVIDERS,
  {
    error:
      "Unsupported payment provider. Only 'paypal' can be configured right now.",
  }
);

export const paymentCredentialEnvironmentSchema = z.enum(['test', 'live'], {
  error: "environment must be either 'test' or 'live'.",
});

const paypalCredentialsSaveSchema = z.object({
  provider: z.literal('paypal'),
  environment: paymentCredentialEnvironmentSchema,
  // Trimmed BEFORE storage so the vault's key_last4 (derived from the raw
  // string) reflects exactly the value we validate and store.
  clientId: z
    .string({ error: 'clientId is required.' })
    .trim()
    .min(
      MIN_PAYPAL_CREDENTIAL_LENGTH,
      `clientId must be at least ${MIN_PAYPAL_CREDENTIAL_LENGTH} characters.`
    ),
  secretKey: z
    .string({ error: 'secretKey is required.' })
    .trim()
    .min(
      MIN_PAYPAL_CREDENTIAL_LENGTH,
      `secretKey must be at least ${MIN_PAYPAL_CREDENTIAL_LENGTH} characters.`
    ),
});

/**
 * POST body — validate-on-save. Discriminated on `provider`; an unknown
 * provider fails with a discriminator error naming the supported value(s).
 */
export const merchantPaymentCredentialsSaveSchema = z.discriminatedUnion(
  'provider',
  [paypalCredentialsSaveSchema]
);

/** DELETE body — only the provider is required to disconnect a lane. */
export const merchantPaymentCredentialsDeleteSchema = z.object({
  provider: paymentCredentialProviderSchema,
});

export type MerchantPaymentCredentialsSaveInput = z.infer<
  typeof merchantPaymentCredentialsSaveSchema
>;
export type MerchantPaymentCredentialsDeleteInput = z.infer<
  typeof merchantPaymentCredentialsDeleteSchema
>;
