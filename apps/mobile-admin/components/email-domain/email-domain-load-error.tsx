import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { EmailDomainColors } from './email-domain-settings.styles';
import { makeEmailDomainSettingsStyles } from './email-domain-settings.styles';

export function getEmailDomainErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

interface EmailDomainLoadErrorProps {
  colors: EmailDomainColors;
  error: unknown;
  refreshing: boolean;
  onRetry: () => void;
}

export function EmailDomainLoadError({
  colors,
  error,
  refreshing,
  onRetry,
}: EmailDomainLoadErrorProps) {
  const styles = makeEmailDomainSettingsStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>We could not load your email domain.</Text>
      <Text style={styles.errorText}>{getEmailDomainErrorMessage(error)}</Text>
      <Pressable
        style={[styles.secondaryButton, refreshing && styles.buttonDisabled]}
        disabled={refreshing}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
      >
        {refreshing ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}
