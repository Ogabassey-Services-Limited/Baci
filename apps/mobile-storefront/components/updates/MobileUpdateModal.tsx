import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, RADIUS, SPACING } from '@/constants/Colors';
import type { MobileUpdatePrompt } from './mobile-update-check';

interface MobileUpdateModalProps {
  onAccept: () => void;
  onDismiss: () => void;
  prompt: MobileUpdatePrompt | null;
  visible: boolean;
}

function getTitle(prompt: MobileUpdatePrompt) {
  switch (prompt.kind) {
    case 'native-required':
      return 'Update required';
    case 'native-recommended':
      return 'Update available';
    case 'ota-available':
      return 'Quick update ready';
  }
}

function getAcceptLabel(prompt: MobileUpdatePrompt) {
  return prompt.kind === 'ota-available' ? 'Update now' : 'Open store';
}

const ignoreRequiredModalCloseRequest = () => {
  // No-op: required updates must not be dismissible via the Android back button.
};

export function MobileUpdateModal({
  onAccept,
  onDismiss,
  prompt,
  visible,
}: MobileUpdateModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!visible || !prompt) return null;

  const isRequired = prompt.kind === 'native-required';

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={isRequired ? ignoreRequiredModalCloseRequest : onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor:
                colorScheme === 'dark' ? palette.gray[700] : palette.gray[200],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {getTitle(prompt)}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {prompt.message}
          </Text>
          <Pressable
            accessibilityLabel={getAcceptLabel(prompt)}
            accessibilityRole="button"
            onPress={onAccept}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {getAcceptLabel(prompt)}
            </Text>
          </Pressable>
          {isRequired ? null : (
            <Pressable
              accessibilityLabel="Later"
              accessibilityRole="button"
              onPress={onDismiss}
              style={styles.secondaryButton}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Later
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    gap: SPACING.md,
    maxWidth: 360,
    padding: SPACING.lg,
    width: '88%',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND.secondary,
    borderRadius: RADIUS.xl,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  primaryButtonText: {
    color: palette.black,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
});
