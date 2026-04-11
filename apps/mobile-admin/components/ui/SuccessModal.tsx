import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

interface SuccessModalProps {
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  actionVariant?: 'default' | 'whatsapp';
  closeLabel?: string;
  onActionPress?: () => void;
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  subMessage?: string;
}

export function SuccessModal({
  actionIcon,
  actionLabel,
  actionVariant = 'default',
  closeLabel = 'Done',
  onActionPress,
  visible,
  title = 'Success!',
  message,
  subMessage,
  onClose,
}: SuccessModalProps) {
  const { colors } = useTheme();

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
          style={[styles.container, { backgroundColor: colors.card }]}
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

          {subMessage ? (
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
          ) : null}

          <View style={styles.buttonStack}>
            {actionLabel && onActionPress ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor:
                      actionVariant === 'whatsapp' ? '#25D366' : colors.primary,
                  },
                  pressed && styles.buttonPressed,
                ]}
                onPress={onActionPress}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
              >
                <View style={styles.buttonContent}>
                  {actionIcon ? (
                    <Ionicons name={actionIcon} size={18} color="#FFF" />
                  ) : null}
                  <Text style={styles.buttonText}>{actionLabel}</Text>
                </View>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                {
                  backgroundColor: colors.backgroundLight,
                  borderColor: colors.border,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.text }]}
              >
                {closeLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  subMessageContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    alignItems: 'flex-start',
    gap: 8,
  },
  subMessage: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  buttonStack: {
    gap: 12,
    width: '100%',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
