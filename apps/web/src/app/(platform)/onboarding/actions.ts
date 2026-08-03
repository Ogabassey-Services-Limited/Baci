'use server';

import { cookies } from 'next/headers';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { onboardingMagicLinkSchema } from '@/schemas/onboarding-magic-link';
import type { ServerActionState } from './onboarding-action-types';
import {
  buildOnboardingRedirectUrl,
  runSubmitOnboardingWorkflow,
} from './submit-onboarding-workflow';

export type { ServerActionState } from './onboarding-action-types';

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: pre-auth onboarding submission; Zod-validated + identity/IP rate limited
export async function submitOnboarding(
  prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  return await runSubmitOnboardingWorkflow(prevState, formData);
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: login bootstrap cannot require a session; email Zod-validated + identity/IP rate limited to the middleware budget
export async function sendMagicLink(
  email: string
): Promise<{ success: boolean; message: string }> {
  const rateLimitAllowed = await ensureActionRateLimit('magic-link', {
    requests: 3,
    windowMs: 60_000,
  });
  if (!rateLimitAllowed) {
    return {
      success: false,
      message: 'Too many magic link requests. Please try again later.',
    };
  }
  if (!email) return { success: false, message: 'Email is required.' };
  const validationResult = onboardingMagicLinkSchema.safeParse({ email });
  if (!validationResult.success) {
    return {
      success: false,
      message:
        validationResult.error.issues[0]?.message ??
        'Please enter a valid email address.',
    };
  }
  try {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.signInWithOtp({
      email: validationResult.data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildOnboardingRedirectUrl('fromMagicLink=true'),
      },
    });
    if (error) {
      logger.warn({ message: 'Onboarding magic link send failed', error });
      return {
        success: false,
        message: 'Unable to send magic link. Please try again later.',
      };
    }
    return { success: true, message: 'Magic link sent! Check your email.' };
  } catch (error) {
    logger.warn({ message: 'Onboarding magic link send threw', error });
    return {
      success: false,
      message: 'Unable to send magic link. Please try again later.',
    };
  }
}
