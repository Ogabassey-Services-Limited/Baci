import { type Dispatch, type SetStateAction, useEffect } from 'react';
import { BackHandler } from 'react-native';
import {
  type AuthStep,
  returnToEmailFromAuthStep,
} from './login-screen-controller.helpers';

interface LoginHardwareBackHandlerOptions {
  setIsAppleAvailable: Dispatch<SetStateAction<boolean>>;
  setOtp: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  setStep: Dispatch<SetStateAction<AuthStep>>;
  step: AuthStep;
}

// Module-scope so the dynamic import() expression stays out of the hook body,
// which React Compiler cannot lower yet.
async function checkAppleAvailability(): Promise<boolean> {
  try {
    const appleAuth = await import('expo-apple-authentication');
    return await appleAuth.isAvailableAsync();
  } catch (_e) {
    return false;
  }
}

export function useLoginHardwareBackHandler({
  setIsAppleAvailable,
  setOtp,
  setPassword,
  setStep,
  step,
}: LoginHardwareBackHandlerOptions) {
  useEffect(() => {
    checkAppleAvailability().then((available) =>
      setIsAppleAvailable(available)
    );

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        return returnToEmailFromAuthStep(step, {
          setOtp,
          setPassword,
          setStep,
        });
      }
    );

    return () => backHandler.remove();
  }, [setIsAppleAvailable, setOtp, setPassword, setStep, step]);
}
