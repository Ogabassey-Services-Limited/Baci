import { vi } from 'vitest';

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
  merchantId?: string;
  errors?: {
    fieldErrors: Record<string, string[] | undefined>;
  };
};

export const submitOnboarding = vi.fn();
