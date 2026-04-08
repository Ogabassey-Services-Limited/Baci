import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { z } from 'zod';
import { fetchWithTimeout, SHORT_TIMEOUT } from '@/lib/fetch-with-timeout';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

export interface VerifyResult {
  verified: boolean;
  customerName?: string;
  message: string;
}

const VerifyResultSchema = z.object({
  verified: z.boolean(),
  customerName: z.string().optional(),
  message: z.string(),
});

interface VerifyParams {
  billItemIdentifier: string;
  customerIdentifier: string;
}

/**
 * Verifies a customer before bill purchase.
 * Used for electricity meters, TV smart cards, and betting accounts.
 */
export function useVTUVerify() {
  return useMutation<VerifyResult, Error, VerifyParams>({
    mutationFn: async (params) => {
      const response = await fetchWithTimeout(`${API_URL}/api/vtu/verify`, {
        timeout: SHORT_TIMEOUT,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        let errorMsg = 'Verification failed';
        try {
          const errData = await response.json();
          if (errData?.message) errorMsg = errData.message;
        } catch {
          /* non-JSON response */
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const parsed = VerifyResultSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('Invalid verification response from server');
      }
      return parsed.data;
    },
  });
}
