import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

export interface VerifyResult {
  verified: boolean;
  customerName?: string;
  message: string;
}

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      return data;
    },
  });
}
