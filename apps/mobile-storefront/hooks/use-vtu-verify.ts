import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { fetchWithTimeout, SHORT_TIMEOUT } from '@/lib/fetch-with-timeout';
import { supabase } from '@/lib/supabase';

const API_URL = EXPO_PUBLIC_API_URL;

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
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.error && typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          'Continuing VTU verification without a local session:',
          sessionResult.error
        );
      }

      // Guest utility verification is intentional: the backend accepts public
      // verify requests and applies merchant-side validation/rate controls.
      const accessToken = sessionResult.data?.session?.access_token;

      const response = await fetchWithTimeout(`${API_URL}/api/vtu/verify`, {
        timeout: SHORT_TIMEOUT,
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
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
