import { NetworkError } from '@/lib/api-errors';

export type MerchantProvisioningErrorCode =
  | 'slug_unavailable'
  | 'identity_incomplete'
  | 'invalid_input'
  | 'provisioning_failed';

export interface MerchantProvisioningError {
  code: MerchantProvisioningErrorCode;
  message: string;
}

const PROVISIONING_CODES = new Set<MerchantProvisioningErrorCode>([
  'slug_unavailable',
  'identity_incomplete',
  'invalid_input',
  'provisioning_failed',
]);

export function getMerchantProvisioningError(
  error: unknown
): MerchantProvisioningError {
  if (error instanceof NetworkError) {
    const data = error.data;
    const code =
      typeof data === 'object' &&
      data !== null &&
      'code' in data &&
      typeof data.code === 'string' &&
      PROVISIONING_CODES.has(data.code as MerchantProvisioningErrorCode)
        ? (data.code as MerchantProvisioningErrorCode)
        : 'provisioning_failed';
    return { code, message: error.message };
  }

  return {
    code: 'provisioning_failed',
    message: 'Could not finish store setup. Please try again.',
  };
}
