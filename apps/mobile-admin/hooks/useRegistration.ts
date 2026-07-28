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
  country: string;
  otherBusinessType?: string;
  slug?: string;
  // true only when the user manually edited the Store Link (vs. the auto-derived
  // value the UI prefilled). The server treats an auto slug as a de-dupable
  // preference and an explicit one as a hard choice (409 if taken).
  slugIsCustom?: boolean;
  phone?: string;
  brandColors?: string;
  logoUrl?: string;
  brandPreferences?: string;
}

interface CompleteProfilePayload {
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  businessName: string;
  businessType: string;
  country: string;
  otherBusinessType?: string;
  slug?: string;
  slugIsCustom?: boolean;
  logoUrl?: string;
  brandColors?: string;
  brandPreferences?: string;
}

// Response type for onboarding API (registration and profile completion)
interface OnboardingResponse {
  success: boolean;
  message?: string;
  user?: { id: string; email: string };
  merchant?: { id: string; slug: string };
}

export function useRegistration() {
  const queryClient = useQueryClient();

  // Register Mutation — no auth needed (new user doesn't have a session yet)
  // Increased timeout: server does auth + DB writes + deferred AI template generation
  const registerMutation = useMutation({
    // Account and merchant creation have side effects before every possible
    // error response. Retrying a deterministic 4xx can replace the original
    // actionable error (for example, Store URL Unavailable) with Account Exists.
    retry: false,
    mutationFn: (data: RegisterPayload): Promise<OnboardingResponse> =>
      apiClient<OnboardingResponse>(ONBOARDING_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: false,
        timeout: 30_000,
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
    retry: false,
    mutationFn: (data: CompleteProfilePayload): Promise<OnboardingResponse> =>
      apiClient<OnboardingResponse>(ONBOARDING_ENDPOINT, {
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
