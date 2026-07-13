/**
 * Divider Component
 * Visual divider with "or" text
 *
 * 2026 Best Practices:
 * - Proper accessibility (decorative)
 * - Semantic markup
 */

import { Text, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';

interface DividerProps {
  text?: string;
  theme: CheckoutIdentityTheme;
}

export function Divider({ text = 'or', theme }: DividerProps) {
  return (
    <View
      style={styles.divider}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
      <Text style={[styles.dividerText, { color: theme.footerText }]}>
        {text}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
    </View>
  );
}
