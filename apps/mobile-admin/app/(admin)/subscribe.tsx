import { Stack, useRouter } from 'expo-router';
import Paywall from '@/components/paywall/Paywall';

export default function SubscribeScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Paywall onClose={() => router.back()} />
    </>
  );
}
