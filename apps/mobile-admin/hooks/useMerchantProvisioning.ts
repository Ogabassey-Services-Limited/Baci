import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRuntimePlatform } from '@/config/runtime-platform';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

export interface MerchantProvisioningPayload {
  firstName: string;
  lastName: string;
  phone?: string;
  businessName: string;
  businessType: string;
  otherBusinessType?: string;
  country: string;
  slug?: string;
  slugIsCustom: boolean;
  logoUrl?: string;
  brandColors?: {
    primary: string;
    background: string;
    accent: string;
  };
}

interface MerchantProvisioningResponse {
  success: true;
  merchant: { id: string; slug: string };
  created: boolean;
}

export function useMerchantProvisioning() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    retry: false,
    mutationFn: async (
      payload: MerchantProvisioningPayload
    ): Promise<MerchantProvisioningResponse> => {
      const platform = getRuntimePlatform();
      if (platform !== 'ios' && platform !== 'android') {
        throw new Error(`Unsupported mobile platform: ${platform}`);
      }
      if (!user?.id) {
        throw new Error('Authenticated user is required for store setup');
      }

      const result = await apiClient<MerchantProvisioningResponse>(
        '/api/mobile/merchant-provisioning',
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'X-Baci-Platform': platform },
        }
      );

      await queryClient.invalidateQueries({
        queryKey: ['merchant', user.id],
        refetchType: 'active',
      });
      return result;
    },
  });
}
