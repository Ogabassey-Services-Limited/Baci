import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { UsernamePrompt } from '@/components/account/UsernamePrompt';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { useTheme } from '@/hooks/useTheme';
import { quizUsernameGateStyles as styles } from './QuizUsernameGateModal.styles';

interface QuizUsernameGateModalProps {
  onCancel: () => void;
  onSuccess: (username: string) => void;
  visible: boolean;
}

/**
 * Blocks quiz attempts until the customer picks a username — quiz results
 * are shown on a public leaderboard, so a display name must exist first.
 */
export function QuizUsernameGateModal({
  onCancel,
  onSuccess,
  visible,
}: QuizUsernameGateModalProps) {
  const { colors } = useTheme();

  return (
    <ModalSheet
      visible={visible}
      animationType="slide"
      backdropStyle={styles.backdrop}
      cardStyle={[styles.card, { backgroundColor: colors.background }]}
      onBackdropPress={onCancel}
      onRequestClose={onCancel}
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.text }]}
        >
          Choose a username to appear on the leaderboard
        </Text>
        <Pressable
          accessibilityLabel="Cancel username setup"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.iconButton}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        Winners are announced by username, not your full name. Set one to start
        this quiz.
      </Text>
      <UsernamePrompt onSuccess={onSuccess} submitLabel="Continue" />
    </ModalSheet>
  );
}
