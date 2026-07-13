import 'server-only';

import { requestSickwCheck } from '@/lib/imei-lookup-fulfillment';
import type { ImeiProvider } from './types';

export function createSickwProvider({
  apiKey,
}: {
  apiKey?: string;
}): ImeiProvider & { name: 'sickw' } {
  return {
    isConfigured: () => Boolean(apiKey),
    name: 'sickw',
    async submit(request) {
      if (!apiKey) {
        return {
          body: {
            code: 'SICKW_API_KEY_MISSING',
            error: 'IMEI lookup is temporarily unavailable',
            success: false,
          },
          kind: 'failure',
          providerStatus: 'unconfigured',
          refundReason: 'error',
          status: 502,
        };
      }

      const result = await requestSickwCheck({
        apiKey,
        checksIncluded: request.checksIncluded,
        imei: request.identifier,
        serviceId: request.binding.productId,
        tierName: request.tierName,
      });

      return result.ok
        ? {
            body: result.body,
            kind: 'complete',
            providerStatus: result.sickwStatus,
            rawResponseText: result.rawResponseText,
            status: result.status,
          }
        : {
            body: result.body,
            kind: 'failure',
            providerStatus: result.sickwStatus,
            rawResponseText: result.rawResponseText,
            refundReason: result.refundReason,
            status: result.status,
          };
    },
  };
}
