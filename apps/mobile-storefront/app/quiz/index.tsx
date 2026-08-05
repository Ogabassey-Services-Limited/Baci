import Ionicons from '@react-native-vector-icons/ionicons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { QuizScreen } from '@/components/quiz/QuizScreen';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useTheme } from '@/hooks/useTheme';

export default function QuizRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Quiz',
          headerRight: () => (
            <Pressable
              accessibilityLabel="View previous quiz leaderboards"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push('/quiz/leaderboards')}
            >
              <Ionicons name="trophy-outline" color={colors.text} size={23} />
            </Pressable>
          ),
        }}
      />
      <StorefrontScreenShell>
        <QuizScreen />
      </StorefrontScreenShell>
    </>
  );
}
