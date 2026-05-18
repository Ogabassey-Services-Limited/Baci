import { Stack } from 'expo-router';
import { QuizScreen } from '@/components/quiz/QuizScreen';

export default function QuizRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Prize Quiz' }} />
      {/* QuizScreen owns StorefrontScreenShell to avoid nested safe-area shells. */}
      <QuizScreen />
    </>
  );
}
