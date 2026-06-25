import { sanitizeCustomerLoginEmailHint } from '@baci/shared/schemas';
import { type Href, router } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { EmailSchema, getFirstError } from '@/lib/validation';
import { clearAuthLoginResumeState } from './login-resume-state';

export type AuthStep = 'email' | 'otp' | 'password';
type LoginMode = 'otp';
const RECEIPT_CLAIM_RETURN_TO_PREFIX = '/receipts/claim/';

interface AuthStepResetHandlers {
  setOtp: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  setStep: Dispatch<SetStateAction<AuthStep>>;
}

export function getValidatedLoginMode(
  mode: string | string[] | undefined
): LoginMode | null {
  const rawMode = Array.isArray(mode) ? mode[0] : mode;
  return rawMode === 'otp' ? 'otp' : null;
}

export function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

export function getValidatedLoginEmailHint(
  email: string | string[] | undefined
) {
  return sanitizeCustomerLoginEmailHint(email);
}

export function getReceiptClaimTokenFromReturnTo(
  returnTo: string | string[] | undefined
) {
  const rawReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (!rawReturnTo) {
    return null;
  }

  let decodedReturnTo: string;
  try {
    decodedReturnTo = decodeURIComponent(rawReturnTo);
  } catch {
    decodedReturnTo = rawReturnTo;
  }

  if (!decodedReturnTo.startsWith(RECEIPT_CLAIM_RETURN_TO_PREFIX)) {
    return null;
  }

  const tokenWithMaybeSearch = decodedReturnTo.slice(
    RECEIPT_CLAIM_RETURN_TO_PREFIX.length
  );
  const token = tokenWithMaybeSearch.split(/[?#]/, 1)[0];

  return token || null;
}

export async function fetchLoginEmailHintFromReturnTo(
  returnTo: string | string[] | undefined,
  fetchImpl: typeof fetch = fetch
) {
  const token = getReceiptClaimTokenFromReturnTo(returnTo);
  if (!token) {
    return '';
  }

  try {
    const baseUrl = EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
    const response = await fetchImpl(
      `${baseUrl}/api/storefront/receipts/claims/${encodeURIComponent(token)}/login-email`,
      { headers: { accept: 'application/json' } }
    );

    if (!response.ok) {
      return '';
    }

    const body: unknown = await response.json();
    const emailHint =
      body && typeof body === 'object' && 'emailHint' in body
        ? body.emailHint
        : null;

    return sanitizeCustomerLoginEmailHint(
      typeof emailHint === 'string' ? emailHint : null
    );
  } catch {
    return '';
  }
}

export function validateLoginEmailInput(value: string) {
  const emailResult = EmailSchema.safeParse(value.trim());
  return {
    error: getFirstError(emailResult),
    normalizedEmail: normalizeEmail(value),
  };
}

function getSafeReturnToHref(returnTo: string): Href | null {
  try {
    const decodedReturnTo = decodeURIComponent(returnTo);
    const isRelativePath =
      decodedReturnTo.startsWith('/') &&
      !decodedReturnTo.startsWith('//') &&
      !decodedReturnTo.includes(':');

    return isRelativePath ? (decodedReturnTo as Href) : null;
  } catch {
    return null;
  }
}

function dismissOrNavigateHome() {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }

  router.replace('/');
}

export function dismissAuthenticatedLogin(returnTo: string | undefined) {
  void clearAuthLoginResumeState();
  if (returnTo) {
    const safeReturnTo = getSafeReturnToHref(returnTo);
    if (safeReturnTo) {
      router.replace(safeReturnTo);
      return;
    }
  }

  dismissOrNavigateHome();
}

export function returnToEmailFromAuthStep(
  step: AuthStep,
  { setOtp, setPassword, setStep }: AuthStepResetHandlers
) {
  if (step === 'otp') {
    void clearAuthLoginResumeState();
    setStep('email');
    setOtp('');
    router.setParams({ mode: 'email' });
    return true;
  }

  if (step === 'password') {
    setStep('email');
    setPassword('');
    return true;
  }

  return false;
}
