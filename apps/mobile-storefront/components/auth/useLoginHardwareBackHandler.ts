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

export function useLoginHardwareBackHandler({
  setIsAppleAvailable,
  setOtp,
  setPassword,
  setStep,
  step,
}: LoginHardwareBackHandlerOptions) {
  useEffect(() => {
    const checkAppleAvailability = async () => {
      try {
        const appleAuth = await import('expo-apple-authentication');
        const available = await appleAuth.isAvailableAsync();
        setIsAppleAvailable(available);
      } catch (_e) {
        setIsAppleAvailable(false);
      }
    };
    checkAppleAvailability();

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
