import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';
import type { SubmitButtonProps } from '../types';

interface ThemedSubmitButtonProps extends SubmitButtonProps {
  theme: CheckoutIdentityTheme;
}

/**
 * Primary submit button with loading state
 */
export function SubmitButton({
  isLoading,
  onPress,
  label = 'Sign In & Checkout',
  loadingLabel = 'Signing in',
  theme,
}: ThemedSubmitButtonProps) {
  const haptics = useHaptics();

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        { backgroundColor: theme.buttonPrimary },
        isLoading && styles.primaryButtonDisabled,
      ]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={isLoading ? loadingLabel : label}
      accessibilityState={{ disabled: isLoading, busy: isLoading }}
      accessibilityHint="Submit your credentials to sign in"
    >
      {isLoading ? (
        <ActivityIndicator color={theme.primaryForeground} size="small" />
      ) : (
        <>
          <Ionicons
            name="person"
            size={16}
            color={theme.primaryForeground}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.primaryButtonText,
              { color: theme.primaryForeground },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
