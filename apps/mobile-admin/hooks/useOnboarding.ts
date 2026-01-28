import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const ONBOARDING_ENDPOINT = '/api/mobile-onboarding';

interface RegisterPayload {
  email: string;
  password?: string;
  confirmPassword?: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType?: string;
  otherBusinessType?: string;
  slug?: string;
  phone?: string;
  brandColors?: string;
  logoUrl?: string;
}

interface CompleteProfilePayload {
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  businessName: string;
  businessType: string;
  otherBusinessType?: string;
  slug?: string;
  logoUrl?: string;
  brandColors?: string;
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  // Register Mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterPayload) =>
      apiClient(ONBOARDING_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate auth/merchant queries if needed
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    },
  });

  // Complete Profile Mutation
  const completeProfileMutation = useMutation({
    mutationFn: (data: CompleteProfilePayload) =>
      apiClient(ONBOARDING_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (error) => {
      console.error('Profile completion failed:', error);
    },
  });

  return {
    register: registerMutation,
    completeProfile: completeProfileMutation,
    isLoading: registerMutation.isPending || completeProfileMutation.isPending,
  };
}
