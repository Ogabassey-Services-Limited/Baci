import { NetworkError } from '@/lib/api-errors';
import { getMerchantProvisioningError } from './merchant-provisioning-error';

describe('getMerchantProvisioningError', () => {
  it.each([
    ['slug_unavailable', 'That store URL is unavailable.'],
    ['identity_incomplete', 'Your account is missing required identity data.'],
  ] as const)('preserves stable server code %s', (code, message) => {
    expect(
      getMerchantProvisioningError(
        new NetworkError(message, {
          statusCode: 409,
          data: { code, error: message },
        })
      )
    ).toEqual({ code, message });
  });

  it('never classifies provisioning failures as account-exists', () => {
    expect(
      getMerchantProvisioningError(
        new NetworkError('Could not finish store setup.', {
          statusCode: 500,
          data: { code: 'provisioning_failed' },
        })
      )
    ).toEqual({
      code: 'provisioning_failed',
      message: 'Could not finish store setup.',
    });
  });

  it('uses a stable retryable message for unknown failures', () => {
    expect(
      getMerchantProvisioningError(new Error('raw provider secret'))
    ).toEqual({
      code: 'provisioning_failed',
      message: 'Could not finish store setup. Please try again.',
    });
  });
});
