import Ionicons from '@react-native-vector-icons/ionicons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { QuizRouteBackButton } from '@/components/quiz/QuizRouteBackButton';
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
          title: 'SuperQuiz',
          headerBackVisible: false,
          headerLeft: () => <QuizRouteBackButton color={colors.text} />,
          headerRight: () => (
            <Pressable
              accessibilityLabel="View previous quiz leaderboards"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push('/quiz/leaderboards')}
            >
              <Ionicons
                name="podium-outline"
                color={colors.primary}
                size={23}
              />
            </Pressable>
          ),
        }}
      />
      <StorefrontScreenShell>
        <QuizScreen onSignIn={() => router.push('/auth/login')} />
      </StorefrontScreenShell>
    </>
  );
}
