import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { DateOfBirthPrompt } from '@/components/account/DateOfBirthPrompt';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { useTheme } from '@/hooks/useTheme';
import { quizDateOfBirthGateStyles as styles } from './QuizDateOfBirthGateModal.styles';

interface QuizDateOfBirthGateModalProps {
  onCancel: () => void;
  onSuccess: (dateOfBirth: string) => void;
  visible: boolean;
}

/**
 * Blocks quiz attempts until the customer provides a date of birth — Super Quiz
 * is 18+, and the server age gate reads the stored value to decide eligibility.
 */
export function QuizDateOfBirthGateModal({
  onCancel,
  onSuccess,
  visible,
}: QuizDateOfBirthGateModalProps) {
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
          Confirm your date of birth
        </Text>
        <Pressable
          accessibilityLabel="Cancel date of birth setup"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.iconButton}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        Super Quiz is 18+. Enter your date of birth to start this quiz.
      </Text>
      <DateOfBirthPrompt onSuccess={onSuccess} submitLabel="Continue" />
    </ModalSheet>
  );
}
