import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { createQuizStyles } from './QuizScreen.styles';

interface QuizErrorPanelProps {
  description: string;
  onRetry: () => void;
  primaryColor: string;
  showRetry: boolean;
  styles: ReturnType<typeof createQuizStyles>;
}

export function QuizErrorPanel({
  description,
  onRetry,
  primaryColor,
  showRetry,
  styles,
}: QuizErrorPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <Ionicons
            name="alert-circle-outline"
            size={30}
            color={primaryColor}
          />
        </View>
        <Text style={styles.errorTitle}>We couldn&apos;t start the quiz</Text>
        <Text accessibilityRole="alert" style={styles.errorDescription}>
          {description}
        </Text>
      </View>
      {showRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading quiz events"
          onPress={onRetry}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
