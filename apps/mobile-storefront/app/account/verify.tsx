import { type Href, Redirect, Stack } from 'expo-router';

const OTP_LOGIN_ROUTE: Href = {
  pathname: '/auth/login',
  params: { mode: 'otp' },
};

export default function AccountVerifyRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href={OTP_LOGIN_ROUTE} />
    </>
  );
}
