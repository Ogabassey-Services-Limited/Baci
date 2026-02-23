import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

const WHITE = '#FFFFFF';
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.6)';

interface SuccessModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  subMessage?: string;
}

export function SuccessModal({
  visible,
  title = 'Success!',
  message,
  subMessage,
  onClose,
}: SuccessModalProps) {
  const { colors, shadows } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInUp.springify().damping(15)}
          style={[styles.container, { backgroundColor: colors.card }, shadows.lg]}
          accessible={true}
          accessibilityViewIsModal={true}
          accessibilityLabel={`${title} dialog. ${message}`}
        >
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBg,
                {
                  backgroundColor: colors.successLight,
                  borderColor: colors.successLight,
                },
              ]}
            >
              <Ionicons name="checkmark" size={40} color={colors.success} />
            </View>
            <View
              style={[
                styles.particle,
                { top: 0, left: 10, backgroundColor: colors.success },
              ]}
            />
            <View
              style={[
                styles.particle,
                { top: 10, right: 0, backgroundColor: colors.successLight },
              ]}
            />
            <View
              style={[
                styles.particle,
                { bottom: 0, left: 20, backgroundColor: colors.success },
              ]}
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {subMessage && (
            <View
              style={[
                styles.subMessageContainer,
                { backgroundColor: colors.backgroundLight },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={colors.textMuted}
                style={{ marginTop: 2 }}
              />
              <Text style={[styles.subMessage, { color: colors.textMuted }]}>
                {subMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss success message"
          >
            <Text style={styles.buttonText}>Beautiful!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    position: 'relative',
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.size.lg,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  subMessageContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING['2xl'],
    width: '100%',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  subMessage: {
    fontSize: TYPOGRAPHY.size.sm, // Using sm (12) for secondary text
    flex: 1,
    lineHeight: 18,
  },
  button: {
    width: '100%',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: WHITE,
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
