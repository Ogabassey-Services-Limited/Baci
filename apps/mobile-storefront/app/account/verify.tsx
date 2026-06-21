import { type Href, Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  const [otpLoginRoute, setOtpLoginRoute] = useState<Href | null>(null);
  const searchParams = useLocalSearchParams<AccountVerifySearchParams>();
  const initialSearchParamsRef = useRef<AccountVerifySearchParams | null>(null);

  if (initialSearchParamsRef.current === null) {
    initialSearchParamsRef.current = searchParams;
  }

  useEffect(() => {
    let isActive = true;
    const initialSearchParams = initialSearchParamsRef.current ?? {};

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
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {otpLoginRoute ? <Redirect href={otpLoginRoute} /> : null}
    </>
  );
}
