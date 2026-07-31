import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { VerifiedTotpFactor } from './security-factor-selector';

type TotpSetup = { factorId: string; secret: string };

export function useSecurityMfaLifecycle() {
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState(false);
  const [isAal2, setIsAal2] = useState(false);
  const [isBusy, setIsBusy] = useState(true);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [verifiedFactors, setVerifiedFactors] = useState<VerifiedTotpFactor[]>(
    []
  );
  const isMountedRef = useRef(true);
  const isOperationInFlight = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (setup) return;

    let isActive = true;
    setIsBusy(true);

    void Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
      .then(([{ data: factors, error }, { data: assurance }]) => {
        if (!isActive) return;
        if (error) {
          Alert.alert('Security Error', error.message);
          setIsBusy(false);
          return;
        }

        const verified = factors.totp.map((factor, index) => ({
          id: factor.id,
          name: factor.friendly_name ?? `Authenticator ${index + 1}`,
        }));
        const verifiedFactor = verified[0];
        const pendingFactor = factors.all.find(
          (factor) =>
            factor.factor_type === 'totp' && factor.status === 'unverified'
        );
        setFactorId(verifiedFactor?.id ?? pendingFactor?.id ?? null);
        setHasVerifiedFactor(Boolean(verifiedFactor));
        setIsAal2(assurance?.currentLevel === 'aal2');
        setPendingFactorId(pendingFactor?.id ?? null);
        setVerifiedFactors(verified);
        setIsBusy(false);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        Alert.alert(
          'Security Error',
          error instanceof Error ? error.message : 'Could not load security.'
        );
        setIsBusy(false);
      });

    return () => {
      isActive = false;
    };
  }, [setup]);

  const runSingleFlight = (operation: () => Promise<void>) => {
    if (isOperationInFlight.current) return;

    isOperationInFlight.current = true;
    if (isMountedRef.current) setIsBusy(true);
    void operation()
      .catch((error: unknown) => {
        if (!isMountedRef.current) return;
        Alert.alert(
          'Security Error',
          error instanceof Error
            ? error.message
            : 'Could not complete security.'
        );
      })
      .finally(() => {
        isOperationInFlight.current = false;
        if (isMountedRef.current) setIsBusy(false);
      });
  };

  const enroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Baci Admin authenticator',
    });
    if (error) {
      if (isMountedRef.current) {
        Alert.alert('Could not enable 2FA', error.message);
      }
      return;
    }

    if (!isMountedRef.current) return;
    setSetup({ factorId: data.id, secret: data.totp.secret });
    setFactorId(data.id);
  };

  const startEnrollment = () => {
    runSingleFlight(enroll);
  };

  const restartEnrollment = () => {
    const factorToReplace = pendingFactorId ?? factorId;
    if (!factorToReplace) return;
    const preservesVerifiedFactor =
      hasVerifiedFactor && pendingFactorId === factorToReplace;

    runSingleFlight(async () => {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorToReplace,
      });
      if (error) {
        if (isMountedRef.current) {
          Alert.alert('Could not restart 2FA setup', error.message);
        }
        return;
      }

      if (!isMountedRef.current) return;
      if (!preservesVerifiedFactor) {
        setFactorId(null);
      }
      setPendingFactorId(null);
      await enroll();
    });
  };

  const verifyCode = () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      Alert.alert('Enter the code', 'Enter the 6-digit authenticator code.');
      return;
    }

    runSingleFlight(async () => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        code,
        factorId,
      });
      if (error) {
        if (isMountedRef.current) {
          Alert.alert('Verification failed', error.message);
        }
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== 'aal2') {
        if (isMountedRef.current) {
          Alert.alert(
            'Verification incomplete',
            assuranceError?.message ??
              'Could not confirm your verified session.'
          );
        }
        return;
      }

      if (!isMountedRef.current) return;
      setIsAal2(true);
      setCode('');
      setSetup(null);
      Alert.alert(
        'Two-factor authentication enabled',
        'Your session is verified.'
      );
    });
  };

  return {
    code,
    factorId,
    hasVerifiedFactor,
    isAal2,
    isBusy,
    pendingFactorId,
    setCode,
    setFactorId,
    setup,
    startEnrollment,
    restartEnrollment,
    verifiedFactors,
    verifyCode,
  };
}
