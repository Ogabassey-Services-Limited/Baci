import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';
import type { ErrorAlertProps } from '../types';

interface ThemedErrorAlertProps extends ErrorAlertProps {
  theme: CheckoutIdentityTheme;
}

/**
 * Displays an error message with icon and accessibility support
 */
export function ErrorAlert({ error, theme }: ThemedErrorAlertProps) {
  if (!error) return null;

  return (
    <View
      style={[
        styles.errorContainer,
        { backgroundColor: theme.errorSurface, borderColor: theme.error },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons
        name="alert-circle"
        size={16}
        color={theme.error}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
    </View>
  );
}
