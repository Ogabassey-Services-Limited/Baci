import { Stack } from 'expo-router';
import { QuizLeaderboardScreen } from '@/components/quiz/QuizLeaderboardScreen';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';

export default function QuizLeaderboardsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Past leaderboards' }} />
      <StorefrontScreenShell>
        <QuizLeaderboardScreen />
      </StorefrontScreenShell>
    </>
  );
}
