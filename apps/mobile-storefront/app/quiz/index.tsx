import { Stack } from 'expo-router';
import { QuizScreen } from '@/components/quiz/QuizScreen';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';

export default function QuizRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Prize Quiz' }} />
      <StorefrontScreenShell>
        <QuizScreen />
      </StorefrontScreenShell>
    </>
  );
}
