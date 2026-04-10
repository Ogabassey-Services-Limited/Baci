/**
 * StatusModal – Success/error feedback modal overlay
 * Extracted from StoreSettingsScreen for modularity.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface StatusModalState {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}

interface StatusModalProps {
  status: StatusModalState;
  onClose: () => void;
}

export function StatusModal({ status, onClose }: StatusModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={status.visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  status.type === 'success'
                    ? colors.successLight
                    : colors.errorLight,
              },
            ]}
          >
            <Ionicons
              name={status.type === 'success' ? 'checkmark' : 'alert'}
              size={32}
              color={status.type === 'success' ? colors.success : colors.error}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {status.title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {status.message}
          </Text>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor:
                  status.type === 'success' ? colors.primary : colors.error,
              },
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss status message"
            accessibilityHint="Closes the status message"
          >
            <Text style={styles.buttonText}>Okay</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
