import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
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

const ignoreRequiredModalCloseRequest = () => undefined;

export function MobileUpdateModal({
  onAccept,
  onDismiss,
  prompt,
  visible,
}: MobileUpdateModalProps) {
  const { colors } = useTheme();

  if (!visible || !prompt) return null;

  const isRequired = prompt.kind === 'native-required';

  return (
    <AppDialogModal
      dismissOnBackdropPress={!isRequired}
      onClose={isRequired ? ignoreRequiredModalCloseRequest : onDismiss}
      visible={visible}
    >
      <View>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {getTitle(prompt)}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {prompt.message}
          </Text>
          <Pressable
            accessibilityLabel={getAcceptLabel(prompt)}
            accessibilityRole="button"
            onPress={onAccept}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: colors.textOnPrimary },
              ]}
            >
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
    </AppDialogModal>
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
  primaryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
