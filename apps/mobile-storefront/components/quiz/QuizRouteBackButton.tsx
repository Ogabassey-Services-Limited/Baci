import Ionicons from '@react-native-vector-icons/ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useQuizStore } from '@/stores/quiz-store';

export function QuizRouteBackButton({ color }: { color: string }) {
  const router = useRouter();
  const status = useQuizStore((state) => state.status);
  const reset = useQuizStore((state) => state.reset);

  return (
    <Pressable
      accessibilityLabel={status === 'result' ? 'Back to SuperQuiz' : 'Go back'}
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        if (status === 'result') {
          reset();
          return;
        }
        router.back();
      }}
    >
      <Ionicons name="chevron-back" color={color} size={26} />
    </Pressable>
  );
}
