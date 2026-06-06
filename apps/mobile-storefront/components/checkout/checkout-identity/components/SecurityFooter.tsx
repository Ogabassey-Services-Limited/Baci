import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';

interface SecurityFooterProps {
  bottomInset: number;
  theme: CheckoutIdentityTheme;
}

export function SecurityFooter({ bottomInset, theme }: SecurityFooterProps) {
  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: theme.footer,
          borderTopColor: theme.border,
          paddingBottom: Math.max(bottomInset, 12),
        },
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel="Security notice: Your security is our priority. All transactions are encrypted."
    >
      <Ionicons
        name="lock-closed"
        size={12}
        color={theme.footerText}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
      <Text style={[styles.footerText, { color: theme.footerText }]}>
        Your security is our priority. All transactions are encrypted.
      </Text>
    </View>
  );
}
