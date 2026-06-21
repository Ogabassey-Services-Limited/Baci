import { type Href, Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { getPendingAuthLoginResumeState } from '@/components/auth/login-resume-state';

function buildOtpLoginRoute(returnTo: string | null): Href {
  return {
    pathname: '/auth/login',
    params: returnTo ? { mode: 'otp', returnTo } : { mode: 'otp' },
  };
}

export default function AccountVerifyRoute() {
  const [otpLoginRoute, setOtpLoginRoute] = useState<Href | null>(null);

  useEffect(() => {
    let isActive = true;

    getPendingAuthLoginResumeState()
      .then((resumeState) => {
        if (isActive) {
          setOtpLoginRoute(buildOtpLoginRoute(resumeState?.returnTo ?? null));
        }
      })
      .catch(() => {
        if (isActive) {
          setOtpLoginRoute(buildOtpLoginRoute(null));
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {otpLoginRoute ? <Redirect href={otpLoginRoute} /> : null}
    </>
  );
}
