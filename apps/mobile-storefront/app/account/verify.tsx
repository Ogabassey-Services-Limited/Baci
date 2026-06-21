import { type Href, Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { getPendingAuthLoginResumeState } from '@/components/auth/login-resume-state';

type AccountVerifySearchParams = Record<string, string | string[]>;

function buildOtpLoginRoute(
  returnTo: string | null,
  searchParams: AccountVerifySearchParams
): Href {
  return {
    pathname: '/auth/login',
    params: {
      ...searchParams,
      mode: 'otp',
      ...(returnTo ? { returnTo } : {}),
    },
  };
}

export default function AccountVerifyRoute() {
  const searchParams = useLocalSearchParams<AccountVerifySearchParams>();
  const [initialSearchParams] = useState<AccountVerifySearchParams>(
    () => searchParams
  );
  const [otpLoginRoute, setOtpLoginRoute] = useState<Href | null>(null);

  useEffect(() => {
    let isActive = true;

    getPendingAuthLoginResumeState()
      .then((resumeState) => {
        if (isActive) {
          setOtpLoginRoute(
            buildOtpLoginRoute(
              resumeState?.returnTo ?? null,
              initialSearchParams
            )
          );
        }
      })
      .catch(() => {
        if (isActive) {
          setOtpLoginRoute(buildOtpLoginRoute(null, initialSearchParams));
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialSearchParams]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {otpLoginRoute ? <Redirect href={otpLoginRoute} /> : null}
    </>
  );
}
