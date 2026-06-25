import { router } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { clearAuthLoginResumeState } from './login-resume-state';

export type AuthStep = 'email' | 'otp' | 'password';
type LoginMode = 'otp';

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
